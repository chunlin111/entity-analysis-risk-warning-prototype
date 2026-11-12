package com.example.demo.service;

import com.example.demo.entity.User;
import com.example.demo.repository.UserRepository;
import com.example.demo.util.JwtUtil;
import com.example.demo.util.SmCryptoUtil;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
public class UserService {
    
    private final UserRepository userRepository;
    private final SmCryptoUtil smCryptoUtil;
    private final CaptchaService captchaService;
    private final EmailService emailService;
    private final JwtUtil jwtUtil;
    
    @Value("${app.security.max-login-attempts:5}")
    private int maxLoginAttempts;
    
    @Value("${app.security.lock-time-minutes:120}")
    private int lockTimeMinutes;
    
    @Value("${app.security.password-expiry-days:90}")
    private int passwordExpiryDays;
    
    @Value("${app.security.admin-invite-code}")
    private String adminInviteCode;
    
    public UserService(UserRepository userRepository, SmCryptoUtil smCryptoUtil, 
                      CaptchaService captchaService, EmailService emailService,
                      JwtUtil jwtUtil) {
        this.userRepository = userRepository;
        this.smCryptoUtil = smCryptoUtil;
        this.captchaService = captchaService;
        this.emailService = emailService;
        this.jwtUtil = jwtUtil;
    }
    
    /**
     * 发送注册验证码
     */
    public void sendRegisterCode(String email, String captcha, String captchaId) {
        // 验证图形验证码
        if (!captchaService.validateCaptcha(captchaId, captcha)) {
            throw new IllegalArgumentException("图形验证码错误");
        }
        
        // 检查邮箱是否已注册
        if (userRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("该邮箱已被注册");
        }
        
        // 生成验证码
        String code = generateRandomCode();
        
        // 存储验证码
        captchaService.storeEmailCode(email, code);
        
        // 发送邮件
        try {
            emailService.sendRegisterCode(email, code);
        } catch (Exception e) {
            log.error("发送注册验证码失败", e);
            throw new RuntimeException("验证码发送失败，请稍后重试");
        }
    }
    
    /**
     * 用户注册
     */
    @Transactional
    public User register(String username, String email, String encryptedPassword, 
                        String sign, Integer role, Integer userType, 
                        String code, String adminCode) {
        
        // 1. SM2解密密码
        String realPassword = smCryptoUtil.decrypt(encryptedPassword);
        if (realPassword == null) {
            throw new IllegalArgumentException("数据解密失败，传输可能被篡改");
        }
        
        // 2. SM3验签
        String serverSign = smCryptoUtil.sm3Hash(realPassword);
        if (serverSign == null || !serverSign.equals(sign)) {
            throw new IllegalArgumentException("数据签名校验失败，请求非法");
        }
        
        // 3. 密码复杂度校验
        SmCryptoUtil.PasswordValidationResult validation = 
            smCryptoUtil.validatePassword(realPassword, username, email);
        if (!validation.isValid()) {
            throw new IllegalArgumentException(validation.getMessage());
        }
        
        // 4. 验证邮箱验证码
        if (!captchaService.validateEmailCode(email, code)) {
            throw new IllegalArgumentException("验证码错误或已过期");
        }
        
        // 5. 检查管理员邀请码
        if (role != null && role == 0) {
            if (adminCode == null || adminCode.trim().isEmpty()) {
                throw new IllegalArgumentException("注册管理员必须填写邀请码");
            }
            if (!adminInviteCode.equals(adminCode)) {
                log.warn("尝试注册管理员失败，邀请码错误: {}", adminCode);
                throw new IllegalArgumentException("管理员邀请码错误，拒绝注册");
            }
        }
        
        // 6. 检查邮箱是否已存在
        if (userRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("该邮箱已注册");
        }
        
        // 7. 密码加密
        String passwordToStore = smCryptoUtil.dbHash(realPassword);
        
        // 8. 创建用户
        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setPassword(passwordToStore);
        user.setRole(role != null ? role : 2);
        user.setUserType(userType);
        user.setPasswordChangedAt(LocalDateTime.now());
        
        return userRepository.save(user);
    }
    
    /**
     * 用户登录
     */
    @Transactional
    public String login(String email, String encryptedPassword, 
                       String sign, String captcha, String captchaId) {
        
        // 1. 验证图形验证码
        if (!captchaService.validateCaptcha(captchaId, captcha)) {
            throw new IllegalArgumentException("验证码错误或已过期");
        }
        
        // 2. 查询用户
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("账号或密码错误"));
        
        // 3. 检查账户锁定状态
        if (user.getLockUntil() != null && user.getLockUntil().isAfter(LocalDateTime.now())) {
            long waitMinutes = ChronoUnit.MINUTES.between(LocalDateTime.now(), user.getLockUntil());
            throw new IllegalArgumentException(String.format("账户已被锁定，请在 %d 分钟后重试", waitMinutes));
        }
        
        // 4. SM2解密密码
        String realPassword = smCryptoUtil.decrypt(encryptedPassword);
        if (realPassword == null) {
            incrementLoginAttempts(user);
            throw new IllegalArgumentException("数据解密失败");
        }
        
        // 5. SM3验签
        String serverSign = smCryptoUtil.sm3Hash(realPassword);
        if (serverSign == null || !serverSign.equals(sign)) {
            incrementLoginAttempts(user);
            throw new IllegalArgumentException("数据签名校验失败");
        }
        
        // 6. 验证密码
        String inputDbHash = smCryptoUtil.dbHash(realPassword);
        if (!inputDbHash.equals(user.getPassword())) {
            incrementLoginAttempts(user);
            throw new IllegalArgumentException("账号或密码错误");
        }
        
        // 7. 检查用户是否已认证（管理员除外）
        if (user.getRole() != 0 && !Boolean.TRUE.equals(user.getIsVerified())) {
            throw new IllegalArgumentException("您的账号尚未通过管理员认证，请等待审核");
        }
        
        // 8. 检查密码是否过期
        LocalDateTime lastChange = user.getPasswordChangedAt();
        long daysSinceChange = ChronoUnit.DAYS.between(lastChange, LocalDateTime.now());
        if (daysSinceChange > passwordExpiryDays) {
            throw new IllegalArgumentException(
                "您的密码已过期（超过" + passwordExpiryDays + "天未修改），为了安全请立即重置密码"
            );
        }
        
        // 9. 登录成功，重置登录失败计数
        user.setLoginAttempts(0);
        user.setLockUntil(null);
        
        // 10. 生成新的会话ID
        String sessionId = UUID.randomUUID().toString();
        user.setSessionId(sessionId);
        userRepository.save(user);
        
        log.info("用户登录成功: {}", email);
        return sessionId;
    }
    
    /**
     * 生成JWT令牌
     */
    public String generateJwtToken(User user, String sessionId) {
        return jwtUtil.generateToken(
            user.getId(),
            user.getUsername(),
            user.getEmail(),
            user.getRole(),
            sessionId
        );
    }
    
    /**
     * 发送重置密码验证码
     */
    public void sendResetPasswordCode(String email) {
        // 检查用户是否存在
        if (!userRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("该邮箱尚未注册");
        }
        
        // 生成验证码
        String code = generateRandomCode();
        
        // 存储验证码
        captchaService.storeEmailCode(email, code);
        
        // 发送邮件
        try {
            emailService.sendResetPasswordCode(email, code);
        } catch (Exception e) {
            log.error("发送重置密码验证码失败", e);
            throw new RuntimeException("验证码发送失败，请稍后重试");
        }
    }
    
    /**
     * 重置密码
     */
    @Transactional
    public void resetPassword(String email, String code, 
                             String encryptedNewPassword, String sign) {
        
        // 1. 验证邮箱验证码
        if (!captchaService.validateEmailCode(email, code)) {
            throw new IllegalArgumentException("验证码错误或已过期");
        }
        
        // 2. 查询用户
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("用户不存在"));
        
        // 3. SM2解密新密码
        String realNewPassword = smCryptoUtil.decrypt(encryptedNewPassword);
        if (realNewPassword == null) {
            throw new IllegalArgumentException("密码解密失败，数据可能被篡改");
        }
        
        // 4. SM3验签
        String serverSign = smCryptoUtil.sm3Hash(realNewPassword);
        if (serverSign == null || !serverSign.equals(sign)) {
            throw new IllegalArgumentException("数据签名校验失败");
        }
        
        // 5. 密码复杂度校验
        SmCryptoUtil.PasswordValidationResult validation = 
            smCryptoUtil.validatePassword(realNewPassword, user.getUsername(), email);
        if (!validation.isValid()) {
            throw new IllegalArgumentException(validation.getMessage());
        }
        
        // 6. 检查新密码是否与旧密码相同
        String newPasswordHash = smCryptoUtil.dbHash(realNewPassword);
        if (newPasswordHash.equals(user.getPassword())) {
            throw new IllegalArgumentException("新密码不能与当前使用的密码相同");
        }
        
        // 7. 更新密码
        user.setPassword(newPasswordHash);
        user.setPasswordChangedAt(LocalDateTime.now());
        userRepository.save(user);
        
        log.info("用户密码重置成功: {}", email);
    }
    
    /**
     * 增加登录失败次数
     */
    private void incrementLoginAttempts(User user) {
        int attempts = user.getLoginAttempts() + 1;
        user.setLoginAttempts(attempts);
        
        if (attempts >= maxLoginAttempts) {
            user.setLockUntil(LocalDateTime.now().plusMinutes(lockTimeMinutes));
            log.warn("用户账户被锁定: {}, 锁定至: {}", user.getEmail(), user.getLockUntil());
        }
        
        userRepository.save(user);
    }
    
    /**
     * 生成6位随机验证码
     */
    private String generateRandomCode() {
        return String.valueOf((int) ((Math.random() * 9 + 1) * 100000));
    }
    
    /**
     * 根据邮箱查找用户
     */
    public Optional<User> findByEmail(String email) {
        return userRepository.findByEmail(email);
    }
}
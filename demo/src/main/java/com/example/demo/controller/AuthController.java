package com.example.demo.controller;

import com.example.demo.dto.*;
import com.example.demo.entity.User;
import com.example.demo.service.CaptchaService;
import com.example.demo.service.UserService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@Slf4j
@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {
    
    private final UserService userService;
    private final CaptchaService captchaService;
    
    public AuthController(UserService userService, CaptchaService captchaService) {
        this.userService = userService;
        this.captchaService = captchaService;
    }
    
    /**
     * 获取图形验证码
     */
    @GetMapping("/captcha")
    public ResponseEntity<CaptchaResponse> getCaptcha() {
        CaptchaResponse captcha = captchaService.generateCaptcha();
        return ResponseEntity.ok(captcha);
    }
    
    /**
     * 发送邮箱验证码
     */
    @PostMapping("/send-code")
    public ResponseEntity<Map<String, Object>> sendCode(@Valid @RequestBody EmailCodeRequest request) {
        try {
            userService.sendRegisterCode(request.getEmail(), request.getCaptcha(), request.getCaptchaId());
            
            Map<String, Object> response = new HashMap<>();
            response.put("msg", "验证码发送成功");
            response.put("success", true);
            return ResponseEntity.ok(response);
            
        } catch (IllegalArgumentException e) {
            log.warn("发送验证码失败: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("msg", e.getMessage()));
        } catch (Exception e) {
            log.error("发送验证码异常", e);
            return ResponseEntity.internalServerError().body(Map.of(
                "msg", "验证码发送失败，请检查邮箱地址或稍后重试"
            ));
        }
    }
    
    /**
     * 用户注册
     */
    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> register(@Valid @RequestBody RegisterRequest request) {
        try {
            User user = userService.register(
                request.getUsername(),
                request.getEmail(),
                request.getPassword(),
                request.getSign(),
                request.getRole(),
                request.getUserType(),
                request.getCode(),
                request.getAdminCode()
            );
            
            Map<String, Object> response = new HashMap<>();
            response.put("msg", "注册成功");
            response.put("userId", user.getId());
            return ResponseEntity.ok(response);
            
        } catch (IllegalArgumentException e) {
            log.warn("注册失败: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("msg", e.getMessage()));
        } catch (Exception e) {
            log.error("注册异常", e);
            return ResponseEntity.internalServerError().body(Map.of(
                "msg", "服务器错误: " + e.getMessage()
            ));
        }
    }
    
    /**
     * 用户登录
     */
    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@Valid @RequestBody LoginRequest request) {
        try {
            String sessionId = userService.login(
                request.getEmail(),
                request.getPassword(),
                request.getSign(),
                request.getCaptcha(),
                request.getCaptchaId()
            );
            
            Optional<User> userOptional = userService.findByEmail(request.getEmail());
            if (userOptional.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("msg", "用户不存在"));
            }
            
            User user = userOptional.get();
            String token = userService.generateJwtToken(user, sessionId);
            
            LoginResponse loginResponse = new LoginResponse(
                token,
                user.getRole(),
                user.getUsername(),
                "登录成功"
            );
            
            return ResponseEntity.ok(loginResponseToMap(loginResponse));
            
        } catch (IllegalArgumentException e) {
            log.warn("登录失败: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("msg", e.getMessage()));
        } catch (Exception e) {
            log.error("登录异常", e);
            return ResponseEntity.internalServerError().body(Map.of("msg", "服务器错误"));
        }
    }
    
    /**
     * 发送重置密码验证码
     */
    @PostMapping("/reset-password-code")
    public ResponseEntity<Map<String, Object>> sendResetPasswordCode(@RequestBody Map<String, String> request) {
        try {
            String email = request.get("email");
            if (email == null || email.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("msg", "请输入邮箱"));
            }
            
            userService.sendResetPasswordCode(email);
            
            Map<String, Object> response = new HashMap<>();
            response.put("msg", "验证码已发送");
            response.put("success", true);
            return ResponseEntity.ok(response);
            
        } catch (IllegalArgumentException e) {
            log.warn("发送重置密码验证码失败: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("msg", e.getMessage()));
        } catch (Exception e) {
            log.error("发送重置密码验证码异常", e);
            return ResponseEntity.internalServerError().body(Map.of(
                "msg", "邮件发送失败，请稍后重试"
            ));
        }
    }
    
    /**
     * 重置密码
     */
    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, Object>> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        try {
            userService.resetPassword(
                request.getEmail(),
                request.getCode(),
                request.getNewPassword(),
                request.getSign()
            );
            
            return ResponseEntity.ok(Map.of("msg", "密码重置成功，请重新登录"));
            
        } catch (IllegalArgumentException e) {
            log.warn("重置密码失败: {}", e.getMessage());
            return ResponseEntity.badRequest().body(Map.of("msg", e.getMessage()));
        } catch (Exception e) {
            log.error("重置密码异常", e);
            return ResponseEntity.internalServerError().body(Map.of(
                "msg", "重置失败: " + e.getMessage()
            ));
        }
    }
    
    /**
     * 健康检查
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> healthCheck() {
        return ResponseEntity.ok(Map.of(
            "status", "UP",
            "service", "电力交易平台认证服务"
        ));
    }
    
    /**
     * 将LoginResponse转换为Map
     */
    private Map<String, Object> loginResponseToMap(LoginResponse response) {
        Map<String, Object> map = new HashMap<>();
        map.put("token", response.getToken());
        map.put("role", response.getRole());
        map.put("username", response.getUsername());
        map.put("msg", response.getMessage());
        return map;
    }
}
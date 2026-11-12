package com.example.demo.service;

import cn.hutool.captcha.CaptchaUtil;
import cn.hutool.captcha.LineCaptcha;
import cn.hutool.captcha.generator.RandomGenerator;
import com.example.demo.dto.CaptchaResponse;
import com.example.demo.util.MemoryCacheManager;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Slf4j
@Service
public class CaptchaService {
    
    private final MemoryCacheManager cacheManager;
    
    @Value("${app.captcha.expire-seconds:300}")
    private int captchaExpireSeconds;
    
    @Value("${app.email-code.expire-seconds:300}")
    private int emailCodeExpireSeconds;
    
    public CaptchaService(MemoryCacheManager cacheManager) {
        this.cacheManager = cacheManager;
    }
    
    /**
     * 生成图形验证码
     */
    public CaptchaResponse generateCaptcha() {
        try {
            // 自定义纯数字验证码（长度为4）
            RandomGenerator randomGenerator = new RandomGenerator("0123456789", 4);
            
            // 定义图片的宽高
            LineCaptcha lineCaptcha = CaptchaUtil.createLineCaptcha(120, 40, 4, 100);
            lineCaptcha.setGenerator(randomGenerator);
            
            // 生成验证码
            lineCaptcha.createCode();
            
            // 获取验证码文本
            String captchaText = lineCaptcha.getCode();
            
            // 获取图片Base64
            String imageBase64 = lineCaptcha.getImageBase64();
            
            // 生成唯一ID
            String captchaId = UUID.randomUUID().toString();
            
            // 存储到内存缓存
            cacheManager.put("captcha:" + captchaId, captchaText.toLowerCase(), captchaExpireSeconds);
            
            log.info("生成验证码: {}, ID: {}", captchaText, captchaId);
            return new CaptchaResponse(captchaId, imageBase64);
            
        } catch (Exception e) {
            log.error("生成验证码失败", e);
            throw new RuntimeException("生成验证码失败");
        }
    }
    
    /**
     * 验证图形验证码
     */
    public boolean validateCaptcha(String captchaId, String userInput) {
        if (captchaId == null || userInput == null) {
            return false;
        }
        
        return cacheManager.validate("captcha:" + captchaId, userInput.toLowerCase());
    }
    
    /**
     * 存储邮箱验证码
     */
    public void storeEmailCode(String email, String code) {
        cacheManager.put("email_code:" + email, code, emailCodeExpireSeconds);
    }
    
    /**
     * 验证邮箱验证码
     */
    public boolean validateEmailCode(String email, String code) {
        return cacheManager.validate("email_code:" + email, code);
    }
    
    /**
     * 检查邮箱验证码是否存在
     */
    public boolean hasEmailCode(String email) {
        return cacheManager.containsKey("email_code:" + email);
    }
}
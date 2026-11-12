package com.example.demo.service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class EmailService {
    
    private final JavaMailSender mailSender;
    
    @Value("${spring.mail.username}")
    private String fromEmail;
    
    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }
    
    /**
     * 发送注册验证码
     */
    public void sendRegisterCode(String toEmail, String code) throws MessagingException {
        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
        
        // 只设置邮箱地址，不设置发件人名称
        helper.setFrom(fromEmail);
        helper.setTo(toEmail);
        helper.setSubject("【电力交易平台】注册验证码");
        
        String htmlContent = String.format("""
            <div style="padding: 20px; background-color: #f5f5f5;">
                <div style="background-color: white; padding: 20px; border-radius: 5px;">
                    <h3 style="color: #409EFF;">欢迎注册电力交易平台</h3>
                    <p>您的验证码是：<strong style="font-size: 20px; color: #F56C6C;">%s</strong></p>
                    <p style="color: #909399; font-size: 12px;">有效期5分钟，如非本人操作请忽略。</p>
                </div>
            </div>
            """, code);
        
        helper.setText(htmlContent, true);
        
        mailSender.send(message);
        log.info("注册验证码已发送至 {}: {}", toEmail, code);
    }
    
    /**
     * 发送重置密码验证码
     */
    public void sendResetPasswordCode(String toEmail, String code) throws MessagingException {
        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
        
        // 只设置邮箱地址，不设置发件人名称
        helper.setFrom(fromEmail);
        helper.setTo(toEmail);
        helper.setSubject("【电力交易平台】重置密码验证");
        
        String htmlContent = String.format("""
            <div style="padding: 20px;">
                <h3>您正在申请重置密码</h3>
                <p>您的验证码是：<strong style="color: #F56C6C; font-size: 18px;">%s</strong></p>
                <p style="color: #999; font-size: 12px;">有效期5分钟。如果这不是您的操作，请忽略此邮件。</p>
            </div>
            """, code);
        
        helper.setText(htmlContent, true);
        
        mailSender.send(message);
        log.info("重置密码验证码已发送至 {}: {}", toEmail, code);
    }
}
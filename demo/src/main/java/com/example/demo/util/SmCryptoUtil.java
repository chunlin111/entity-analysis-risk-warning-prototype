package com.example.demo.util;

import lombok.extern.slf4j.Slf4j;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.stereotype.Component;

import java.security.MessageDigest;
import java.security.Security;
import java.util.Base64;

@Slf4j
@Component
public class SmCryptoUtil {
    
    static {
        Security.addProvider(new BouncyCastleProvider());
    }
    
    /**
     * SM2解密（简化版，实际应根据你的前端加密方式调整）
     * 这里需要根据实际的前端SM2加密实现来编写解密逻辑
     */
    public String decrypt(String encryptedData) {
        try {
            // 这里只是示例，你需要根据实际的前端SM2加密方式实现解密
            // 示例：Base64解码
            byte[] encryptedBytes = Base64.getDecoder().decode(encryptedData);
            return new String(encryptedBytes);
        } catch (Exception e) {
            log.error("SM2解密失败", e);
            return null;
        }
    }
    
    /**
     * SM3哈希计算
     */
    public String sm3Hash(String data) {
        try {
            MessageDigest md = MessageDigest.getInstance("SM3", "BC");
            byte[] hash = md.digest(data.getBytes());
            return bytesToHex(hash);
        } catch (Exception e) {
            log.error("SM3哈希计算失败", e);
            return null;
        }
    }
    
    /**
     * 数据库存储的哈希（根据你的需求自定义）
     */
    public String dbHash(String password) {
        // 这里可以使用SM3加盐哈希
        String salt = "blockchain_power_trade_salt";
        return sm3Hash(password + salt);
    }
    
    /**
     * 密码复杂度校验
     */
    public PasswordValidationResult validatePassword(String password, String username, String useremail) {
        // 1. 长度校验 (8-20位)
        if (password.length() < 8 || password.length() > 20) {
            return new PasswordValidationResult(false, "密码长度必须在 8 到 20 位之间");
        }

        // 2. 用户名校验 (不能包含用户名，不能与用户名相同)
        if (username != null) {
            if (password.equals(username)) {
                return new PasswordValidationResult(false, "密码不能与用户名相同");
            }
            if (password.contains(username)) {
                return new PasswordValidationResult(false, "密码不能包含用户名");
            }
        }

        if (useremail != null) {
            if (password.equals(useremail)) {
                return new PasswordValidationResult(false, "密码不能与邮箱相同");
            }
            if (password.contains(useremail)) {
                return new PasswordValidationResult(false, "密码不能包含邮箱");
            }
        }

        // 3. 复杂度校验 (大写、小写、数字、特殊字符，四选三)
        int categories = 0;
        if (password.matches(".*[A-Z].*")) categories++; // 大写
        if (password.matches(".*[a-z].*")) categories++; // 小写
        if (password.matches(".*[0-9].*")) categories++; // 数字
        if (password.matches(".*[^A-Za-z0-9].*")) categories++; // 特殊字符

        if (categories < 3) {
            return new PasswordValidationResult(false, "密码复杂度不足：需包含大写字母、小写字母、数字、特殊字符中的至少三种");
        }

        return new PasswordValidationResult(true, "密码强度符合要求");
    }
    
    /**
     * 字节数组转十六进制字符串
     */
    private String bytesToHex(byte[] bytes) {
        StringBuilder result = new StringBuilder();
        for (byte b : bytes) {
            result.append(String.format("%02x", b));
        }
        return result.toString();
    }
    
    public static class PasswordValidationResult {
        private final boolean valid;
        private final String message;
        
        public PasswordValidationResult(boolean valid, String message) {
            this.valid = valid;
            this.message = message;
        }
        
        public boolean isValid() {
            return valid;
        }
        
        public String getMessage() {
            return message;
        }
    }
}
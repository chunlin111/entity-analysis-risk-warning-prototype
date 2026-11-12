package com.example.demo.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Data
public class User {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private String username;
    
    @Column(nullable = false, unique = true)
    private String email;
    
    @Column(nullable = false)
    private String password;
    
    @Column(nullable = false)
    private Integer role = 2; // 0: 管理员, 1: 特殊用户, 2: 普通用户
    
    @Column(name = "user_type")
    private Integer userType; // 0: 居民, 1: 商业, 2: 工业
    
    @Column(name = "is_verified")
    private Boolean isVerified = false;
    
    @Column(name = "last_verified_at")
    private LocalDateTime lastVerifiedAt = LocalDateTime.now();
    
    @Column(name = "password_changed_at")
    private LocalDateTime passwordChangedAt = LocalDateTime.now();
    
    @Column(name = "login_attempts")
    private Integer loginAttempts = 0;
    
    @Column(name = "lock_until")
    private LocalDateTime lockUntil;
    
    @Column(name = "session_id")
    private String sessionId;
    
    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
    
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
package com.ruye.server.auth;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(name = "user_account", uniqueConstraints = @UniqueConstraint(name = "uk_user_email", columnNames = "email"))
public class UserAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 统一转成小写存储，避免大小写不同的同一邮箱注册两次 */
    @Column(nullable = false, length = 254)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    /**
     * 令牌版本：写进每个访问令牌（claim "tv"）。退出所有设备、重置密码时加一，
     * 之前签发的访问令牌立即失效，不必等它们自然过期。
     * 带默认值，已有数据库升级时新增这一列不会因为旧数据为空而失败。
     */
    @Column(name = "token_version", nullable = false, columnDefinition = "integer default 0 not null")
    private int tokenVersion;

    protected UserAccount() {}

    public UserAccount(String email, String passwordHash) {
        this.email = email;
        this.passwordHash = passwordHash;
        this.createdAt = Instant.now();
    }

    public void changePassword(String newHash) {
        this.passwordHash = newHash;
        this.tokenVersion += 1;
    }

    public void bumpTokenVersion() {
        this.tokenVersion += 1;
    }

    public int getTokenVersion() { return tokenVersion; }
    public Long getId() { return id; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public Instant getCreatedAt() { return createdAt; }
}

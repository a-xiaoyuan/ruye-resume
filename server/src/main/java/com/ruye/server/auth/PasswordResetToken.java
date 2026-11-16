package com.ruye.server.auth;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/** 找回密码令牌：只存摘要，30 分钟有效，只能用一次 */
@Entity
@Table(name = "password_reset_token", indexes = {
        @Index(name = "idx_reset_hash", columnList = "token_hash", unique = true),
        @Index(name = "idx_reset_user", columnList = "user_id")})
public class PasswordResetToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserAccount user;

    @Column(name = "token_hash", nullable = false, length = 64)
    private String tokenHash;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "used_at")
    private Instant usedAt;

    protected PasswordResetToken() {}

    public PasswordResetToken(UserAccount user, String tokenHash, Instant expiresAt) {
        this.user = user;
        this.tokenHash = tokenHash;
        this.expiresAt = expiresAt;
    }

    public boolean usable(Instant now) { return usedAt == null && now.isBefore(expiresAt); }
    public void markUsed() { usedAt = Instant.now(); }
    public UserAccount getUser() { return user; }
}

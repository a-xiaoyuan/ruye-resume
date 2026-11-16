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

/**
 * 刷新令牌。数据库里只存 SHA-256 摘要，泄露数据库也拿不到可用的令牌。
 * 每次刷新都会作废旧令牌、签发新令牌（轮换）；已作废的令牌再次被使用，说明它可能被盗，
 * 此时作废该用户的全部令牌（重用检测）。
 */
@Entity
@Table(name = "refresh_token", indexes = {
        @Index(name = "idx_refresh_hash", columnList = "token_hash", unique = true),
        @Index(name = "idx_refresh_user", columnList = "user_id")})
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserAccount user;

    @Column(name = "token_hash", nullable = false, length = 64)
    private String tokenHash;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    protected RefreshToken() {}

    public RefreshToken(UserAccount user, String tokenHash, Instant expiresAt) {
        this.user = user;
        this.tokenHash = tokenHash;
        this.createdAt = Instant.now();
        this.expiresAt = expiresAt;
    }

    public void revoke() {
        if (revokedAt == null) revokedAt = Instant.now();
    }

    public boolean isRevoked() { return revokedAt != null; }
    public boolean isExpired(Instant now) { return !now.isBefore(expiresAt); }
    public UserAccount getUser() { return user; }
    public Instant getExpiresAt() { return expiresAt; }
}

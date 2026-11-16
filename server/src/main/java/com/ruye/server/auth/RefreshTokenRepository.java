package com.ruye.server.auth;

import java.time.Instant;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    @Modifying
    @Query("update RefreshToken t set t.revokedAt = :now where t.user.id = :userId and t.revokedAt is null")
    int revokeAllForUser(@Param("userId") long userId, @Param("now") Instant now);

    @Modifying
    @Query("delete from RefreshToken t where t.user.id = :userId")
    int deleteAllForUser(@Param("userId") long userId);

    /** 清理：过期的，以及作废超过保留期的（保留一段时间是为了重用检测） */
    @Modifying
    @Query("delete from RefreshToken t where t.expiresAt < :now or (t.revokedAt is not null and t.revokedAt < :revokedBefore)")
    int purge(@Param("now") Instant now, @Param("revokedBefore") Instant revokedBefore);
}

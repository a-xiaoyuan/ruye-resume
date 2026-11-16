package com.ruye.server.config;

import java.time.Duration;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** application.yml 中 ruye.* 的配置项 */
@ConfigurationProperties(prefix = "ruye")
public record RuyeProperties(
        String publicUrl,
        Jwt jwt,
        Cors cors,
        Limits limits,
        Login login,
        RateLimit rateLimit,
        Retention retention) {

    /** ttl：访问令牌有效期；refreshTtl：刷新令牌有效期 */
    public record Jwt(String secret, Duration ttl, Duration refreshTtl) {}

    public record Cors(List<String> allowedOrigins) {}

    public record Limits(int maxDocumentBytes, int maxDocumentsPerUser) {}

    public record Login(int maxFailures, Duration lockDuration) {}

    public record RateLimit(String store, int loginPerIp, int registerPerIp, int resetPerIp, int resetPerEmail) {}

    public record Retention(int deletedResumeDays) {}
}

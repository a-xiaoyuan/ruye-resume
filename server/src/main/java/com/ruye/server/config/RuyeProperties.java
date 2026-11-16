package com.ruye.server.config;

import java.time.Duration;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** application.yml 中 ruye.* 的配置项 */
@ConfigurationProperties(prefix = "ruye")
public record RuyeProperties(Jwt jwt, Cors cors, Limits limits, Login login) {

    public record Jwt(String secret, Duration ttl) {}

    public record Cors(List<String> allowedOrigins) {}

    public record Limits(int maxDocumentBytes, int maxDocumentsPerUser) {}

    public record Login(int maxFailures, Duration lockDuration) {}
}

package com.ruye.server.ratelimit;

import java.time.Duration;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/** Redis 实现：INCR 计数，第一次计数时设置过期时间。多个后端实例共享同一份计数 */
@Component
@ConditionalOnProperty(prefix = "ruye.rate-limit", name = "store", havingValue = "redis")
public class RedisRateLimiter implements RateLimiter {

    private static final String PREFIX = "ruye:rl:";
    private final StringRedisTemplate redis;

    public RedisRateLimiter(StringRedisTemplate redis) {
        this.redis = redis;
    }

    @Override
    public long increment(String key, Duration window) {
        String k = PREFIX + key;
        Long n = redis.opsForValue().increment(k);
        if (n != null && n == 1L) redis.expire(k, window);
        return n == null ? 0 : n;
    }

    @Override
    public long current(String key) {
        String v = redis.opsForValue().get(PREFIX + key);
        return v == null ? 0 : Long.parseLong(v);
    }

    @Override
    public void reset(String key) {
        redis.delete(PREFIX + key);
    }
}

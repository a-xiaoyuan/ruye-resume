package com.ruye.server.ratelimit;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** 单机内存实现。重启后计数清零；多实例部署请改用 Redis */
@Component
@ConditionalOnProperty(prefix = "ruye.rate-limit", name = "store", havingValue = "memory", matchIfMissing = true)
public class InMemoryRateLimiter implements RateLimiter {

    private record Window(long count, Instant resetAt) {}

    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
    private final Clock clock;

    @Autowired
    public InMemoryRateLimiter() {
        this(Clock.systemUTC());
    }

    InMemoryRateLimiter(Clock clock) {
        this.clock = clock;
    }

    @Override
    public long increment(String key, Duration window) {
        Instant now = clock.instant();
        return windows.compute(key, (k, w) -> (w == null || !now.isBefore(w.resetAt()))
                ? new Window(1, now.plus(window))
                : new Window(w.count() + 1, w.resetAt())).count();
    }

    @Override
    public long current(String key) {
        Window w = windows.get(key);
        return (w == null || !clock.instant().isBefore(w.resetAt())) ? 0 : w.count();
    }

    @Override
    public void reset(String key) {
        windows.remove(key);
    }

    /** 定期清掉已过期的窗口，避免内存一直增长 */
    @Scheduled(fixedDelay = 600_000)
    public void evictExpired() {
        Instant now = clock.instant();
        windows.entrySet().removeIf(e -> !now.isBefore(e.getValue().resetAt()));
    }
}

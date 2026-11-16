package com.ruye.server.ratelimit;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;

import org.junit.jupiter.api.Test;

class InMemoryRateLimiterTest {

    /** 可以手动拨动的时钟 */
    static class MutableClock extends Clock {
        Instant now = Instant.parse("2026-11-16T00:00:00Z");

        @Override public ZoneId getZone() { return ZoneId.of("UTC"); }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }

    @Test
    void countsWithinWindowAndResetsAfter() {
        MutableClock clock = new MutableClock();
        InMemoryRateLimiter rl = new InMemoryRateLimiter(clock);
        Duration w = Duration.ofMinutes(10);
        assertThat(rl.tryAcquire("k", 2, w)).isTrue();
        assertThat(rl.tryAcquire("k", 2, w)).isTrue();
        assertThat(rl.tryAcquire("k", 2, w)).isFalse();
        assertThat(rl.current("k")).isEqualTo(3);
        assertThat(rl.tryAcquire("other", 2, w)).isTrue();

        clock.now = clock.now.plus(w);
        assertThat(rl.current("k")).isZero();
        assertThat(rl.tryAcquire("k", 2, w)).isTrue();

        rl.reset("k");
        assertThat(rl.current("k")).isZero();
        clock.now = clock.now.plus(w);
        rl.evictExpired();
        assertThat(rl.current("other")).isZero();
    }
}

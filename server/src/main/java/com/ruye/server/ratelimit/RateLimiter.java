package com.ruye.server.ratelimit;

import java.time.Duration;

/**
 * 固定窗口计数。key 第一次出现时开始一个窗口，窗口内计数，窗口结束后清零。
 * 有内存（单机）和 Redis（多实例共享）两种实现，由 ruye.rate-limit.store 选择。
 */
public interface RateLimiter {

    /** 计数加一，返回加一之后的值 */
    long increment(String key, Duration window);

    /** 当前计数（不存在或窗口已过时为 0） */
    long current(String key);

    void reset(String key);

    /** 计数加一后是否仍在上限之内 */
    default boolean tryAcquire(String key, int limit, Duration window) {
        return increment(key, window) <= limit;
    }
}

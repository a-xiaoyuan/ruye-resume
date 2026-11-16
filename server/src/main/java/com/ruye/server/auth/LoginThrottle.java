package com.ruye.server.auth;

import org.springframework.stereotype.Component;

import com.ruye.server.config.RuyeProperties;
import com.ruye.server.ratelimit.RateLimiter;

/**
 * 登录失败限流：同一邮箱在锁定时长内失败达到上限后，暂时拒绝该邮箱登录，防止暴力猜密码。
 * 计数放在 RateLimiter 里（内存或 Redis），多实例部署时也能共享。
 */
@Component
public class LoginThrottle {

    private final RateLimiter limiter;
    private final RuyeProperties props;

    public LoginThrottle(RateLimiter limiter, RuyeProperties props) {
        this.limiter = limiter;
        this.props = props;
    }

    private static String key(String email) {
        return "login-fail:" + email;
    }

    public boolean isLocked(String email) {
        return limiter.current(key(email)) >= props.login().maxFailures();
    }

    public void recordFailure(String email) {
        limiter.increment(key(email), props.login().lockDuration());
    }

    public void recordSuccess(String email) {
        limiter.reset(key(email));
    }
}

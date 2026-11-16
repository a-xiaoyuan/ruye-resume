package com.ruye.server.auth;

import java.time.Clock;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.ruye.server.config.RuyeProperties;

/**
 * 登录失败限流：同一邮箱连续失败达到上限后锁定一段时间，防止暴力猜密码。
 * 单机内存实现，足够个人部署；多实例部署时应换成 Redis。
 */
@Component
public class LoginThrottle {

    private record State(int failures, Instant lockedUntil) {}

    private final ConcurrentHashMap<String, State> states = new ConcurrentHashMap<>();
    private final RuyeProperties props;
    private final Clock clock;

    @Autowired
    public LoginThrottle(RuyeProperties props) {
        this(props, Clock.systemUTC());
    }

    LoginThrottle(RuyeProperties props, Clock clock) {
        this.props = props;
        this.clock = clock;
    }

    /** 当前是否处于锁定期 */
    public boolean isLocked(String email) {
        State s = states.get(email);
        return s != null && s.lockedUntil() != null && clock.instant().isBefore(s.lockedUntil());
    }

    public void recordFailure(String email) {
        states.compute(email, (k, s) -> {
            int n = (s == null || (s.lockedUntil() != null && !clock.instant().isBefore(s.lockedUntil()))) ? 1 : s.failures() + 1;
            Instant until = n >= props.login().maxFailures() ? clock.instant().plus(props.login().lockDuration()) : null;
            return new State(n, until);
        });
    }

    public void recordSuccess(String email) {
        states.remove(email);
    }
}

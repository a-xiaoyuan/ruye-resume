package com.ruye.server.auth;

import java.util.Locale;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ruye.server.common.ApiException;

@Service
public class AuthService {

    private final UserAccountRepository users;
    private final PasswordEncoder passwordEncoder;
    private final TokenService tokens;
    private final LoginThrottle throttle;

    public AuthService(UserAccountRepository users, PasswordEncoder passwordEncoder, TokenService tokens, LoginThrottle throttle) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.tokens = tokens;
        this.throttle = throttle;
    }

    static String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    @Transactional
    public AuthDtos.TokenResponse register(AuthDtos.Credentials c) {
        String email = normalize(c.email());
        if (users.existsByEmail(email)) {
            throw new ApiException(HttpStatus.CONFLICT, "email_taken", "这个邮箱已经注册过了，请直接登录");
        }
        try {
            UserAccount saved = users.saveAndFlush(new UserAccount(email, passwordEncoder.encode(c.password())));
            return tokens.issue(saved);
        } catch (DataIntegrityViolationException e) {
            // 并发注册同一邮箱：唯一约束兜底
            throw new ApiException(HttpStatus.CONFLICT, "email_taken", "这个邮箱已经注册过了，请直接登录");
        }
    }

    public AuthDtos.TokenResponse login(AuthDtos.Credentials c) {
        String email = normalize(c.email());
        if (throttle.isLocked(email)) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "login_locked", "密码错误次数过多，请 15 分钟后再试");
        }
        UserAccount user = users.findByEmail(email).orElse(null);
        // 用户不存在和密码错误返回同样的提示，不暴露邮箱是否注册过
        if (user == null || !passwordEncoder.matches(c.password(), user.getPasswordHash())) {
            throttle.recordFailure(email);
            throw new ApiException(HttpStatus.UNAUTHORIZED, "bad_credentials", "邮箱或密码不正确");
        }
        throttle.recordSuccess(email);
        return tokens.issue(user);
    }

    public AuthDtos.UserView me(long userId) {
        UserAccount u = users.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "user_gone", "账号不存在，请重新登录"));
        return new AuthDtos.UserView(u.getId(), u.getEmail());
    }
}

package com.ruye.server.auth;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ruye.server.common.ApiException;
import com.ruye.server.common.Tokens;
import com.ruye.server.config.RuyeProperties;
import com.ruye.server.ratelimit.RateLimiter;
import com.ruye.server.resume.ResumeRepository;
import com.ruye.server.resume.ResumeRevisionRepository;

@Service
public class AuthService {

    private static final Duration RESET_TTL = Duration.ofMinutes(30);

    private final UserAccountRepository users;
    private final PasswordEncoder passwordEncoder;
    private final TokenService tokens;
    private final LoginThrottle throttle;
    private final RateLimiter limiter;
    private final RuyeProperties props;
    private final PasswordResetTokenRepository resetTokens;
    private final RefreshTokenRepository refreshTokens;
    private final ResumeRepository resumes;
    private final ResumeRevisionRepository revisions;
    private final ResetMailer mailer;

    public AuthService(UserAccountRepository users, PasswordEncoder passwordEncoder, TokenService tokens, LoginThrottle throttle,
                       RateLimiter limiter, RuyeProperties props, PasswordResetTokenRepository resetTokens,
                       RefreshTokenRepository refreshTokens, ResumeRepository resumes, ResumeRevisionRepository revisions, ResetMailer mailer) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.tokens = tokens;
        this.throttle = throttle;
        this.limiter = limiter;
        this.props = props;
        this.resetTokens = resetTokens;
        this.refreshTokens = refreshTokens;
        this.resumes = resumes;
        this.revisions = revisions;
        this.mailer = mailer;
    }

    static String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private void limit(String key, int max, Duration window, String message) {
        if (!limiter.tryAcquire(key, max, window)) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "rate_limited", message);
        }
    }

    @Transactional
    public AuthDtos.TokenResponse register(AuthDtos.Credentials c, String ip) {
        limit("register-ip:" + ip, props.rateLimit().registerPerIp(), Duration.ofHours(1), "注册太频繁，请稍后再试");
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

    @Transactional
    public AuthDtos.TokenResponse login(AuthDtos.Credentials c, String ip) {
        // 按 IP 限流挡住「换着邮箱试」；按邮箱锁定挡住「对一个账号猜密码」
        limit("login-ip:" + ip, props.rateLimit().loginPerIp(), Duration.ofMinutes(15), "登录尝试太频繁，请 15 分钟后再试");
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
        UserAccount u = user(userId);
        return new AuthDtos.UserView(u.getId(), u.getEmail());
    }

    @Transactional
    public void logoutAll(long userId) {
        tokens.revokeAll(user(userId));
    }

    /**
     * 申请重置密码。无论邮箱是否注册都返回成功，不暴露账号是否存在；
     * 同一邮箱、同一 IP 都有次数限制，防止被用来轰炸别人的邮箱。
     */
    @Transactional
    public void requestReset(String rawEmail, String ip) {
        limit("reset-ip:" + ip, props.rateLimit().resetPerIp(), Duration.ofHours(1), "申请太频繁，请稍后再试");
        String email = normalize(rawEmail);
        if (!limiter.tryAcquire("reset-email:" + email, props.rateLimit().resetPerEmail(), Duration.ofHours(1))) {
            return; // 静默忽略：对外表现与正常申请一致
        }
        users.findByEmail(email).ifPresent(u -> {
            String token = Tokens.random();
            resetTokens.save(new PasswordResetToken(u, Tokens.sha256(token), Instant.now().plus(RESET_TTL)));
            String base = props.publicUrl().replaceAll("/+$", "");
            mailer.sendReset(u.getEmail(), base + "/#reset=" + token);
        });
    }

    /** 用重置令牌设置新密码。成功后退出所有设备（作废全部令牌） */
    @Transactional
    public void confirmReset(String token, String newPassword) {
        PasswordResetToken t = resetTokens.findByTokenHash(Tokens.sha256(token))
                .filter(x -> x.usable(Instant.now()))
                .orElseThrow(() -> new ApiException(HttpStatus.BAD_REQUEST, "reset_invalid", "重置链接无效或已过期，请重新申请"));
        t.markUsed();
        UserAccount u = t.getUser();
        u.changePassword(passwordEncoder.encode(newPassword));
        users.save(u);
        refreshTokens.revokeAllForUser(u.getId(), Instant.now());
        throttle.recordSuccess(u.getEmail());
    }

    /** 注销账号：校验密码后彻底删除账号、全部云端简历和令牌（本机内容不受影响） */
    @Transactional
    public void deleteAccount(long userId, String password) {
        UserAccount u = user(userId);
        if (!passwordEncoder.matches(password, u.getPasswordHash())) {
            throw new ApiException(HttpStatus.FORBIDDEN, "bad_password", "密码不正确，账号没有被注销");
        }
        revisions.deleteAllByOwner(userId);
        resumes.deleteAllByOwner(userId);
        refreshTokens.deleteAllForUser(userId);
        resetTokens.deleteAllForUser(userId);
        users.delete(u);
    }

    private UserAccount user(long userId) {
        return users.findById(userId)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "user_gone", "账号不存在，请重新登录"));
    }
}

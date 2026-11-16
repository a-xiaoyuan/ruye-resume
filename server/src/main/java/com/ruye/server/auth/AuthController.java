package com.ruye.server.auth;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;

/**
 * 账号接口。客户端 IP 取自 request.getRemoteAddr()；部署在反向代理后面时，
 * 设置 server.forward-headers-strategy=native，让它取到真实 IP（否则所有人共用代理的 IP 计数）。
 */
@RestController
public class AuthController {

    private final AuthService auth;
    private final TokenService tokens;

    public AuthController(AuthService auth, TokenService tokens) {
        this.auth = auth;
        this.tokens = tokens;
    }

    private static long uid(Jwt jwt) {
        return Long.parseLong(jwt.getSubject());
    }

    @GetMapping("/api/health")
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }

    @PostMapping("/api/auth/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthDtos.TokenResponse register(@Validated @RequestBody AuthDtos.Credentials body, HttpServletRequest req) {
        return auth.register(body, req.getRemoteAddr());
    }

    @PostMapping("/api/auth/login")
    public AuthDtos.TokenResponse login(@Validated @RequestBody AuthDtos.Credentials body, HttpServletRequest req) {
        return auth.login(body, req.getRemoteAddr());
    }

    @PostMapping("/api/auth/refresh")
    public AuthDtos.TokenResponse refresh(@Validated @RequestBody AuthDtos.RefreshRequest body) {
        return tokens.refresh(body.refreshToken());
    }

    /** 退出当前设备：作废这个刷新令牌。令牌无效时也返回成功（退出本来就是幂等的） */
    @PostMapping("/api/auth/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@Validated @RequestBody AuthDtos.RefreshRequest body) {
        tokens.revoke(body.refreshToken());
    }

    @PostMapping("/api/auth/logout-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logoutAll(@AuthenticationPrincipal Jwt jwt) {
        auth.logoutAll(uid(jwt));
    }

    @GetMapping("/api/auth/me")
    public AuthDtos.UserView me(@AuthenticationPrincipal Jwt jwt) {
        return auth.me(uid(jwt));
    }

    @PostMapping("/api/auth/password-reset/request")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void requestReset(@Validated @RequestBody AuthDtos.ResetRequest body, HttpServletRequest req) {
        auth.requestReset(body.email(), req.getRemoteAddr());
    }

    @PostMapping("/api/auth/password-reset/confirm")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void confirmReset(@Validated @RequestBody AuthDtos.ResetConfirm body) {
        auth.confirmReset(body.token(), body.password());
    }

    @PostMapping("/api/auth/account/delete")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAccount(@AuthenticationPrincipal Jwt jwt, @Validated @RequestBody AuthDtos.PasswordConfirm body) {
        auth.deleteAccount(uid(jwt), body.password());
    }
}

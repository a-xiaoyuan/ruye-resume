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

@RestController
public class AuthController {

    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    @GetMapping("/api/health")
    public Map<String, String> health() {
        return Map.of("status", "ok");
    }

    @PostMapping("/api/auth/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthDtos.TokenResponse register(@Validated @RequestBody AuthDtos.Credentials body) {
        return auth.register(body);
    }

    @PostMapping("/api/auth/login")
    public AuthDtos.TokenResponse login(@Validated @RequestBody AuthDtos.Credentials body) {
        return auth.login(body);
    }

    @GetMapping("/api/auth/me")
    public AuthDtos.UserView me(@AuthenticationPrincipal Jwt jwt) {
        return auth.me(Long.parseLong(jwt.getSubject()));
    }
}

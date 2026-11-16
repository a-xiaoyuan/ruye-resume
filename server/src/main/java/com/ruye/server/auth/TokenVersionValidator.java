package com.ruye.server.auth;

import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;

/**
 * 访问令牌里的令牌版本必须与账号当前版本一致：退出所有设备、重置密码、注销账号后，
 * 之前签发的访问令牌立即失效。代价是每个请求查一次用户表（按主键，很快）。
 */
public class TokenVersionValidator implements OAuth2TokenValidator<Jwt> {

    private static final OAuth2Error REVOKED = new OAuth2Error("invalid_token", "登录已失效，请重新登录", null);

    private final UserAccountRepository users;

    public TokenVersionValidator(UserAccountRepository users) {
        this.users = users;
    }

    @Override
    public OAuth2TokenValidatorResult validate(Jwt jwt) {
        Object tv = jwt.getClaims().get(TokenService.TOKEN_VERSION_CLAIM);
        long userId;
        try {
            userId = Long.parseLong(jwt.getSubject());
        } catch (NumberFormatException e) {
            return OAuth2TokenValidatorResult.failure(REVOKED);
        }
        boolean ok = tv instanceof Number n && users.findById(userId).map(u -> u.getTokenVersion() == n.intValue()).orElse(false);
        return ok ? OAuth2TokenValidatorResult.success() : OAuth2TokenValidatorResult.failure(REVOKED);
    }
}

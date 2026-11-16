package com.ruye.server.auth;

import java.time.Instant;

import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.ruye.server.common.ApiException;
import com.ruye.server.common.Tokens;
import com.ruye.server.config.RuyeProperties;

/**
 * 令牌签发与刷新：
 * - 访问令牌：JWT（HS256），短期有效，subject 是用户 id，claim "tv" 是令牌版本；
 * - 刷新令牌：随机串，库里只存摘要；每次刷新都轮换，作废的令牌被再次使用时作废该用户全部令牌。
 */
@Service
public class TokenService {

    public static final String TOKEN_VERSION_CLAIM = "tv";

    private final JwtEncoder encoder;
    private final RuyeProperties props;
    private final RefreshTokenRepository refreshTokens;
    private final UserAccountRepository users;

    public TokenService(JwtEncoder encoder, RuyeProperties props, RefreshTokenRepository refreshTokens, UserAccountRepository users) {
        this.encoder = encoder;
        this.props = props;
        this.refreshTokens = refreshTokens;
        this.users = users;
    }

    @Transactional
    public AuthDtos.TokenResponse issue(UserAccount user) {
        Instant now = Instant.now();
        Instant exp = now.plus(props.jwt().ttl());
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("ruye")
                .issuedAt(now)
                .expiresAt(exp)
                .subject(String.valueOf(user.getId()))
                .claim("email", user.getEmail())
                .claim(TOKEN_VERSION_CLAIM, user.getTokenVersion())
                .build();
        String access = encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();

        String refresh = Tokens.random();
        Instant refreshExp = now.plus(props.jwt().refreshTtl());
        refreshTokens.save(new RefreshToken(user, Tokens.sha256(refresh), refreshExp));
        return new AuthDtos.TokenResponse(access, exp.toEpochMilli(), refresh, refreshExp.toEpochMilli(),
                new AuthDtos.UserView(user.getId(), user.getEmail()));
    }

    /**
     * 用刷新令牌换一组新令牌。重用检测需要在失败时也提交「作废全部令牌」，
     * 所以这里不在外层事务里抛异常回滚：先完成作废，再由调用方抛出 401。
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW, noRollbackFor = ApiException.class)
    public AuthDtos.TokenResponse refresh(String refreshToken) {
        RefreshToken t = refreshTokens.findByTokenHash(Tokens.sha256(refreshToken))
                .orElseThrow(() -> unauthorized("refresh_invalid", "登录已失效，请重新登录"));
        UserAccount user = t.getUser();
        if (t.isRevoked()) {
            // 已作废的令牌又被使用：可能被盗，作废该用户全部令牌并让所有访问令牌失效
            refreshTokens.revokeAllForUser(user.getId(), Instant.now());
            user.bumpTokenVersion();
            users.save(user);
            throw unauthorized("refresh_reused", "检测到登录凭证被重复使用，为了安全已退出所有设备，请重新登录");
        }
        if (t.isExpired(Instant.now())) {
            throw unauthorized("refresh_expired", "登录已过期，请重新登录");
        }
        t.revoke();
        return issue(user);
    }

    @Transactional
    public void revoke(String refreshToken) {
        refreshTokens.findByTokenHash(Tokens.sha256(refreshToken)).ifPresent(RefreshToken::revoke);
    }

    /** 退出所有设备：作废全部刷新令牌，并让已签发的访问令牌立即失效 */
    @Transactional
    public void revokeAll(UserAccount user) {
        refreshTokens.revokeAllForUser(user.getId(), Instant.now());
        user.bumpTokenVersion();
        users.save(user);
    }

    private static ApiException unauthorized(String code, String msg) {
        return new ApiException(HttpStatus.UNAUTHORIZED, code, msg);
    }
}

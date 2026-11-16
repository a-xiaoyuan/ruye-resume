package com.ruye.server.auth;

import java.time.Instant;

import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

import com.ruye.server.config.RuyeProperties;

/** 签发访问令牌：subject 是用户 id，另带 email 便于前端显示 */
@Service
public class TokenService {

    private final JwtEncoder encoder;
    private final RuyeProperties props;

    public TokenService(JwtEncoder encoder, RuyeProperties props) {
        this.encoder = encoder;
        this.props = props;
    }

    public AuthDtos.TokenResponse issue(UserAccount user) {
        Instant now = Instant.now();
        Instant exp = now.plus(props.jwt().ttl());
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("ruye")
                .issuedAt(now)
                .expiresAt(exp)
                .subject(String.valueOf(user.getId()))
                .claim("email", user.getEmail())
                .build();
        String token = encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
        return new AuthDtos.TokenResponse(token, exp.toEpochMilli(), new AuthDtos.UserView(user.getId(), user.getEmail()));
    }
}

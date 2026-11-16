package com.ruye.server;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.support.TransactionTemplate;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ruye.server.auth.ResetMailer;
import com.ruye.server.resume.ResumeRepository;

/** 刷新令牌轮换、服务端退出、找回密码、注销账号、IP 限流 */
@SpringBootTest
@AutoConfigureMockMvc
class AuthFlowTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired ResumeRepository resumes;
    @Autowired TransactionTemplate tx;
    @MockitoBean ResetMailer mailer;

    private static final String PW = "password123";

    private String email() {
        return "f" + UUID.randomUUID().toString().substring(0, 8) + "@example.com";
    }

    /** 每个测试用自己的 IP，互不占用限流额度 */
    private static MockHttpServletRequestBuilder from(MockHttpServletRequestBuilder b, String ip) {
        return b.with(r -> {
            r.setRemoteAddr(ip);
            return r;
        });
    }

    private ResultActions postJson(String url, Object body, String ip) throws Exception {
        return mvc.perform(from(post(url), ip).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body)));
    }

    private JsonNode json(ResultActions a) throws Exception {
        return mapper.readTree(a.andReturn().getResponse().getContentAsString());
    }

    private JsonNode register(String email, String ip) throws Exception {
        return json(postJson("/api/auth/register", Map.of("email", email, "password", PW), ip).andExpect(status().isCreated()));
    }

    private ResultActions me(String access) throws Exception {
        return mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + access));
    }

    @Test
    void refreshRotatesAndDetectsReuse() throws Exception {
        JsonNode s = register(email(), "10.0.1.1");
        assertThat(s.get("refreshToken").asText()).hasSizeGreaterThan(30);
        String r1 = s.get("refreshToken").asText();

        JsonNode s2 = json(postJson("/api/auth/refresh", Map.of("refreshToken", r1), "10.0.1.1").andExpect(status().isOk()));
        String r2 = s2.get("refreshToken").asText();
        assertThat(r2).isNotEqualTo(r1);
        me(s2.get("token").asText()).andExpect(status().isOk());

        // 旧的刷新令牌再次出现：判定为被盗用，作废全部令牌
        postJson("/api/auth/refresh", Map.of("refreshToken", r1), "10.0.1.1")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("refresh_reused"));
        postJson("/api/auth/refresh", Map.of("refreshToken", r2), "10.0.1.1").andExpect(status().isUnauthorized());
        me(s2.get("token").asText()).andExpect(status().isUnauthorized());
        me(s.get("token").asText()).andExpect(status().isUnauthorized());

        postJson("/api/auth/refresh", Map.of("refreshToken", "not-a-real-token"), "10.0.1.1")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("refresh_invalid"));
    }

    @Test
    void logoutAndLogoutAll() throws Exception {
        String e = email();
        JsonNode a = register(e, "10.0.2.1");
        JsonNode b = json(postJson("/api/auth/login", Map.of("email", e, "password", PW), "10.0.2.1").andExpect(status().isOk()));

        // 退出当前设备：这台设备的刷新令牌失效，另一台不受影响
        postJson("/api/auth/logout", Map.of("refreshToken", a.get("refreshToken").asText()), "10.0.2.1").andExpect(status().isNoContent());
        me(b.get("token").asText()).andExpect(status().isOk());

        // 退出所有设备：已签发的访问令牌立即失效
        mvc.perform(post("/api/auth/logout-all").header("Authorization", "Bearer " + b.get("token").asText())).andExpect(status().isNoContent());
        me(b.get("token").asText()).andExpect(status().isUnauthorized());
        postJson("/api/auth/refresh", Map.of("refreshToken", b.get("refreshToken").asText()), "10.0.2.1").andExpect(status().isUnauthorized());

        // 重新登录后正常
        JsonNode c = json(postJson("/api/auth/login", Map.of("email", e, "password", PW), "10.0.2.1").andExpect(status().isOk()));
        me(c.get("token").asText()).andExpect(status().isOk());
    }

    @Test
    void passwordResetFlow() throws Exception {
        String e = email();
        JsonNode s = register(e, "10.0.3.1");

        postJson("/api/auth/password-reset/request", Map.of("email", e.toUpperCase()), "10.0.3.1").andExpect(status().isAccepted());
        ArgumentCaptor<String> link = ArgumentCaptor.forClass(String.class);
        verify(mailer).sendReset(eq(e), link.capture());
        assertThat(link.getValue()).startsWith("http://localhost:5173/#reset=");
        String token = link.getValue().substring(link.getValue().indexOf('=') + 1);

        postJson("/api/auth/password-reset/confirm", Map.of("token", token, "password", "brand-new-pass"), "10.0.3.1").andExpect(status().isNoContent());
        // 同一个链接只能用一次
        postJson("/api/auth/password-reset/confirm", Map.of("token", token, "password", "another-pass1"), "10.0.3.1")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("reset_invalid"));

        postJson("/api/auth/login", Map.of("email", e, "password", PW), "10.0.3.1").andExpect(status().isUnauthorized());
        postJson("/api/auth/login", Map.of("email", e, "password", "brand-new-pass"), "10.0.3.1").andExpect(status().isOk());
        // 重置后，之前的令牌全部失效
        me(s.get("token").asText()).andExpect(status().isUnauthorized());
        postJson("/api/auth/refresh", Map.of("refreshToken", s.get("refreshToken").asText()), "10.0.3.1").andExpect(status().isUnauthorized());
    }

    @Test
    void passwordResetDoesNotRevealAccountsAndIsLimited() throws Exception {
        // 不存在的邮箱：同样返回 202，但不发信
        postJson("/api/auth/password-reset/request", Map.of("email", email()), "10.0.4.1").andExpect(status().isAccepted());
        verify(mailer, never()).sendReset(anyString(), anyString());

        String e = email();
        register(e, "10.0.4.1");
        for (int i = 0; i < 4; i++) {
            postJson("/api/auth/password-reset/request", Map.of("email", e), "10.0.4.1").andExpect(status().isAccepted());
        }
        // 测试配置里同一邮箱每小时最多 2 封
        verify(mailer, times(2)).sendReset(eq(e), anyString());
    }

    @Test
    void deleteAccountRemovesEverything() throws Exception {
        String e = email();
        JsonNode s = register(e, "10.0.5.1");
        String access = s.get("token").asText();
        mvc.perform(put("/api/resumes/doc-del").header("Authorization", "Bearer " + access).contentType(MediaType.APPLICATION_JSON)
                .content("{\"baseVersion\":null,\"doc\":{\"version\":1,\"meta\":{\"title\":\"待删\"},\"modules\":[]}}"))
                .andExpect(status().isOk());
        long uid = s.at("/user/id").asLong();

        mvc.perform(post("/api/auth/account/delete").header("Authorization", "Bearer " + access).contentType(MediaType.APPLICATION_JSON)
                .content("{\"password\":\"wrong-password\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/auth/account/delete").header("Authorization", "Bearer " + access).contentType(MediaType.APPLICATION_JSON)
                .content("{\"password\":\"" + PW + "\"}"))
                .andExpect(status().isNoContent());

        assertThat(resumes.findAllByOwner(uid)).isEmpty();
        me(access).andExpect(status().isUnauthorized());
        postJson("/api/auth/login", Map.of("email", e, "password", PW), "10.0.5.1").andExpect(status().isUnauthorized());
        // 邮箱可以重新注册
        register(e, "10.0.5.1");
    }

    @Test
    void loginIsLimitedPerIp() throws Exception {
        // 测试配置：同一 IP 15 分钟内最多 25 次登录尝试（换着邮箱试也算）
        for (int i = 0; i < 25; i++) {
            postJson("/api/auth/login", Map.of("email", email(), "password", PW), "10.0.6.1").andExpect(status().isUnauthorized());
        }
        postJson("/api/auth/login", Map.of("email", email(), "password", PW), "10.0.6.1")
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("rate_limited"));
        // 其他 IP 不受影响
        postJson("/api/auth/login", Map.of("email", email(), "password", PW), "10.0.6.2").andExpect(status().isUnauthorized());
    }

    @Test
    void purgesOldDeletedResumes() throws Exception {
        JsonNode s = register(email(), "10.0.7.1");
        String access = s.get("token").asText();
        mvc.perform(put("/api/resumes/doc-old").header("Authorization", "Bearer " + access).contentType(MediaType.APPLICATION_JSON)
                .content("{\"baseVersion\":null,\"doc\":{\"version\":1,\"meta\":{\"title\":\"旧\"},\"modules\":[]}}")).andExpect(status().isOk());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/resumes/doc-old")
                .header("Authorization", "Bearer " + access)).andExpect(status().isOk());
        long uid = s.at("/user/id").asLong();
        Integer purged = tx.execute(st -> resumes.purgeDeleted(Instant.now().plusSeconds(60)));
        assertThat(purged).isGreaterThanOrEqualTo(1);
        assertThat(resumes.findAllByOwner(uid)).isEmpty();
    }
}

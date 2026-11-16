package com.ruye.server;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/** 接口级测试：真实的 Spring Security 过滤器链 + 内存 H2 */
@SpringBootTest
@AutoConfigureMockMvc
class ApiTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;

    private String uniqueEmail() {
        return "u" + UUID.randomUUID().toString().substring(0, 8) + "@example.com";
    }

    private ResultActions postJson(String url, Object body) throws Exception {
        return mvc.perform(post(url).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body)));
    }

    private String register(String email) throws Exception {
        String body = postJson("/api/auth/register", new Creds(email, "password123"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return mapper.readTree(body).get("token").asText();
    }

    record Creds(String email, String password) {}

    private String doc(String title) {
        return "{\"version\":1,\"meta\":{\"title\":\"" + title + "\",\"locale\":\"zh-CN\",\"updatedAt\":\"2026-11-16T00:00:00Z\"},"
                + "\"layout\":{\"templateId\":\"classic\",\"pageMode\":\"fit-a4\"},\"modules\":[]}";
    }

    private ResultActions putDoc(String token, String id, Long baseVersion, String docJson) throws Exception {
        String body = "{\"baseVersion\":" + (baseVersion == null ? "null" : baseVersion) + ",\"doc\":" + docJson + "}";
        return mvc.perform(put("/api/resumes/" + id).header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    @Test
    void healthIsPublic() throws Exception {
        mvc.perform(get("/api/health")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ok"));
    }

    @Test
    void registerLoginAndMe() throws Exception {
        String email = uniqueEmail();
        String token = register(email);
        mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email));

        // 邮箱大小写不敏感
        postJson("/api/auth/login", new Creds(email.toUpperCase(), "password123"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty());

        postJson("/api/auth/register", new Creds(email, "password123"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("email_taken"));
    }

    @Test
    void rejectsBadInput() throws Exception {
        postJson("/api/auth/register", new Creds("not-an-email", "password123")).andExpect(status().isBadRequest());
        postJson("/api/auth/register", new Creds(uniqueEmail(), "short")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{oops"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("invalid_json"));
    }

    @Test
    void wrongPasswordIsThrottled() throws Exception {
        String email = uniqueEmail();
        register(email);
        for (int i = 0; i < 3; i++) {
            postJson("/api/auth/login", new Creds(email, "wrong-password")).andExpect(status().isUnauthorized());
        }
        // 达到上限后，即使密码正确也暂时拒绝
        postJson("/api/auth/login", new Creds(email, "password123"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("login_locked"));
        // 不存在的邮箱与密码错误提示相同
        postJson("/api/auth/login", new Creds(uniqueEmail(), "password123"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("bad_credentials"));
    }

    @Test
    void resumesRequireAuth() throws Exception {
        mvc.perform(get("/api/resumes")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/resumes").header("Authorization", "Bearer not.a.token")).andExpect(status().isUnauthorized());
    }

    @Test
    void createUpdateConflictAndDelete() throws Exception {
        String token = register(uniqueEmail());

        putDoc(token, "doc-a", null, doc("第一版")).andExpect(status().isOk()).andExpect(jsonPath("$.version").value(1));
        putDoc(token, "doc-a", 1L, doc("第二版")).andExpect(status().isOk()).andExpect(jsonPath("$.version").value(2));

        // 另一台设备仍以版本 1 为基础写入：冲突，返回云端当前版本
        putDoc(token, "doc-a", 1L, doc("过期的修改"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("version_conflict"))
                .andExpect(jsonPath("$.current.version").value(2));
        // 新建时（baseVersion 为空）遇到已存在的文档也算冲突，不会覆盖
        putDoc(token, "doc-a", null, doc("另一台设备的同 id 文档")).andExpect(status().isConflict());

        String detail = mvc.perform(get("/api/resumes/doc-a").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        JsonNode d = mapper.readTree(detail);
        assertThat(d.get("version").asLong()).isEqualTo(2);
        assertThat(d.at("/doc/meta/title").asText()).isEqualTo("第二版");

        mvc.perform(get("/api/resumes").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("doc-a"))
                .andExpect(jsonPath("$[0].title").value("第二版"))
                .andExpect(jsonPath("$[0].deleted").value(false));

        // 删除时版本不对：不删
        mvc.perform(delete("/api/resumes/doc-a").param("baseVersion", "1").header("Authorization", "Bearer " + token))
                .andExpect(status().isConflict());
        mvc.perform(delete("/api/resumes/doc-a").param("baseVersion", "2").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(3));
        mvc.perform(get("/api/resumes/doc-a").header("Authorization", "Bearer " + token)).andExpect(status().isNotFound());
        // 软删除：列表里仍能看到 deleted 标记，其他设备据此得知已删除
        mvc.perform(get("/api/resumes").header("Authorization", "Bearer " + token))
                .andExpect(jsonPath("$[0].deleted").value(true));
        // 删除后可以重新上传（例如另一台设备上仍保留并修改了这份简历）
        putDoc(token, "doc-a", null, doc("恢复")).andExpect(status().isOk()).andExpect(jsonPath("$.version").value(4));
    }

    @Test
    void keepsRevisionsAndRestoresFromTrash() throws Exception {
        String token = register(uniqueEmail());
        String id = "doc-rev" + UUID.randomUUID().toString().substring(0, 6);
        putDoc(token, id, null, doc("第一版")).andExpect(status().isOk());
        putDoc(token, id, 1L, doc("第二版")).andExpect(status().isOk());
        // 十分钟内再写：不再留档，避免自动同步把历史挤满
        putDoc(token, id, 2L, doc("第三版")).andExpect(status().isOk());

        mvc.perform(get("/api/resumes/" + id + "/revisions").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].current").value(true))
                .andExpect(jsonPath("$[0].title").value("第三版"))
                .andExpect(jsonPath("$[1].version").value(1))
                .andExpect(jsonPath("$[1].title").value("第一版"));
        mvc.perform(get("/api/resumes/" + id + "/revisions/1").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.doc.meta.title").value("第一版"));

        // 删除前总会留档：回收站里还能看到删除时的内容，并按原 id 恢复
        mvc.perform(delete("/api/resumes/" + id + "?baseVersion=3").header("Authorization", "Bearer " + token)).andExpect(status().isOk());
        mvc.perform(get("/api/resumes/" + id + "/revisions").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].current").value(false))
                .andExpect(jsonPath("$[0].version").value(3))
                .andExpect(jsonPath("$[0].title").value("第三版"));
        putDoc(token, id, null, doc("第三版")).andExpect(status().isOk());
        mvc.perform(get("/api/resumes/" + id).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.doc.meta.title").value("第三版"));

        // 别人看不到这份简历的历史
        String other = register(uniqueEmail());
        mvc.perform(get("/api/resumes/" + id + "/revisions").header("Authorization", "Bearer " + other)).andExpect(status().isNotFound());
        mvc.perform(get("/api/resumes/" + id + "/revisions/1").header("Authorization", "Bearer " + other)).andExpect(status().isNotFound());
    }

    @Test
    void usersCannotSeeEachOthersResumes() throws Exception {
        String alice = register(uniqueEmail());
        String bob = register(uniqueEmail());
        putDoc(alice, "doc-x", null, doc("Alice 的简历")).andExpect(status().isOk());

        mvc.perform(get("/api/resumes/doc-x").header("Authorization", "Bearer " + bob)).andExpect(status().isNotFound());
        mvc.perform(get("/api/resumes").header("Authorization", "Bearer " + bob)).andExpect(jsonPath("$.length()").value(0));
        // 同一个 id 在不同账号下互不影响
        putDoc(bob, "doc-x", null, doc("Bob 的简历")).andExpect(status().isOk()).andExpect(jsonPath("$.version").value(1));
        mvc.perform(delete("/api/resumes/doc-x").header("Authorization", "Bearer " + bob)).andExpect(status().isOk());
        mvc.perform(get("/api/resumes/doc-x").header("Authorization", "Bearer " + alice))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.doc.meta.title").value("Alice 的简历"));
    }

    @Test
    void validatesDocuments() throws Exception {
        String token = register(uniqueEmail());
        putDoc(token, "bad id!", null, doc("x")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("invalid_id"));
        putDoc(token, "doc-v", null, "{\"version\":2}").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("invalid_document"));
        putDoc(token, "doc-v", null, "[1,2]").andExpect(status().isBadRequest());
        String huge = doc("x".repeat(30000));
        putDoc(token, "doc-big", null, huge).andExpect(status().isPayloadTooLarge());
    }

    @Test
    void limitsDocumentsPerUser() throws Exception {
        String token = register(uniqueEmail());
        for (int i = 0; i < 3; i++) putDoc(token, "doc-" + i, null, doc("第 " + i + " 份")).andExpect(status().isOk());
        putDoc(token, "doc-4", null, doc("超出")).andExpect(status().isUnprocessableEntity());
        // 已有的仍可更新
        putDoc(token, "doc-0", 1L, doc("更新")).andExpect(status().isOk());
    }

    @Test
    void corsAllowsConfiguredOriginOnly() throws Exception {
        mvc.perform(options("/api/resumes").header("Origin", "http://localhost:5173").header("Access-Control-Request-Method", "PUT"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"));
        mvc.perform(options("/api/resumes").header("Origin", "https://evil.example").header("Access-Control-Request-Method", "PUT"))
                .andExpect(status().isForbidden());
    }
}

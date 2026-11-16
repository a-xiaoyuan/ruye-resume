package com.ruye.server.resume;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Objects;
import java.util.regex.Pattern;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ruye.server.auth.UserAccountRepository;
import com.ruye.server.common.ApiException;
import com.ruye.server.common.ConflictException;
import com.ruye.server.config.RuyeProperties;

@Service
public class ResumeService {

    private static final Pattern CLIENT_ID = Pattern.compile("^[A-Za-z0-9_-]{1,64}$");

    private final ResumeRepository resumes;
    private final UserAccountRepository users;
    private final ObjectMapper mapper;
    private final RuyeProperties props;

    public ResumeService(ResumeRepository resumes, UserAccountRepository users, ObjectMapper mapper, RuyeProperties props) {
        this.resumes = resumes;
        this.users = users;
        this.mapper = mapper;
        this.props = props;
    }

    @Transactional(readOnly = true)
    public List<ResumeDtos.Summary> list(long userId) {
        return resumes.findAllByOwner(userId).stream().map(ResumeDtos.Summary::of).toList();
    }

    @Transactional(readOnly = true)
    public ResumeDtos.Detail get(long userId, String clientId) {
        ResumeDocument r = resumes.findOne(userId, checkId(clientId))
                .filter(x -> !x.isDeleted())
                .orElseThrow(ResumeService::notFound);
        return detail(r);
    }

    @Transactional
    public ResumeDtos.WriteResult put(long userId, String clientId, ResumeDtos.PutRequest req) {
        checkId(clientId);
        JsonNode doc = req.doc();
        if (!doc.isObject() || doc.path("version").asInt(-1) != 1) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "invalid_document", "简历文件格式不对：需要 version 为 1 的如页文档");
        }
        String content = serialize(doc);
        if (content.getBytes(StandardCharsets.UTF_8).length > props.limits().maxDocumentBytes()) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "document_too_large", "这份简历太大了（通常是照片过大），请换一张更小的照片");
        }
        String title = clip(doc.path("meta").path("title").asText(""), 200);
        if (title.isBlank()) title = "未命名简历";
        String alias = doc.path("meta").hasNonNull("alias") ? clip(doc.path("meta").path("alias").asText(""), 100) : null;

        ResumeDocument r = resumes.findOneForUpdate(userId, clientId).orElse(null);
        if (r == null) {
            if (resumes.countActive(userId) >= props.limits().maxDocumentsPerUser()) {
                throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "too_many_documents", "云端最多保存 " + props.limits().maxDocumentsPerUser() + " 份简历");
            }
            r = new ResumeDocument(users.getReferenceById(userId), clientId);
        } else if (!(r.isDeleted() && req.baseVersion() == null) && !Objects.equals(req.baseVersion(), r.getVersion())) {
            // 云端已被其他设备改过（或已删除）：不覆盖，让客户端决定
            throw new ConflictException("云端的这份简历已在其他设备上修改过", ResumeDtos.Summary.of(r));
        }
        r.write(title, alias, content);
        ResumeDocument saved = resumes.saveAndFlush(r);
        return new ResumeDtos.WriteResult(saved.getClientId(), saved.getVersion(), saved.getUpdatedAt().toEpochMilli());
    }

    /** 软删除。传了 baseVersion 时同样做版本检查，避免删掉别的设备刚写入的内容 */
    @Transactional
    public ResumeDtos.WriteResult delete(long userId, String clientId, Long baseVersion) {
        ResumeDocument r = resumes.findOneForUpdate(userId, checkId(clientId))
                .filter(x -> !x.isDeleted())
                .orElseThrow(ResumeService::notFound);
        if (baseVersion != null && baseVersion != r.getVersion()) {
            throw new ConflictException("云端的这份简历已在其他设备上修改过，未删除", ResumeDtos.Summary.of(r));
        }
        r.markDeleted();
        return new ResumeDtos.WriteResult(r.getClientId(), r.getVersion(), r.getUpdatedAt().toEpochMilli());
    }

    private ResumeDtos.Detail detail(ResumeDocument r) {
        try {
            return new ResumeDtos.Detail(r.getClientId(), r.getVersion(), r.getUpdatedAt().toEpochMilli(), mapper.readTree(r.getContent()));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("数据库中的简历内容已损坏：" + r.getId(), e);
        }
    }

    private String serialize(JsonNode doc) {
        try {
            return mapper.writeValueAsString(doc);
        } catch (JsonProcessingException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "invalid_json", "简历内容无法序列化");
        }
    }

    private static String checkId(String clientId) {
        if (clientId == null || !CLIENT_ID.matcher(clientId).matches()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "invalid_id", "简历 id 只能包含字母、数字、下划线和连字符，最长 64 个字符");
        }
        return clientId;
    }

    private static String clip(String s, int max) {
        String t = s.strip();
        return t.codePointCount(0, t.length()) <= max ? t : t.substring(0, t.offsetByCodePoints(0, max));
    }

    private static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "not_found", "云端没有这份简历");
    }
}

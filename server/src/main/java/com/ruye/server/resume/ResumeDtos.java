package com.ruye.server.resume;

import com.fasterxml.jackson.databind.JsonNode;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public final class ResumeDtos {
    private ResumeDtos() {}

    /** 列表项：不含正文，用于判断哪些需要同步 */
    public record Summary(String id, String title, String alias, long version, long updatedAt, boolean deleted) {
        static Summary of(ResumeDocument r) {
            return new Summary(r.getClientId(), r.getTitle(), r.getAlias(), r.getVersion(), r.getUpdatedAt().toEpochMilli(), r.isDeleted());
        }
    }

    public record Detail(String id, long version, long updatedAt, JsonNode doc) {}

    /**
     * 写入请求。baseVersion 是客户端上次同步到的版本：
     * 新建时为 null；与云端当前版本不一致时返回 409，客户端需要先处理冲突。
     */
    public record PutRequest(@PositiveOrZero Long baseVersion, @NotNull(message = "不能为空") JsonNode doc) {}

    public record WriteResult(String id, long version, long updatedAt) {}
}

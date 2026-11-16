package com.ruye.server.common;

import org.springframework.http.HttpStatus;

/** 版本冲突：云端已被其他设备更新。附带云端当前版本的摘要，前端据此决定如何合并 */
public class ConflictException extends ApiException {
    private final Object current;

    public ConflictException(String message, Object current) {
        super(HttpStatus.CONFLICT, "version_conflict", message);
        this.current = current;
    }

    public Object current() {
        return current;
    }
}

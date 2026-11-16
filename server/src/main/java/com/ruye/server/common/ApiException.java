package com.ruye.server.common;

import org.springframework.http.HttpStatus;

/** 业务异常：带 HTTP 状态码和给用户看的中文说明，由 ApiExceptionHandler 转成 ProblemDetail */
public class ApiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;

    public ApiException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public HttpStatus status() {
        return status;
    }

    public String code() {
        return code;
    }
}

package com.ruye.server.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class AuthDtos {
    private AuthDtos() {}

    public record Credentials(
            @NotBlank(message = "不能为空") @Email(message = "格式不正确") @Size(max = 254, message = "太长") String email,
            @NotBlank(message = "不能为空") @Size(min = 8, max = 72, message = "长度需要在 8～72 个字符之间") String password) {}

    public record UserView(long id, String email) {}

    public record TokenResponse(String token, long expiresAt, UserView user) {}
}

# 如页云同步后端（可选）

如页默认**不需要账号**，所有内容只保存在浏览器本地。这个后端是可选的：部署后，用户可以注册登录，把多份简历同步到服务器，换电脑也能接着编辑。不登录时前端完全不访问它。

技术栈：Java 17 · Spring Boot 3.4 · Spring Security（JWT，HS256）· Spring Data JPA · H2（默认）/ MySQL。

## 本地运行

需要 JDK 17+ 和 Maven 3.9+（或直接用 IntelliJ IDEA 打开 `server/pom.xml`）。

```bash
cd server
mvn test             # 接口测试：注册登录、限流、版本冲突、越权访问、CORS
mvn spring-boot:run  # 启动在 http://localhost:8080，数据存在 server/data/ 下的 H2 文件里
```

然后在仓库根目录用后端地址启动前端：

```bash
VITE_RUYE_API=/ pnpm dev
# Windows PowerShell：$env:VITE_RUYE_API="/"; pnpm dev
```

`/` 表示同源：开发服务器把 `/api` 代理到 `http://localhost:8080`（可用 `RUYE_API_TARGET` 修改），不涉及跨域。
线上如果前后端在同一域名下（例如 Nginx 把 `/api` 转给后端），同样用 `/`；分开部署时写后端完整地址，并在后端的 `RUYE_CORS_ORIGINS` 里放行前端域名。

顶栏会出现「登录 / 同步」按钮。没有设置 `VITE_RUYE_API` 时，前端不显示登录入口（GitHub Pages 上的在线 Demo 就是这样）。

## 配置（环境变量）

| 变量 | 默认值 | 说明 |
|---|---|---|
| `RUYE_JWT_SECRET` | 开发用的固定值 | **生产环境必须设置**，至少 32 个字符，例如 `openssl rand -base64 48` |
| `RUYE_JWT_TTL` | `15m` | 访问令牌有效期（过期后前端自动用刷新令牌换新） |
| `RUYE_REFRESH_TTL` | `30d` | 刷新令牌有效期，即「多久不用就要重新登录」 |
| `RUYE_PUBLIC_URL` | `http://localhost:5173` | 前端地址，用来拼找回密码链接 |
| `RUYE_MAIL_HOST` / `RUYE_MAIL_PORT` / `RUYE_MAIL_USER` / `RUYE_MAIL_PASSWORD` | 空 | 发找回密码邮件的 SMTP。不配置时链接只写进日志（开发用） |
| `RUYE_RATE_LIMIT_STORE` | `memory` | 限流计数存哪：`memory` 单机，`redis` 多实例共享（再设 `RUYE_REDIS_HOST` / `RUYE_REDIS_PORT`） |
| `RUYE_CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | 允许访问的前端地址，逗号分隔 |
| `RUYE_DB_URL` / `RUYE_DB_USER` / `RUYE_DB_PASSWORD` | 文件版 H2 | 数据库连接；用 MySQL 时同时设置 `SPRING_PROFILES_ACTIVE=mysql`，表结构见 `src/main/resources/db/schema-mysql.sql` |
| `PORT` | `8080` | 端口 |

也可以用 Docker：见 `Dockerfile` 顶部的注释。

## 接口

所有错误都是 RFC 9457 ProblemDetail，带 `code` 字段（如 `email_taken`、`bad_credentials`、`version_conflict`）。

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/register` | `{email, password}` → `{token, expiresAt, user}`；密码 8～72 位，BCrypt 存储 |
| POST | `/api/auth/login` | 同上。同一邮箱连续失败 5 次锁定 15 分钟；同一 IP 15 分钟最多 30 次；邮箱不存在与密码错误提示相同 |
| POST | `/api/auth/refresh` | `{refreshToken}` → 新的一组令牌。旧刷新令牌立即作废；作废的令牌再次出现会退出该账号所有设备 |
| POST | `/api/auth/logout` | `{refreshToken}`：退出当前设备 |
| POST | `/api/auth/logout-all` | 退出所有设备：作废全部刷新令牌，已签发的访问令牌也立即失效 |
| POST | `/api/auth/password-reset/request` | `{email}` → 202。邮箱是否注册都返回成功；同一邮箱每小时最多 3 封 |
| POST | `/api/auth/password-reset/confirm` | `{token, password}`：链接 30 分钟有效、只能用一次；成功后退出所有设备 |
| POST | `/api/auth/account/delete` | `{password}`：注销账号，彻底删除账号、云端简历和令牌 |
| GET | `/api/auth/me` | 当前用户 |
| GET | `/api/resumes` | 简历列表（不含正文）：`id, title, alias, version, updatedAt, deleted` |
| GET | `/api/resumes/{id}` | 一份简历的完整内容 |
| PUT | `/api/resumes/{id}` | `{baseVersion, doc}`：新建时 `baseVersion` 为 `null`；与云端版本不一致返回 **409**，附带云端当前摘要，不会覆盖 |
| DELETE | `/api/resumes/{id}?baseVersion=` | 软删除，内容保留 |

## 设计要点

- **两种令牌**：访问令牌是 JWT（HS256，15 分钟），带令牌版本 `tv`；刷新令牌是随机串，库里只存 SHA-256 摘要。每次刷新都轮换，作废的刷新令牌被再次使用时判定为被盗，作废该账号全部令牌。
- **服务端可以让令牌立即失效**：退出所有设备、重置密码、注销账号都会让账号的令牌版本加一，校验访问令牌时比对版本（每个请求按主键查一次用户表）。
- **限流**：按 IP 挡「换着邮箱试」，按邮箱挡「对一个账号猜密码」；注册、找回密码同样限次。计数接口有内存和 Redis 两种实现。部署在反向代理后面时设置 `server.forward-headers-strategy=native`，否则所有人共用代理的 IP。
- **定时清理**：每天凌晨彻底删除软删除超过 30 天的简历、过期或作废的令牌。

- **云端只是同步副本**：简历内容（前端的 RuyeDocument JSON）原样存储，后端只抽出标题与备注名做列表；校验与排版仍在浏览器里完成。
- **乐观锁防覆盖**：每次写入版本号加一，写入时带上自己基于的版本；不一致就 409。写入前对该行加悲观锁，同一份简历的并发写入串行执行。
- **不丢内容**：删除是软删除；前端遇到冲突时把云端版本另存为一份新简历，而不是二选一丢掉。
- **账号隔离**：所有查询都带 `owner_id` 条件，访问别人的简历一律 404。
- **限额**：单份简历 3MB（主要是照片），每个账号 50 份。

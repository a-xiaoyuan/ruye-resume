// 云同步后端的 HTTP 客户端。只有构建时设置了 VITE_RUYE_API 才会启用；
// 没设置时 cloudEnabled() 为 false，界面不显示登录入口，也不会发出任何请求。
//
// 令牌：访问令牌短期有效（默认 15 分钟），快过期或收到 401 时用刷新令牌换一组新的。
// 刷新令牌每次使用后都会作废（轮换），后端发现作废的令牌被再次使用会退出所有设备。
// 所以同一浏览器的多个标签页必须排队刷新：用 Web Locks 加锁，拿到锁后先看别的标签页是否已经刷新过。

import type { RuyeDocument } from "../../../packages/schema/src/index.ts";

export interface CloudUser {
  id: number;
  email: string;
}

export interface RemoteSummary {
  id: string;
  title: string;
  alias: string | null;
  version: number;
  updatedAt: number;
  deleted: boolean;
}

export interface WriteResult {
  id: string;
  version: number;
  updatedAt: number;
}

export interface Session {
  token: string;
  /** 访问令牌过期时间（毫秒时间戳） */
  expiresAt: number;
  refreshToken: string;
  refreshExpiresAt: number;
  user: CloudUser;
}

/** 接口返回的错误：带 HTTP 状态码和后端的 code（如 version_conflict） */
export class CloudError extends Error {
  readonly status: number;
  readonly code: string;
  readonly current?: RemoteSummary;
  constructor(message: string, status: number, code: string, current?: RemoteSummary) {
    super(message);
    this.status = status;
    this.code = code;
    this.current = current;
  }
}

const SESSION_KEY = "ruye:cloud-session";
/** 访问令牌剩余不到 30 秒就提前刷新 */
const REFRESH_EARLY_MS = 30_000;

/**
 * 后端地址。未设置时返回 null（不启用云同步）；
 * 设为 "/" 表示与前端同源（前后端部署在同一域名下，或开发时走 Vite 的 /api 代理），返回空字符串
 */
export function apiBase(): string | null {
  const v = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_RUYE_API;
  if (!v || v.trim() === "") return null;
  return v.trim().replace(/\/+$/, "");
}

export const cloudEnabled = (): boolean => apiBase() !== null;

function requireBase(): string {
  const base = apiBase();
  if (base === null) throw new CloudError("没有配置同步服务器", 0, "disabled");
  return base;
}

/** 读取保存的登录状态。刷新令牌过期（或格式不对）时视为未登录 */
export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (typeof s?.token !== "string" || typeof s.refreshToken !== "string" || typeof s.refreshExpiresAt !== "number") return null;
    if (s.refreshExpiresAt <= Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}

export function saveSession(s: Session | null): void {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // 记不住登录状态只影响下次是否需要重新登录
  }
}

export interface CloudApi {
  list(): Promise<RemoteSummary[]>;
  get(id: string): Promise<{ id: string; version: number; updatedAt: number; doc: unknown }>;
  put(id: string, baseVersion: number | null, doc: RuyeDocument): Promise<WriteResult>;
  remove(id: string, baseVersion: number): Promise<WriteResult>;
}

async function request<T>(base: string, path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  let res: Response;
  try {
    res = await fetch(base + path, { ...init, headers });
  } catch {
    throw new CloudError("连不上同步服务器，请检查网络", 0, "network");
  }
  const text = await res.text();
  const body = text ? safeJson(text) : null;
  if (!res.ok) {
    const b = (body ?? {}) as { detail?: string; code?: string; current?: RemoteSummary };
    const fallback = res.status === 401 ? "登录已失效，请重新登录" : res.status === 429 ? "操作太频繁，请稍后再试" : `服务器返回 ${res.status}`;
    throw new CloudError(b.detail || fallback, res.status, b.code ?? (res.status === 401 ? "unauthorized" : "http_error"), b.current);
  }
  return body as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const post = (path: string, body: unknown) => request<unknown>(requireBase(), path, { method: "POST", body: JSON.stringify(body) });

export async function register(email: string, password: string): Promise<Session> {
  return (await post("/api/auth/register", { email, password })) as Session;
}

export async function login(email: string, password: string): Promise<Session> {
  return (await post("/api/auth/login", { email, password })) as Session;
}

/** 申请重置密码。邮箱是否注册都返回成功（后端不暴露账号是否存在） */
export async function requestPasswordReset(email: string): Promise<void> {
  await post("/api/auth/password-reset/request", { email });
}

export async function confirmPasswordReset(token: string, password: string): Promise<void> {
  await post("/api/auth/password-reset/confirm", { token, password });
}

/** 在 Web Locks 可用时，同一浏览器的所有标签页排队执行；不可用时直接执行 */
export async function withLock<T>(name: string, fn: () => Promise<T>, opts: { ifAvailable?: boolean } = {}): Promise<T | undefined> {
  const locks = (globalThis.navigator as Navigator | undefined)?.locks;
  if (!locks) return fn();
  if (opts.ifAvailable) {
    return locks.request(name, { ifAvailable: true }, async (lock) => (lock ? fn() : undefined));
  }
  return locks.request(name, fn);
}

export interface SessionStore {
  get(): Session | null;
  /** 保存新会话；null 表示会话失效（需要重新登录） */
  set(s: Session | null): void;
}

export const localSessionStore: SessionStore = { get: loadSession, set: saveSession };

/**
 * 带自动刷新的客户端。所有需要登录的请求都通过它发出：
 * 访问令牌快过期时先刷新；请求返回 401 时刷新一次再重试；刷新失败则清空会话。
 */
export function createClient(store: SessionStore = localSessionStore, base: string = requireBase()) {

  const refresh = async (stale: Session): Promise<Session> => {
    const next = await withLock("ruye-cloud-refresh", async () => {
      // 拿到锁后先看看：别的标签页可能已经用这个刷新令牌换过新的了
      const current = store.get();
      if (current && current.refreshToken !== stale.refreshToken) return current;
      try {
        const s = (await request<Session>(base, "/api/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken: stale.refreshToken }) })) as Session;
        store.set(s);
        return s;
      } catch (e) {
        if (e instanceof CloudError && e.status === 401) store.set(null);
        throw e;
      }
    });
    return next!;
  };

  const validSession = async (): Promise<Session> => {
    const s = store.get();
    if (!s) throw new CloudError("请先登录", 401, "unauthorized");
    return s.expiresAt - REFRESH_EARLY_MS > Date.now() ? s : refresh(s);
  };

  const authed = async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    let s = await validSession();
    try {
      return await request<T>(base, path, { ...init, token: s.token });
    } catch (e) {
      if (!(e instanceof CloudError) || e.status !== 401) throw e;
      // 访问令牌被提前作废（例如在别的设备上「退出所有设备」）：刷新一次再试
      s = await refresh(s);
      return request<T>(base, path, { ...init, token: s.token });
    }
  };

  const enc = encodeURIComponent;
  const api: CloudApi = {
    list: () => authed("/api/resumes"),
    get: (id) => authed(`/api/resumes/${enc(id)}`),
    put: (id, baseVersion, doc) => authed(`/api/resumes/${enc(id)}`, { method: "PUT", body: JSON.stringify({ baseVersion, doc }) }),
    remove: (id, baseVersion) => authed(`/api/resumes/${enc(id)}?baseVersion=${baseVersion}`, { method: "DELETE" }),
  };

  return {
    api,
    /** 退出当前设备：通知后端作废刷新令牌（失败也照常退出），再清空本机会话 */
    async logout() {
      const s = store.get();
      store.set(null);
      if (s) await request(base, "/api/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken: s.refreshToken }) }).catch(() => undefined);
    },
    /** 退出所有设备：其他设备上的登录立即失效 */
    async logoutAll() {
      await authed("/api/auth/logout-all", { method: "POST" });
      store.set(null);
    },
    /** 注销账号：删除云端账号与全部云端简历，本机内容不受影响 */
    async deleteAccount(password: string) {
      await authed("/api/auth/account/delete", { method: "POST", body: JSON.stringify({ password }) });
      store.set(null);
    },
  };
}

export type CloudClient = ReturnType<typeof createClient>;

/** 找回密码链接形如 …/#reset=<token>；读出后由调用方清掉地址栏里的令牌 */
export function readResetToken(hash: string): string | null {
  const m = hash.match(/^#reset=([A-Za-z0-9_-]{20,})$/);
  return m ? m[1] : null;
}

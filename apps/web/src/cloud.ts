// 云同步后端的 HTTP 客户端。只有构建时设置了 VITE_RUYE_API 才会启用；
// 没设置时 cloudEnabled() 为 false，界面不显示登录入口，也不会发出任何请求。

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
  expiresAt: number;
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

export function apiBase(): string | null {
  const v = (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_RUYE_API;
  return v && v.trim() !== "" ? v.trim().replace(/\/+$/, "") : null;
}

export const cloudEnabled = (): boolean => apiBase() !== null;

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (typeof s?.token !== "string" || typeof s.expiresAt !== "number" || s.expiresAt <= Date.now()) return null;
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
    const fallback = res.status === 401 ? "登录已失效，请重新登录" : `服务器返回 ${res.status}`;
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

export async function register(email: string, password: string): Promise<Session> {
  const base = apiBase();
  if (!base) throw new CloudError("没有配置同步服务器", 0, "disabled");
  return request<Session>(base, "/api/auth/register", { method: "POST", body: JSON.stringify({ email, password }) });
}

export async function login(email: string, password: string): Promise<Session> {
  const base = apiBase();
  if (!base) throw new CloudError("没有配置同步服务器", 0, "disabled");
  return request<Session>(base, "/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
}

export function createApi(token: string): CloudApi {
  const base = apiBase();
  if (!base) throw new CloudError("没有配置同步服务器", 0, "disabled");
  const enc = encodeURIComponent;
  return {
    list: () => request(base, "/api/resumes", { token }),
    get: (id) => request(base, `/api/resumes/${enc(id)}`, { token }),
    put: (id, baseVersion, doc) => request(base, `/api/resumes/${enc(id)}`, { method: "PUT", token, body: JSON.stringify({ baseVersion, doc }) }),
    remove: (id, baseVersion) => request(base, `/api/resumes/${enc(id)}?baseVersion=${baseVersion}`, { method: "DELETE", token }),
  };
}

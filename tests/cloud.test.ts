import { test } from "node:test";
import assert from "node:assert/strict";
import { CloudError, createClient, readResetToken, type Session, type SessionStore } from "../apps/web/src/cloud.ts";

function session(n: number, expiresInMs: number): Session {
  return { token: `access-${n}`, expiresAt: Date.now() + expiresInMs, refreshToken: `refresh-${n}`, refreshExpiresAt: Date.now() + 86_400_000, user: { id: 1, email: "a@example.com" } };
}

function memStore(initial: Session | null) {
  let s = initial;
  const sets: (Session | null)[] = [];
  const store: SessionStore = { get: () => s, set: (x) => (sets.push(x), (s = x)) };
  return { store, sets, get: () => s };
}

/** 假后端：记录请求，按路径返回 */
function fakeFetch(handler: (url: string, init: RequestInit) => { status: number; body?: unknown }) {
  const calls: { url: string; auth?: string; body?: string }[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    const headers = (init.headers ?? {}) as Record<string, string>;
    calls.push({ url, auth: headers.Authorization, body: init.body as string | undefined });
    const r = handler(url, init);
    return new Response(r.body === undefined ? "" : JSON.stringify(r.body), { status: r.status });
  }) as typeof fetch;
  return { calls, restore: () => (globalThis.fetch = original) };
}

test("访问令牌快过期时先刷新，再带新令牌请求", async () => {
  const m = memStore(session(1, 5_000));
  const f = fakeFetch((url) => (url.endsWith("/api/auth/refresh") ? { status: 200, body: session(2, 900_000) } : { status: 200, body: [] }));
  try {
    await createClient(m.store, "").api.list();
    assert.deepEqual(f.calls.map((c) => c.url), ["/api/auth/refresh", "/api/resumes"]);
    assert.equal(JSON.parse(f.calls[0].body!).refreshToken, "refresh-1");
    assert.equal(f.calls[1].auth, "Bearer access-2");
    assert.equal(m.get()!.refreshToken, "refresh-2");
  } finally {
    f.restore();
  }
});

test("请求返回 401（令牌被提前作废）时刷新一次再重试", async () => {
  const m = memStore(session(1, 900_000));
  let first = true;
  const f = fakeFetch((url) => {
    if (url.endsWith("/api/auth/refresh")) return { status: 200, body: session(2, 900_000) };
    if (first) {
      first = false;
      return { status: 401, body: { code: "unauthorized" } };
    }
    return { status: 200, body: [] };
  });
  try {
    await createClient(m.store, "").api.list();
    assert.deepEqual(f.calls.map((c) => c.auth ?? "refresh"), ["Bearer access-1", "refresh", "Bearer access-2"]);
  } finally {
    f.restore();
  }
});

test("刷新失败（401）时清空会话并抛出", async () => {
  const m = memStore(session(1, 0));
  const f = fakeFetch(() => ({ status: 401, body: { code: "refresh_reused", detail: "检测到登录凭证被重复使用" } }));
  try {
    await assert.rejects(createClient(m.store, "").api.list(), (e: unknown) => e instanceof CloudError && e.code === "refresh_reused");
    assert.equal(m.get(), null);
  } finally {
    f.restore();
  }
});

test("其他标签页已经刷新过：直接用新的会话，不再用旧刷新令牌（避免触发重用检测）", async () => {
  const stale = session(1, 0);
  const fresh = session(2, 900_000);
  // 读取时已经是别的标签页刷新后的会话
  let reads = 0;
  const store: SessionStore = { get: () => (reads++ === 0 ? stale : fresh), set: () => undefined };
  const f = fakeFetch(() => ({ status: 200, body: [] }));
  try {
    await createClient(store, "").api.list();
    assert.deepEqual(f.calls.map((c) => c.url), ["/api/resumes"]);
    assert.equal(f.calls[0].auth, "Bearer access-2");
  } finally {
    f.restore();
  }
});

test("退出登录：先清空本机会话，再通知后端；后端不可用也照常退出", async () => {
  const m = memStore(session(1, 900_000));
  const f = fakeFetch(() => {
    throw new Error("offline");
  });
  try {
    await createClient(m.store, "").logout();
    assert.equal(m.get(), null);
  } finally {
    f.restore();
  }
});

test("找回密码链接解析", () => {
  assert.equal(readResetToken("#reset=abcdefghijklmnopqrstuvwxyz_-0123456789AB"), "abcdefghijklmnopqrstuvwxyz_-0123456789AB");
  assert.equal(readResetToken("#reset=short"), null);
  assert.equal(readResetToken("#reset=<script>"), null);
  assert.equal(readResetToken(""), null);
});

// 顶栏的账号与云同步入口。只有构建时配置了 VITE_RUYE_API 才显示；
// 不登录时一切照旧，内容只在本机。登录后自动在后台同步，退出登录不会删除本机内容。
import { useCallback, useEffect, useRef, useState } from "react";
import { cloudEnabled, CloudError, createApi, loadSession, login, register, saveSession, type Session } from "../cloud.ts";
import { describeReport, loadSyncState, runSync, saveSyncState, type LocalStore } from "../sync.ts";
import { Icon } from "./icons.tsx";

type Status = { phase: "idle" | "syncing" | "ok" | "error"; text: string; at?: number };

interface Options {
  /** 当前文档的变化计数：变了就在稍后自动同步 */
  revision: unknown;
  store: LocalStore;
  /** 当前打开的简历被云端版本替换了：重新载入 */
  onReplaced: (ids: string[]) => void;
  onNotice: (text: string, level?: "info" | "error") => void;
}

export function useCloudSync({ revision, store, onReplaced, onNotice }: Options) {
  const enabled = cloudEnabled();
  const [session, setSession] = useState<Session | null>(() => (enabled ? loadSession() : null));
  const [status, setStatus] = useState<Status>({ phase: "idle", text: "" });
  const running = useRef(false);
  const latest = useRef({ store, onReplaced, onNotice });
  latest.current = { store, onReplaced, onNotice };

  const logout = useCallback((reason?: string) => {
    saveSession(null);
    setSession(null);
    setStatus({ phase: "idle", text: "" });
    if (reason) latest.current.onNotice(reason, "error");
  }, []);

  const syncNow = useCallback(
    async (s: Session | null = session) => {
      if (!s || running.current) return;
      running.current = true;
      setStatus((x) => ({ ...x, phase: "syncing", text: "正在同步…" }));
      try {
        const { state, report } = await runSync(createApi(s.token), latest.current.store, loadSyncState(s.user.id));
        saveSyncState(s.user.id, state);
        const text = describeReport(report);
        setStatus({ phase: report.errors.length ? "error" : "ok", text, at: Date.now() });
        if (report.replaced.length) latest.current.onReplaced(report.replaced);
        if (report.conflicts.length || report.detached.length || report.errors.length) latest.current.onNotice(text, report.errors.length ? "error" : "info");
      } catch (e) {
        if (e instanceof CloudError && e.status === 401) logout("登录已失效，请重新登录。本机内容不受影响。");
        else setStatus({ phase: "error", text: (e as Error).message, at: Date.now() });
      } finally {
        running.current = false;
      }
    },
    [session, logout],
  );

  // 登录后立即同步一次；之后内容有变化 5 秒后同步，切回窗口时也同步
  useEffect(() => {
    if (session) void syncNow(session);
  }, [session]);
  useEffect(() => {
    if (!session) return;
    const t = setTimeout(() => void syncNow(), 5000);
    return () => clearTimeout(t);
  }, [revision, session]);
  useEffect(() => {
    if (!session) return;
    const onFocus = () => void syncNow();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [session, syncNow]);

  const signIn = async (mode: "login" | "register", email: string, password: string) => {
    const s = mode === "login" ? await login(email, password) : await register(email, password);
    saveSession(s);
    setSession(s);
  };

  return { enabled, session, status, syncNow: () => syncNow(), signIn, logout: () => logout() };
}

type Cloud = ReturnType<typeof useCloudSync>;

export function AccountMenu({ cloud }: { cloud: Cloud }) {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!cloud.enabled) return null;

  if (!cloud.session) {
    return (
      <>
        <button type="button" className="account-btn" onClick={() => setDialog(true)}>
          <Icon name="cloud" size={15} />
          登录同步
        </button>
        {dialog && <LoginDialog onClose={() => setDialog(false)} onSubmit={cloud.signIn} />}
      </>
    );
  }

  const { phase, text, at } = cloud.status;
  return (
    <div className="menu account" ref={ref}>
      <button type="button" className={`account-btn signed-in ${phase}`} aria-expanded={open} onClick={() => setOpen((x) => !x)} title={text}>
        <Icon name="cloud" size={15} />
        <span className="sync-dot" aria-hidden="true" />
        {phase === "syncing" ? "同步中" : phase === "error" ? "同步出错" : "已同步"}
      </button>
      {open && (
        <div className="menu-list right account-pop" role="menu">
          <div className="account-head">
            <Icon name="user" size={16} />
            <span>{cloud.session.user.email}</span>
          </div>
          <p className={`account-status ${phase}`}>
            {text || "登录后会自动同步，内容同时保存在本机。"}
            {at && <em>{new Date(at).toLocaleTimeString()}</em>}
          </p>
          <button type="button" role="menuitem" disabled={phase === "syncing"} onClick={() => cloud.syncNow()}>
            立即同步
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              cloud.logout();
            }}
          >
            退出登录<em>本机内容保留</em>
          </button>
        </div>
      )}
    </div>
  );
}

function LoginDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: Cloud["signIn"] }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "register" && password.length < 8) return setError("密码至少 8 位");
    setBusy(true);
    setError(null);
    try {
      await onSubmit(mode, email.trim(), password);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="dialog login-dialog" role="dialog" aria-modal="true" aria-labelledby="login-title" onSubmit={submit}>
        <h2 id="login-title">{mode === "login" ? "登录如页" : "注册如页账号"}</h2>
        <p className="dialog-sub">登录后，多份简历会同步到服务器，换电脑也能接着改。不登录也能正常使用，内容只保存在这个浏览器里。</p>
        <div className="seg" role="tablist">
          <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "on" : ""} onClick={() => setMode("login")}>
            登录
          </button>
          <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "on" : ""} onClick={() => setMode("register")}>
            注册
          </button>
        </div>
        <label className="field">
          <span>邮箱</span>
          <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </label>
        <label className="field">
          <span>密码{mode === "register" && <em>至少 8 位</em>}</span>
          <input
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={mode === "register" ? 8 : undefined}
            maxLength={72}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p className="dialog-error" role="alert">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="primary" disabled={busy}>
            {busy ? "请稍候…" : mode === "login" ? "登录" : "注册并登录"}
          </button>
        </div>
      </form>
    </div>
  );
}

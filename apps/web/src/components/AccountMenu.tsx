// 顶栏的账号与云同步入口。只有构建时配置了 VITE_RUYE_API 才显示；
// 不登录时一切照旧，内容只在本机。登录后自动在后台同步，退出登录、注销账号都不会删除本机内容。
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  cloudEnabled,
  CloudError,
  confirmPasswordReset,
  createClient,
  loadSession,
  login,
  readResetToken,
  register,
  requestPasswordReset,
  saveSession,
  withLock,
  type Session,
  type SessionStore,
} from "../cloud.ts";
import { describeReport, detachedIds, loadSyncState, reattach, runSync, saveSyncState, type LocalStore } from "../sync.ts";
import { Icon } from "./icons.tsx";

type Status = { phase: "idle" | "syncing" | "ok" | "error"; text: string; at?: number };

interface Options {
  /** 当前文档的变化计数：变了就在稍后自动同步 */
  revision: unknown;
  store: LocalStore;
  /** 当前打开的简历被云端版本替换了：重新载入 */
  onReplaced: (ids: string[]) => void;
  onNotice: (text: string, level?: "info" | "error") => void;
  /** 从云端拉下了其他设备上的简历 */
  onPulled?: (count: number) => void;
}

export function useCloudSync({ revision, store, onReplaced, onNotice, onPulled }: Options) {
  const enabled = cloudEnabled();
  const [session, setSessionState] = useState<Session | null>(() => (enabled ? loadSession() : null));
  const [status, setStatus] = useState<Status>({ phase: "idle", text: "" });
  const [detached, setDetached] = useState<string[]>([]);
  const running = useRef(false);
  const latest = useRef({ store, onReplaced, onNotice, onPulled });
  latest.current = { store, onReplaced, onNotice, onPulled };

  // 会话存储：写 localStorage 的同时更新界面；刷新失败（被设为 null）时提示重新登录
  const sessionStore = useMemo<SessionStore>(
    () => ({
      get: loadSession,
      set: (s) => {
        saveSession(s);
        setSessionState(s);
        if (!s) setStatus({ phase: "idle", text: "" });
      },
    }),
    [],
  );
  const client = useMemo(() => (enabled ? createClient(sessionStore) : null), [enabled, sessionStore]);

  // 其他标签页登录、退出或刷新了令牌：跟着更新
  useEffect(() => {
    if (!enabled) return;
    const onStorage = (e: StorageEvent) => e.key === "ruye:cloud-session" && setSessionState(loadSession());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [enabled]);

  const syncNow = useCallback(async () => {
    const s = loadSession();
    if (!s || !client || running.current) return;
    running.current = true;
    setStatus((x) => ({ ...x, phase: "syncing", text: "正在同步…" }));
    try {
      // 同一浏览器只允许一个标签页同步；另一个标签页正在同步时这一轮跳过
      const done = await withLock(
        "ruye-cloud-sync",
        async () => {
          const { state, report } = await runSync(client.api, latest.current.store, loadSyncState(s.user.id));
          saveSyncState(s.user.id, state);
          setDetached(detachedIds(state));
          return report;
        },
        { ifAvailable: true },
      );
      if (!done) {
        setStatus((x) => ({ ...x, phase: "ok", text: "其他标签页正在同步" }));
        return;
      }
      const text = describeReport(done);
      setStatus({ phase: done.errors.length ? "error" : "ok", text, at: Date.now() });
      if (done.replaced.length) latest.current.onReplaced(done.replaced);
      if (done.conflicts.length || done.detached.length || done.errors.length) latest.current.onNotice(text, done.errors.length ? "error" : "info");
      else if (done.pulled > done.replaced.length) latest.current.onPulled?.(done.pulled - done.replaced.length);
    } catch (e) {
      if (e instanceof CloudError && e.status === 401) {
        sessionStore.set(null);
        latest.current.onNotice("登录已失效，请重新登录。本机内容不受影响。", "error");
      } else setStatus({ phase: "error", text: (e as Error).message, at: Date.now() });
    } finally {
      running.current = false;
    }
  }, [client, sessionStore]);

  const userId = session?.user.id;
  // 登录后立即同步一次；之后内容有变化 5 秒后同步，切回窗口时也同步
  useEffect(() => {
    if (userId === undefined) return;
    setDetached(detachedIds(loadSyncState(userId)));
    void syncNow();
  }, [userId]);
  useEffect(() => {
    if (userId === undefined) return;
    const t = setTimeout(() => void syncNow(), 5000);
    return () => clearTimeout(t);
  }, [revision, userId]);
  useEffect(() => {
    if (userId === undefined) return;
    const onFocus = () => void syncNow();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [userId, syncNow]);

  return {
    enabled,
    session,
    api: session ? (client?.api ?? null) : null,
    status,
    detached,
    syncNow: () => void syncNow(),
    signIn: async (mode: "login" | "register", email: string, password: string) => {
      sessionStore.set(mode === "login" ? await login(email, password) : await register(email, password));
    },
    logout: () => client?.logout(),
    logoutAll: async () => {
      await client?.logoutAll();
      latest.current.onNotice("已退出所有设备。其他设备上的登录已失效，本机内容不受影响。");
    },
    deleteAccount: async (password: string) => {
      await client?.deleteAccount(password);
      latest.current.onNotice("云端账号与云端简历已删除。这台电脑上的简历都还在。");
    },
    reattachAll: () => {
      if (userId === undefined) return;
      const state = reattach(loadSyncState(userId), detachedIds(loadSyncState(userId)));
      saveSyncState(userId, state);
      setDetached([]);
      void syncNow();
    },
  };
}

type Cloud = ReturnType<typeof useCloudSync>;

export function AccountMenu({ cloud, loginSignal = 0 }: { cloud: Cloud; /** 每次加一就弹出登录框（「我的简历」页里的登录按钮用） */ loginSignal?: number }) {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<null | "login" | "delete">(null);
  useEffect(() => {
    if (loginSignal > 0 && !cloud.session) setDialog("login");
  }, [loginSignal]);
  // 打开找回密码链接（…/#reset=令牌）时直接弹出设置新密码
  const [resetToken, setResetToken] = useState<string | null>(() => (cloud.enabled ? readResetToken(window.location.hash) : null));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!resetToken) return;
    // 令牌不留在地址栏和历史记录里
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!cloud.enabled) return null;

  const resetDialog = resetToken && <ResetPasswordDialog token={resetToken} onClose={() => setResetToken(null)} onDone={() => setDialog("login")} />;

  if (!cloud.session) {
    return (
      <>
        <button type="button" className="account-btn" aria-label="登录同步" onClick={() => setDialog("login")}>
          <Icon name="cloud" size={15} />
          <span className="btn-text">登录同步</span>
        </button>
        {dialog === "login" && <LoginDialog onClose={() => setDialog(null)} onSubmit={cloud.signIn} />}
        {resetDialog}
      </>
    );
  }

  const { phase, text, at } = cloud.status;
  const pick = (fn: () => unknown) => () => {
    setOpen(false);
    fn();
  };
  return (
    <div className="menu account" ref={ref}>
      <button type="button" className={`account-btn signed-in ${phase}`} aria-expanded={open} aria-label={text || "云同步"} onClick={() => setOpen((x) => !x)} title={text}>
        <Icon name="cloud" size={15} />
        <span className="sync-dot" aria-hidden="true" />
        <span className="btn-text">{phase === "syncing" ? "同步中" : phase === "error" ? "同步出错" : "已同步"}</span>
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
          {cloud.detached.length > 0 && (
            <div className="account-detached">
              <span>{cloud.detached.length} 份简历已在其他设备删除，这台电脑上保留着，没有再同步。</span>
              <button type="button" onClick={pick(cloud.reattachAll)}>
                重新同步它们
              </button>
            </div>
          )}
          <button type="button" role="menuitem" disabled={phase === "syncing"} onClick={pick(cloud.syncNow)}>
            立即同步
          </button>
          <button type="button" role="menuitem" onClick={pick(cloud.logout)}>
            退出登录<em>本机内容保留</em>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={pick(() => {
              if (confirm("退出所有设备？其他电脑和浏览器上的登录会立即失效，这台也需要重新登录。")) void cloud.logoutAll().catch((e: Error) => alert(e.message));
            })}
          >
            退出所有设备
          </button>
          <button type="button" role="menuitem" className="danger" onClick={pick(() => setDialog("delete"))}>
            注销账号…
          </button>
        </div>
      )}
      {dialog === "delete" && <DeleteAccountDialog onClose={() => setDialog(null)} onSubmit={cloud.deleteAccount} />}
      {resetDialog}
    </div>
  );
}

function useSubmit(action: () => Promise<void>) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { error, setError, busy, run };
}

function Dialog({ title, sub, onClose, onSubmit, children }: { title: string; sub: string; onClose: () => void; onSubmit: (e: React.FormEvent) => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="dialog login-dialog" role="dialog" aria-modal="true" aria-label={title} onSubmit={onSubmit}>
        <h2>{title}</h2>
        <p className="dialog-sub">{sub}</p>
        {children}
      </form>
    </div>
  );
}

function Field({ label, hint, ...input }: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="field">
      <span>
        {label}
        {hint && <em>{hint}</em>}
      </span>
      <input {...input} aria-label={label} />
    </label>
  );
}

function LoginDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: Cloud["signIn"] }) {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const { error, setError, busy, run } = useSubmit(async () => {
    if (mode === "forgot") {
      await requestPasswordReset(email.trim());
      setSent(true);
      return;
    }
    if (mode === "register" && password.length < 8) throw new Error("密码至少 8 位");
    await onSubmit(mode, email.trim(), password);
    onClose();
  });

  const titles = { login: "登录如页", register: "注册如页账号", forgot: "找回密码" };
  const sub =
    mode === "forgot"
      ? "输入注册邮箱，我们会发送一个 30 分钟内有效的重置链接。"
      : "登录后，多份简历会同步到服务器，换电脑也能接着改。不登录也能正常使用，内容只保存在这个浏览器里。";

  return (
    <Dialog title={titles[mode]} sub={sub} onClose={onClose} onSubmit={run}>
      {mode !== "forgot" && (
        <div className="seg" role="tablist">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              className={mode === m ? "on" : ""}
              onClick={() => {
                setMode(m);
                setError(null);
              }}
            >
              {m === "login" ? "登录" : "注册"}
            </button>
          ))}
        </div>
      )}
      <Field label="邮箱" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
      {mode !== "forgot" && (
        <Field
          label="密码"
          hint={mode === "register" ? "至少 8 位" : undefined}
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
          minLength={mode === "register" ? 8 : undefined}
          maxLength={72}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      )}
      {sent && mode === "forgot" && <p className="dialog-ok">如果这个邮箱注册过，重置链接已经发出，请查收邮件（也看看垃圾箱）。</p>}
      {error && (
        <p className="dialog-error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <button type="submit" className="primary" disabled={busy || (sent && mode === "forgot")}>
          {busy ? "请稍候…" : mode === "login" ? "登录" : mode === "register" ? "注册并登录" : "发送重置链接"}
        </button>
        <button type="button" onClick={onClose}>
          取消
        </button>
      </div>
      {mode === "login" && (
        <button type="button" className="link-btn" onClick={() => setMode("forgot")}>
          忘记密码？
        </button>
      )}
      {mode === "forgot" && (
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            setMode("login");
            setSent(false);
          }}
        >
          返回登录
        </button>
      )}
    </Dialog>
  );
}

function ResetPasswordDialog({ token, onClose, onDone }: { token: string; onClose: () => void; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const { error, busy, run } = useSubmit(async () => {
    if (password.length < 8) throw new Error("密码至少 8 位");
    if (password !== again) throw new Error("两次输入的密码不一致");
    await confirmPasswordReset(token, password);
    alert("密码已重置，所有设备上的登录都已失效。请用新密码登录。");
    onClose();
    onDone();
  });
  return (
    <Dialog title="设置新密码" sub="设置后，所有设备上的登录都会失效，需要用新密码重新登录。" onClose={onClose} onSubmit={run}>
      <Field label="新密码" hint="至少 8 位" type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
      <Field label="再输入一次" type="password" autoComplete="new-password" required value={again} onChange={(e) => setAgain(e.target.value)} />
      {error && (
        <p className="dialog-error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <button type="submit" className="primary" disabled={busy}>
          {busy ? "请稍候…" : "保存新密码"}
        </button>
        <button type="button" onClick={onClose}>
          取消
        </button>
      </div>
    </Dialog>
  );
}

function DeleteAccountDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState("");
  const { error, busy, run } = useSubmit(async () => {
    await onSubmit(password);
    onClose();
  });
  return (
    <Dialog
      title="注销账号"
      sub="会永久删除云端账号和云端保存的全部简历，不能恢复。这台电脑上的简历不受影响，可以继续不登录使用。"
      onClose={onClose}
      onSubmit={run}
    >
      <Field label="输入密码确认" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
      {error && (
        <p className="dialog-error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <button type="submit" className="primary danger-fill" disabled={busy}>
          {busy ? "请稍候…" : "永久注销"}
        </button>
        <button type="button" onClick={onClose}>
          取消
        </button>
      </div>
    </Dialog>
  );
}

// 「我的简历」：这台电脑上的所有简历、云端还没下载的、回收站，一页看全。
// 登录后每份简历都标出同步状态；之前在别的设备上保存的，登录同步后就出现在这里。
import { useEffect, useMemo, useState } from "react";
import { recoverDocument, THEMES, type RuyeDocument } from "../../../../packages/schema/src/index.ts";
import { templateMeta } from "../../../../packages/templates/src/index.ts";
import type { CloudApi, RemoteSummary } from "../cloud.ts";
import { docStats, formatWhen, listTrash, removeFromTrash, type TrashEntry } from "../history.ts";
import { SAMPLE_MENU } from "../samples.ts";
import { loadDocument, putDocument, type DocSummary } from "../storage.ts";
import { contentHash, loadSyncState, reattach, saveSyncState } from "../sync.ts";
import { Icon } from "./icons.tsx";
import { MODES } from "./StylePanel.tsx";

interface CloudInfo {
  enabled: boolean;
  email: string | null;
  userId: number | null;
  api: CloudApi | null;
  statusText: string;
  syncing: boolean;
  syncNow: () => void;
  onLogin: () => void;
}

interface Props {
  currentId: string;
  /** 当前打开的这份（列表读的是存档，当前这份用实时内容） */
  currentDoc: RuyeDocument;
  listDocuments: () => DocSummary[];
  cloud: CloudInfo;
  onOpen: (id: string) => void;
  onNew: () => void;
  onSample: (key: string) => void;
  onImport: () => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string, label: string) => Promise<void>;
  onRename: (id: string, alias: string) => void;
  onHistory: (id: string) => void;
  /** 从回收站或云端恢复了一份：打开它 */
  onRestored: (id: string, note: string) => void;
  onError: (text: string) => void;
  onClose: () => void;
}

type SyncBadge = { text: string; tone: "ok" | "pending" | "off" };

export function Library(p: Props) {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((x) => x + 1);
  const [remote, setRemote] = useState<RemoteSummary[] | null>(null);
  const [trash, setTrash] = useState<TrashEntry[]>([]);
  const [showTrash, setShowTrash] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const docs = useMemo(() => {
    const list = p.listDocuments();
    return list.map((s) => {
      const doc = s.id === p.currentId ? p.currentDoc : loadDocument(s.id)?.doc;
      return { s, doc };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, p.currentDoc, p.currentId]);

  useEffect(() => {
    void listTrash().then(setTrash);
  }, [tick]);
  useEffect(() => {
    if (!p.cloud.api) return setRemote(null);
    let alive = true;
    p.cloud.api
      .list()
      .then((r) => alive && setRemote(r))
      .catch(() => alive && setRemote(null));
    return () => {
      alive = false;
    };
  }, [p.cloud.api, tick, p.cloud.statusText]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && !renaming && p.onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [renaming, p]);

  const state = p.cloud.userId !== null ? loadSyncState(p.cloud.userId) : null;
  const localIds = new Set(docs.map((d) => d.s.id));
  const cloudOnly = (remote ?? []).filter((r) => !r.deleted && !localIds.has(r.id));
  const cloudTrash = (remote ?? []).filter((r) => r.deleted && !localIds.has(r.id) && !trash.some((t) => t.id === r.id));

  function badge(id: string, doc: RuyeDocument | undefined): SyncBadge | null {
    if (!state || !doc) return null;
    const rec = state[id];
    if (!rec) return { text: "等待上传", tone: "pending" };
    if (rec.detached) return { text: "仅在本机", tone: "off" };
    return rec.hash === contentHash(doc) ? { text: "已同步", tone: "ok" } : { text: "有改动待同步", tone: "pending" };
  }

  async function download(r: RemoteSummary) {
    if (!p.cloud.api || p.cloud.userId === null) return;
    setBusy(r.id);
    try {
      const d = await p.cloud.api.get(r.id);
      const rec = recoverDocument(d.doc);
      if (!rec) throw new Error("云端这份简历无法识别");
      const err = putDocument(r.id, rec.doc);
      if (err) throw new Error(err);
      const st = loadSyncState(p.cloud.userId);
      saveSyncState(p.cloud.userId, { ...st, [r.id]: { version: d.version, hash: contentHash(rec.doc) } });
      p.onRestored(r.id, "已从云端下载到这台电脑。");
    } catch (e) {
      p.onError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function restoreLocal(t: TrashEntry) {
    const err = putDocument(t.id, { ...t.doc, meta: { ...t.doc.meta, updatedAt: new Date().toISOString() } });
    if (err) return p.onError(err);
    await removeFromTrash(t.id);
    // 云端那份可能已经随删除进了云端回收站：标记为「本机改过」，下次同步重新上传（同 id 会把云端那份一起恢复）
    if (p.cloud.userId !== null) saveSyncState(p.cloud.userId, reattach(loadSyncState(p.cloud.userId), [t.id]));
    p.onRestored(t.id, "已从回收站恢复。");
  }

  async function restoreCloud(r: RemoteSummary) {
    const api = p.cloud.api;
    if (!api?.revisions || !api.revision || p.cloud.userId === null) return;
    setBusy(r.id);
    try {
      const revs = await api.revisions(r.id);
      if (!revs.length) throw new Error("云端没有这份简历的内容可恢复");
      const d = await api.revision(r.id, revs[0].version);
      const rec = recoverDocument(d.doc);
      if (!rec) throw new Error("云端这份简历无法识别");
      const w = await api.put(r.id, null, rec.doc);
      const err = putDocument(r.id, rec.doc);
      if (err) throw new Error(err);
      const st = loadSyncState(p.cloud.userId);
      saveSyncState(p.cloud.userId, { ...st, [r.id]: { version: w.version, hash: contentHash(rec.doc) } });
      p.onRestored(r.id, "已从云端回收站恢复。");
    } catch (e) {
      p.onError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const trashCount = trash.length + cloudTrash.length;

  return (
    <main className="library" aria-label="我的简历">
      <div className="library-inner">
        <header className="library-head">
          <div>
            <h1>我的简历</h1>
            <p>
              {docs.length} 份在这台电脑上
              {p.cloud.email ? ` · 已登录 ${p.cloud.email}` : ""}
            </p>
          </div>
          <div className="library-actions">
            <button type="button" className="primary" onClick={p.onNew}>
              <Icon name="plus" size={15} strokeWidth={2.2} />
              新建空白简历
            </button>
            <button type="button" onClick={p.onImport}>
              导入文件
            </button>
            <button type="button" className="ghost" onClick={p.onClose}>
              回到编辑
            </button>
          </div>
        </header>

        {p.cloud.enabled && (
          <div className={`cloud-strip${p.cloud.email ? " on" : ""}`}>
            <Icon name="cloud" size={18} />
            {p.cloud.email ? (
              <>
                <span>
                  云同步已开启。在别的电脑上登录同一个账号，这些简历会自动出现。
                  <em>{p.cloud.statusText}</em>
                </span>
                <button type="button" disabled={p.cloud.syncing} onClick={() => (p.cloud.syncNow(), refresh())}>
                  {p.cloud.syncing ? "同步中…" : "立即同步"}
                </button>
              </>
            ) : (
              <>
                <span>现在简历只存在这个浏览器里。登录后会同步到云端，换电脑、清缓存都不会丢，还能找回历史版本。</span>
                <button type="button" className="primary" onClick={p.cloud.onLogin}>
                  登录 / 注册
                </button>
              </>
            )}
          </div>
        )}

        <ul className="doc-grid">
          {docs.map(({ s, doc }) => {
            const current = s.id === p.currentId;
            const label = (doc?.meta.alias?.trim() || doc?.meta.title) ?? s.label;
            const stats = doc ? docStats(doc) : null;
            const b = badge(s.id, doc);
            const tpl = templateMeta(doc?.layout.templateId ?? (s.templateId as never));
            const mode = MODES.find((m) => m.id === doc?.layout.pageMode);
            const updated = Date.parse(doc?.meta.updatedAt ?? s.updatedAt);
            return (
              <li key={s.id} className={`doc-card${current ? " current" : ""}`}>
                <button type="button" className="doc-card-open" onClick={() => p.onOpen(s.id)} aria-label={`打开「${label}」`}>
                  <Cover doc={doc} />
                </button>
                <div className="doc-card-body">
                  {renaming === s.id ? (
                    <form
                      className="rename-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const v = (new FormData(e.currentTarget).get("alias") as string).trim();
                        p.onRename(s.id, v);
                        setRenaming(null);
                        refresh();
                      }}
                    >
                      <input name="alias" defaultValue={doc?.meta.alias ?? ""} placeholder={doc?.meta.title ?? "备注名"} autoFocus maxLength={60} aria-label="备注名" onKeyDown={(e) => e.key === "Escape" && setRenaming(null)} />
                      <button type="submit">好</button>
                    </form>
                  ) : (
                    <button type="button" className="doc-card-title" onClick={() => p.onOpen(s.id)}>
                      {label}
                    </button>
                  )}
                  <p className="doc-card-meta">
                    {tpl.name}
                    {mode ? ` · ${mode.short}` : ""}
                    {stats ? ` · ${stats.modules} 个模块 · ${stats.chars} 字` : ""}
                  </p>
                  <p className="doc-card-foot">
                    {current ? <i className="tag-current">正在编辑</i> : null}
                    <span>{Number.isFinite(updated) ? `修改于 ${formatWhen(updated)}` : ""}</span>
                    {b && <i className={`sync-badge ${b.tone}`}>{b.text}</i>}
                  </p>
                  <div className="doc-card-actions">
                    <button type="button" onClick={() => p.onHistory(s.id)}>
                      历史版本
                    </button>
                    <button type="button" onClick={() => setRenaming(s.id)}>
                      改备注名
                    </button>
                    <button type="button" onClick={() => p.onDuplicate(s.id)}>
                      复制
                    </button>
                    <button type="button" className="danger" onClick={() => void p.onDelete(s.id, label).then(refresh)}>
                      删除
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {cloudOnly.length > 0 && (
          <section className="library-section">
            <h2>云端还有 {cloudOnly.length} 份不在这台电脑上</h2>
            <ul className="plain-list">
              {cloudOnly.map((r) => (
                <li key={r.id}>
                  <span className="pl-title">{r.alias || r.title}</span>
                  <span className="pl-meta">云端修改于 {formatWhen(r.updatedAt)}</span>
                  <button type="button" disabled={busy !== null} onClick={() => download(r)}>
                    {busy === r.id ? "下载中…" : "下载并打开"}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="library-section">
          <h2>
            <button type="button" className="fold" aria-expanded={showTrash} onClick={() => setShowTrash((x) => !x)}>
              <span className="chev" aria-hidden="true" />
              回收站 {trashCount > 0 ? `· ${trashCount}` : ""}
            </button>
          </h2>
          {showTrash &&
            (trashCount === 0 ? (
              <p className="library-hint">删掉的简历会在这里保留 30 天，可以随时恢复。</p>
            ) : (
              <ul className="plain-list">
                {trash.map((t) => (
                  <li key={t.id}>
                    <span className="pl-title">{t.doc.meta.alias?.trim() || t.doc.meta.title}</span>
                    <span className="pl-meta">删除于 {formatWhen(t.deletedAt)} · 本机</span>
                    <button type="button" onClick={() => restoreLocal(t)}>
                      恢复
                    </button>
                  </li>
                ))}
                {cloudTrash.map((r) => (
                  <li key={r.id}>
                    <span className="pl-title">{r.alias || r.title}</span>
                    <span className="pl-meta">删除于 {formatWhen(r.updatedAt)} · 云端</span>
                    <button type="button" disabled={busy !== null} onClick={() => restoreCloud(r)}>
                      {busy === r.id ? "恢复中…" : "恢复"}
                    </button>
                  </li>
                ))}
              </ul>
            ))}
        </section>

        <section className="library-section">
          <h2>从岗位示例开始</h2>
          <p className="library-hint">示例都是虚构的人物，照着改成自己的内容最快。会另存为一份新简历，不影响现有的。</p>
          <div className="sample-chips">
            {SAMPLE_MENU.filter((m) => !m.key.match(/short|medium|long/)).map((m) => (
              <button key={m.key} type="button" onClick={() => p.onSample(m.key)}>
                {m.label}
                {m.hint && <em>{m.hint}</em>}
              </button>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

/** 卡片左侧的「封面」：一张小纸，上面是这份简历自己的姓名和求职意向，用它的主题色。不放模板示意图，免得看起来像别人的简历 */
function Cover({ doc }: { doc: RuyeDocument | undefined }) {
  const basic = doc?.modules.find((m) => m.type === "basic_info");
  const job = doc?.modules.find((m) => m.type === "job_intention");
  const name = (basic?.type === "basic_info" && basic.data.name?.trim()) || "未填姓名";
  const role = (job?.type === "job_intention" && job.data.role?.trim()) || "";
  const accent = doc && !templateMeta(doc.layout.templateId).fixedTheme ? THEMES[doc.layout.theme ?? "ink"].accent : "#222";
  return (
    <span className="doc-cover" style={{ ["--cover" as string]: accent }}>
      <b>{name}</b>
      {role && <em>{role}</em>}
      <i aria-hidden="true" />
      <i aria-hidden="true" />
      <i aria-hidden="true" />
      <i aria-hidden="true" />
    </span>
  );
}

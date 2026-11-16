// 云同步：本机是主副本，云端是同步副本。原则是「不丢内容」——
// - 两边都改过同一份简历时，不做二选一：云端版本另存为一份新简历，本机版本照常上传；
// - 云端被删除时，本机的这份保留下来，标记为「仅本机」，不再自动同步；
// - 本机删除时，只有云端版本还是上次同步的那个版本才删除云端（软删除），否则把云端版本拉回来。
//
// planSync 是纯函数，只根据三方信息（本机、云端、上次同步记录）决定动作，便于测试；
// runSync 负责执行动作，存储和网络都通过参数注入。

import { recoverDocument, type RuyeDocument } from "../../../packages/schema/src/index.ts";
import { CloudError, type CloudApi, type RemoteSummary } from "./cloud.ts";

/** 每份简历上次同步时的状态 */
export interface SyncRecord {
  /** 上次同步后云端的版本号 */
  version: number;
  /** 上次同步时本机内容的指纹 */
  hash: string;
  /** 云端已删除、本机保留：不再自动同步 */
  detached?: boolean;
}
export type SyncState = Record<string, SyncRecord>;

export interface LocalEntry {
  id: string;
  hash: string;
}

export type SyncAction =
  | { kind: "push"; id: string; baseVersion: number | null }
  | { kind: "pull"; id: string }
  | { kind: "conflict"; id: string; remoteVersion: number }
  | { kind: "delete-remote"; id: string; baseVersion: number }
  | { kind: "detach"; id: string }
  | { kind: "forget"; id: string };

/** 内容指纹：忽略 updatedAt（每次保存都会变），其余字段任何变化都会改变指纹。FNV-1a 64 位 */
export function contentHash(doc: RuyeDocument): string {
  const s = JSON.stringify({ ...doc, meta: { ...doc.meta, updatedAt: "" } });
  let h1 = 0x811c9dc5;
  let h2 = 0xcbf29ce4;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x0100019d) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

export function planSync(local: LocalEntry[], remote: RemoteSummary[], state: SyncState): SyncAction[] {
  const actions: SyncAction[] = [];
  const L = new Map(local.map((x) => [x.id, x]));
  const R = new Map(remote.map((x) => [x.id, x]));
  const ids = new Set([...L.keys(), ...R.keys(), ...Object.keys(state)]);

  for (const id of ids) {
    const l = L.get(id);
    const r = R.get(id);
    const m = state[id];

    if (l && m?.detached) continue;

    if (l && !r) {
      // 云端没有：上传（之前同步过、云端记录却不见了，也按新建处理）
      actions.push({ kind: "push", id, baseVersion: null });
      continue;
    }
    if (!l && !r) {
      if (m) actions.push({ kind: "forget", id });
      continue;
    }
    if (!l && r) {
      if (r.deleted) {
        if (m) actions.push({ kind: "forget", id });
      } else if (m && !m.detached && m.version === r.version) {
        // 本机删除了，而云端仍是上次同步的版本：同步删除
        actions.push({ kind: "delete-remote", id, baseVersion: r.version });
      } else {
        // 其他设备新建的，或本机删除后云端又被改过：拉下来，不丢内容
        actions.push({ kind: "pull", id });
      }
      continue;
    }
    // 两边都有
    const lc = l!;
    const rc = r!;
    const localChanged = !m || m.hash !== lc.hash;
    if (rc.deleted) {
      if (localChanged && m) actions.push({ kind: "push", id, baseVersion: null }); // 本机又改过：重新上传
      else actions.push({ kind: "detach", id }); // 本机保留，不再同步
      continue;
    }
    if (!m) {
      // 两边都有、却没有同步记录（例如清过浏览器数据后重新登录）：当作冲突，两份都留
      actions.push({ kind: "conflict", id, remoteVersion: rc.version });
      continue;
    }
    const remoteChanged = m.version !== rc.version;
    if (!remoteChanged && localChanged) actions.push({ kind: "push", id, baseVersion: m.version });
    else if (remoteChanged && !localChanged) actions.push({ kind: "pull", id });
    else if (remoteChanged && localChanged) actions.push({ kind: "conflict", id, remoteVersion: rc.version });
  }
  return actions;
}

/** 执行同步需要的本机存储操作 */
export interface LocalStore {
  list(): { id: string; doc: RuyeDocument }[];
  put(id: string, doc: RuyeDocument): string | null;
  newId(): string;
  /** 当前打开的简历有尚未写入本机的修改时返回 false：这一轮不覆盖它 */
  canReplace(id: string): boolean;
}

export interface SyncReport {
  pushed: number;
  pulled: number;
  conflicts: { id: string; copyId: string }[];
  detached: string[];
  /** 被云端版本替换了内容的本机简历 id（界面需要重新载入当前文档） */
  replaced: string[];
  skipped: string[];
  errors: string[];
}

export async function runSync(api: CloudApi, store: LocalStore, state: SyncState): Promise<{ state: SyncState; report: SyncReport }> {
  const next: SyncState = { ...state };
  const report: SyncReport = { pushed: 0, pulled: 0, conflicts: [], detached: [], replaced: [], skipped: [], errors: [] };
  const remote = await api.list();
  const localDocs = store.list();
  const byId = new Map(localDocs.map((x) => [x.id, x.doc]));
  const actions = planSync(
    localDocs.map((x) => ({ id: x.id, hash: contentHash(x.doc) })),
    remote,
    state,
  );

  const fetchRemote = async (id: string): Promise<{ doc: RuyeDocument; version: number }> => {
    const d = await api.get(id);
    const rec = recoverDocument(d.doc);
    if (!rec) throw new CloudError(`云端的「${id}」无法识别，已跳过`, 0, "bad_remote");
    return { doc: rec.doc, version: d.version };
  };

  for (const a of actions) {
    try {
      if (a.kind === "forget") {
        delete next[a.id];
      } else if (a.kind === "detach") {
        next[a.id] = { ...(next[a.id] ?? { version: 0, hash: "" }), detached: true };
        report.detached.push(a.id);
      } else if (a.kind === "push") {
        const doc = byId.get(a.id)!;
        const w = await api.put(a.id, a.baseVersion, doc);
        next[a.id] = { version: w.version, hash: contentHash(doc) };
        report.pushed++;
      } else if (a.kind === "delete-remote") {
        await api.remove(a.id, a.baseVersion);
        delete next[a.id];
      } else if (a.kind === "pull") {
        if (byId.has(a.id) && !store.canReplace(a.id)) {
          report.skipped.push(a.id);
          continue;
        }
        const { doc, version } = await fetchRemote(a.id);
        const err = store.put(a.id, doc);
        if (err) throw new Error(err);
        next[a.id] = { version, hash: contentHash(doc) };
        if (byId.has(a.id)) report.replaced.push(a.id);
        report.pulled++;
      } else if (a.kind === "conflict") {
        // 云端版本另存为一份新简历（新 id，备注名注明来源），本机版本基于云端最新版本上传
        const { doc: remoteDoc, version } = await fetchRemote(a.id);
        const copyId = store.newId();
        const label = remoteDoc.meta.alias?.trim() || remoteDoc.meta.title;
        const copy: RuyeDocument = { ...remoteDoc, meta: { ...remoteDoc.meta, alias: `${label}（云端冲突副本）`.slice(0, 60) } };
        const err = store.put(copyId, copy);
        if (err) throw new Error(err);
        const localDoc = byId.get(a.id)!;
        const w = await api.put(a.id, version, localDoc);
        next[a.id] = { version: w.version, hash: contentHash(localDoc) };
        const wc = await api.put(copyId, null, copy);
        next[copyId] = { version: wc.version, hash: contentHash(copy) };
        report.conflicts.push({ id: a.id, copyId });
      }
    } catch (e) {
      if (e instanceof CloudError && e.status === 401) throw e;
      report.errors.push((e as Error).message);
    }
  }
  return { state: next, report };
}

const STATE_KEY = "ruye:sync-state";

export function loadSyncState(userId: number): SyncState {
  try {
    const raw = localStorage.getItem(`${STATE_KEY}:${userId}`);
    const v = raw ? JSON.parse(raw) : {};
    return v && typeof v === "object" && !Array.isArray(v) ? (v as SyncState) : {};
  } catch {
    return {};
  }
}

export function saveSyncState(userId: number, s: SyncState): void {
  try {
    localStorage.setItem(`${STATE_KEY}:${userId}`, JSON.stringify(s));
  } catch {
    // 同步记录写不进去：下次同步会把两边都有的简历当作冲突处理，不会丢内容
  }
}

/** 被标记为「仅本机」（云端已删除、本机保留）的简历 id */
export function detachedIds(state: SyncState): string[] {
  return Object.entries(state).filter(([, r]) => r.detached).map(([id]) => id);
}

/**
 * 重新开启同步：把这些简历当作「本机改过、云端版本未知」，下次同步时重新上传
 * （云端已删除的会被恢复，云端不存在的会新建）
 */
export function reattach(state: SyncState, ids: string[]): SyncState {
  const next = { ...state };
  for (const id of ids) next[id] = { version: next[id]?.version ?? 0, hash: "" };
  return next;
}

/** 同步结果的一句话说明 */
export function describeReport(r: SyncReport): string {
  const parts: string[] = [];
  if (r.pushed) parts.push(`上传 ${r.pushed} 份`);
  if (r.pulled) parts.push(`下载 ${r.pulled} 份`);
  if (r.conflicts.length) parts.push(`${r.conflicts.length} 份在两台设备上都改过，云端版本已另存为「冲突副本」`);
  if (r.detached.length) parts.push(`${r.detached.length} 份已在其他设备删除，本机保留`);
  if (r.errors.length) parts.push(`${r.errors.length} 份失败：${r.errors[0]}`);
  return parts.length ? `已同步：${parts.join("，")}` : "已同步，没有变化";
}

// 本机历史：每份简历的自动快照 + 本机回收站。
// 放在 IndexedDB 里，不占用简历本身的 localStorage 空间；这里任何失败都只影响历史，不影响保存。
// 规则（纯函数，便于测试）：
//   - 内容和上一份快照一样就不存；距上一份快照不到 SNAPSHOT_GAP 也不存（连续打字时只留一份）
//   - 每份简历最多 MAX_SNAPSHOTS 份，超出删最旧的
//   - 回收站保留 TRASH_DAYS 天

import type { RuyeDocument } from "../../../packages/schema/src/index.ts";

export const SNAPSHOT_GAP_MS = 10 * 60 * 1000;
export const MAX_SNAPSHOTS = 30;
export const TRASH_DAYS = 30;

export interface Snapshot {
  docId: string;
  at: number;
  hash: string;
  doc: RuyeDocument;
}

export interface TrashEntry {
  id: string;
  deletedAt: number;
  doc: RuyeDocument;
}

/** 要不要为这次保存留一份快照 */
export function shouldSnapshot(last: Pick<Snapshot, "at" | "hash"> | undefined, hash: string, now: number): boolean {
  if (!last) return true;
  if (last.hash === hash) return false;
  return now - last.at >= SNAPSHOT_GAP_MS;
}

/** 新的在前；超出上限的（最旧的）返回在 drop 里 */
export function pruneSnapshots<T extends { at: number }>(list: T[], max = MAX_SNAPSHOTS): { keep: T[]; drop: T[] } {
  const sorted = [...list].sort((a, b) => b.at - a.at);
  return { keep: sorted.slice(0, max), drop: sorted.slice(max) };
}

/** 回收站里过期的条目 */
export function expiredTrash<T extends { deletedAt: number }>(list: T[], now: number, days = TRASH_DAYS): T[] {
  return list.filter((t) => now - t.deletedAt > days * 86400_000);
}

// ---------------------------------------------------------------- IndexedDB

const DB = "ruye-history";
const SNAP = "snapshots";
const TRASH = "trash";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("浏览器不支持 IndexedDB"));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      const s = db.createObjectStore(SNAP, { autoIncrement: true });
      s.createIndex("docId", "docId");
      db.createObjectStore(TRASH, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function all<T>(req: IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

async function snapshotsWithKeys(db: IDBDatabase, docId: string): Promise<{ key: IDBValidKey; value: Snapshot }[]> {
  const tx = db.transaction(SNAP, "readonly");
  const idx = tx.objectStore(SNAP).index("docId");
  const [keys, values] = await Promise.all([all<IDBValidKey[]>(idx.getAllKeys(docId)), all<Snapshot[]>(idx.getAll(docId))]);
  return values.map((value, i) => ({ key: keys[i], value }));
}

/** 保存后调用：按规则决定是否留一份快照。失败静默 */
export async function recordSnapshot(docId: string, doc: RuyeDocument, hash: string, now = Date.now()): Promise<boolean> {
  try {
    const db = await open();
    const rows = await snapshotsWithKeys(db, docId);
    const latest = rows.map((r) => r.value).sort((a, b) => b.at - a.at)[0];
    if (!shouldSnapshot(latest, hash, now)) return false;
    const tx = db.transaction(SNAP, "readwrite");
    const store = tx.objectStore(SNAP);
    store.add({ docId, at: now, hash, doc } satisfies Snapshot);
    const { drop } = pruneSnapshots([...rows.map((r) => ({ ...r, at: r.value.at })), { key: -1, at: now }]);
    for (const d of drop) if (d.key !== -1) store.delete(d.key);
    await done(tx);
    return true;
  } catch {
    return false;
  }
}

export async function listSnapshots(docId: string): Promise<Snapshot[]> {
  try {
    const db = await open();
    return (await snapshotsWithKeys(db, docId)).map((r) => r.value).sort((a, b) => b.at - a.at);
  } catch {
    return [];
  }
}

/** 删除一份简历时放进回收站（同时清理过期条目）。失败返回 false，调用方据此提示「删除后不能恢复」 */
export async function moveToTrash(id: string, doc: RuyeDocument, now = Date.now()): Promise<boolean> {
  try {
    const db = await open();
    const existing = await all<TrashEntry[]>(db.transaction(TRASH, "readonly").objectStore(TRASH).getAll());
    const tx = db.transaction(TRASH, "readwrite");
    const store = tx.objectStore(TRASH);
    for (const t of expiredTrash(existing, now)) store.delete(t.id);
    store.put({ id, deletedAt: now, doc } satisfies TrashEntry);
    await done(tx);
    return true;
  } catch {
    return false;
  }
}

export async function listTrash(): Promise<TrashEntry[]> {
  try {
    const db = await open();
    const list = await all<TrashEntry[]>(db.transaction(TRASH, "readonly").objectStore(TRASH).getAll());
    const now = Date.now();
    const expired = new Set(expiredTrash(list, now).map((t) => t.id));
    return list.filter((t) => !expired.has(t.id)).sort((a, b) => b.deletedAt - a.deletedAt);
  } catch {
    return [];
  }
}

export async function removeFromTrash(id: string): Promise<void> {
  try {
    const db = await open();
    const tx = db.transaction(TRASH, "readwrite");
    tx.objectStore(TRASH).delete(id);
    await done(tx);
  } catch {
    // 回收站清不掉不影响恢复出来的那份
  }
}

// ---------------------------------------------------------------- 列表里显示用

/** 简历的大致体量：模块数、正文字数（不算照片） */
export function docStats(doc: RuyeDocument): { modules: number; chars: number } {
  let chars = 0;
  const walk = (v: unknown, key = ""): void => {
    if (typeof v === "string") {
      if (key !== "photoDataUrl" && key !== "id" && key !== "type") chars += [...v.trim()].length;
    } else if (Array.isArray(v)) v.forEach((x) => walk(x));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  walk(doc.modules);
  return { modules: doc.modules.filter((m) => m.visible).length, chars };
}

/** 「刚刚」「5 分钟前」「今天 14:03」「昨天 09:12」「11 月 14 日」「2025 年 3 月 2 日」 */
export function formatWhen(ts: number, now = Date.now()): string {
  const d = new Date(ts);
  const diff = now - ts;
  if (diff < 60_000) return "刚刚";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((day(new Date(now)) - day(d)) / 86400_000);
  if (days === 0) return `今天 ${hm}`;
  if (days === 1) return `昨天 ${hm}`;
  if (d.getFullYear() === new Date(now).getFullYear()) return `${d.getMonth() + 1} 月 ${d.getDate()} 日 ${hm}`;
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

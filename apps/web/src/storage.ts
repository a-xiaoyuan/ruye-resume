// 本地存储：只用 localStorage，不上传任何内容。
// 键：ruye:documents（文档列表）、ruye:currentId（当前文档）
//
// 格式有问题的草稿也要读得回来。读失败时保留原始字符串，调用方在用户明确放弃之前不得覆盖。

import { createEmptyDocument, recoverDocument, type RuyeDocument, type ValidationIssue } from "../../../packages/schema/src/index.ts";

const DOCS_KEY = "ruye:documents";
const CURRENT_KEY = "ruye:currentId";

export type LoadOutcome =
  | { kind: "empty" }
  | { kind: "draft"; id: string; doc: RuyeDocument; issues: ValidationIssue[]; fingerprint: string }
  | { kind: "unreadable"; message: string; raw: string | null };

export interface SessionStart {
  doc: RuyeDocument;
  /** 为 false 时禁止自动保存，避免用示例或空白文档盖掉读失败的存档 */
  persist: boolean;
  isSample: boolean;
  notice: string | null;
  rawBackup: string | null;
  /** 继续写入同一条存档；null 表示还没有 id，第一次保存时用 doc-1 */
  storageId: string | null;
  /** 打开时存档里这份简历的内容指纹；null 表示存档里还没有它 */
  fingerprint: string | null;
}

/**
 * 内容指纹：写入前拿它和存档里的现状比，判断是否被其他标签页改过。
 * 不计 updatedAt，只是重新保存同样的内容不算修改，两个标签页之间不会来回触发
 */
export function fingerprint(doc: unknown): string {
  if (!isObj(doc)) return JSON.stringify(doc) ?? "";
  const meta = isObj(doc.meta) ? { ...doc.meta, updatedAt: "" } : doc.meta;
  return JSON.stringify({ ...doc, meta });
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** 打开编辑器时怎么用本地存档。只有真正没有存档时才用示例。 */
export function openSession(outcome: LoadOutcome, sample: RuyeDocument): SessionStart {
  if (outcome.kind === "empty") {
    return { doc: structuredClone(sample), persist: true, isSample: true, notice: null, rawBackup: null, storageId: null, fingerprint: null };
  }
  if (outcome.kind === "draft") {
    const notice = outcome.issues.length
      ? `已恢复本地草稿，姓名和正文都还在。有 ${outcome.issues.length} 处格式问题需要修正，刷新不会丢掉内容。`
      : null;
    return { doc: outcome.doc, persist: true, isSample: false, notice, rawBackup: null, storageId: outcome.id, fingerprint: outcome.fingerprint };
  }
  return {
    doc: createEmptyDocument(),
    persist: false,
    isSample: false,
    notice: `${outcome.message}可以下载原始存档。在你明确新建、载入示例或导入之前，不会写入，也不会换成示例简历。`,
    rawBackup: outcome.raw,
    storageId: null,
    fingerprint: null,
  };
}

export function loadOutcome(): LoadOutcome {
  let raw: string | null;
  try {
    raw = localStorage.getItem(DOCS_KEY);
  } catch (e) {
    return { kind: "unreadable", message: `无法读取本地存档（${(e as Error).message}）。原始数据未改动，没有用示例覆盖。`, raw: null };
  }
  if (raw === null || raw === "") return { kind: "empty" };

  let list: unknown;
  try {
    list = JSON.parse(raw);
  } catch {
    return { kind: "unreadable", message: "本地存档不是合法 JSON，已原样保留，没有用示例覆盖。", raw };
  }
  if (!Array.isArray(list)) {
    return { kind: "unreadable", message: "本地存档格式无法识别，已原样保留，没有用示例覆盖。", raw };
  }
  if (list.length === 0) return { kind: "empty" };

  let currentId: string | null = null;
  try {
    currentId = localStorage.getItem(CURRENT_KEY);
  } catch {
    currentId = null;
  }
  const ordered = [...list];
  if (currentId) {
    ordered.sort((a, b) => {
      const ai = isObj(a) && a.id === currentId ? 0 : 1;
      const bi = isObj(b) && b.id === currentId ? 0 : 1;
      return ai - bi;
    });
  }
  for (const item of ordered) {
    if (!isObj(item) || !("doc" in item)) continue;
    const recovered = recoverDocument(item.doc);
    if (!recovered) continue;
    const id = typeof item.id === "string" && item.id !== "" ? item.id : "doc-1";
    return { kind: "draft", id, doc: recovered.doc, issues: recovered.issues, fingerprint: fingerprint(item.doc) };
  }
  return { kind: "unreadable", message: "本地存档里没有可恢复的简历，已原样保留，没有用示例覆盖。", raw };
}

export type SaveMode = "merge" | "replace";

/** 顶栏文案。只有写入成功才说「已保留」。 */
export type SavePhase = "blocked" | "pending" | "saved" | "failed" | "conflict";

export function saveStatusText(phase: SavePhase, issueCount: number): string {
  if (phase === "blocked") return "未写入，以免覆盖无法读取的存档";
  if (phase === "conflict") return "另一标签页改过，已暂停保存";
  if (phase === "failed") return "保存失败，未写入本机";
  if (phase === "pending") return "正在写入本机…";
  if (issueCount > 0) return `草稿已保留（${issueCount} 处格式需修正）`;
  return "仅保存在此浏览器";
}

/** 窄屏顶栏用的短文案：只说结果，完整说明放在 title 里 */
export function saveStatusShort(phase: SavePhase): string {
  if (phase === "blocked") return "未写入";
  if (phase === "conflict") return "已暂停";
  if (phase === "failed") return "保存失败";
  if (phase === "pending") return "保存中";
  return "已保存";
}

/**
 * 保存当前文档。merge 在读不到或无法安全识别现有存档时直接失败，不写盘。
 * replace 只用于用户明确新建、载入示例或导入，允许覆盖原先无法打开的存档。
 */
export function saveCurrent(doc: RuyeDocument, id?: string, mode: SaveMode = "merge"): string | null {
  const r = saveChecked(doc, id, mode);
  return r.ok ? null : r.message;
}

export type SaveResult = { ok: true; fingerprint: string } | { ok: false; message: string; conflict?: { deleted: boolean } };

/**
 * 带外部修改检测的保存。expected 是上次读取或写入时存档里这份简历的指纹（null 表示当时还没有它）；
 * 存档现状和它对不上，说明其他标签页改过或删掉了，这时不写入，返回 conflict，由调用方让用户决定。
 * expected 为 undefined 时不检查（replace 模式也不检查：那是用户明确要覆盖）
 */
export function saveChecked(doc: RuyeDocument, id?: string, mode: SaveMode = "merge", expected?: string | null): SaveResult {
  let current: string;
  try {
    current = id ?? localStorage.getItem(CURRENT_KEY) ?? "doc-1";
  } catch (e) {
    return { ok: false, message: `本地保存失败：${(e as Error).message}。未写入。` };
  }
  let others: Record<string, unknown>[] = [];
  if (mode === "merge") {
    const existing = readForMerge(current);
    if (!existing.ok) return { ok: false, message: existing.message };
    if (expected !== undefined && existing.fingerprint !== expected) {
      const deleted = existing.fingerprint === null;
      return {
        ok: false,
        message: deleted ? "这份简历在另一标签页里被删除了。" : "这份简历在另一标签页里修改过。",
        conflict: { deleted },
      };
    }
    others = existing.others;
  }
  try {
    const stored = { id: current, doc: { ...doc, meta: { ...doc.meta, updatedAt: new Date().toISOString() } } };
    localStorage.setItem(DOCS_KEY, JSON.stringify([stored, ...others]));
    localStorage.setItem(CURRENT_KEY, current);
    return { ok: true, fingerprint: fingerprint(stored.doc) };
  } catch (e) {
    return { ok: false, message: `本地保存失败：${(e as Error).message}。未写入。` };
  }
}

/** 存档里这份简历现在的指纹；不存在时为 null，存档读不出来时为 undefined */
export function storedFingerprint(id: string): string | null | undefined {
  const r = readList();
  if (!r.ok) return undefined;
  const item = r.list.find((x) => isObj(x) && x.id === id);
  return item && isObj(item) && "doc" in item ? fingerprint(item.doc) : null;
}

function readForMerge(id: string): { ok: true; others: Record<string, unknown>[]; fingerprint: string | null } | { ok: false; message: string } {
  let raw: string | null;
  try {
    raw = localStorage.getItem(DOCS_KEY);
  } catch (e) {
    return { ok: false, message: `本地保存失败：无法读取现有存档（${(e as Error).message}）。未写入，以免覆盖。` };
  }
  if (raw === null || raw === "") return { ok: true, others: [], fingerprint: null };
  let list: unknown;
  try {
    list = JSON.parse(raw);
  } catch {
    return { ok: false, message: "本地保存失败：现有存档不是合法 JSON。未写入，以免覆盖。" };
  }
  if (!Array.isArray(list)) return { ok: false, message: "本地保存失败：现有存档无法识别。未写入，以免覆盖。" };
  const current = list.find((x) => isObj(x) && x.id === id);
  if (current && isObj(current) && "doc" in current && recoverDocument(current.doc) === null) {
    return { ok: false, message: "本地保存失败：现有存档无法在编辑器中安全打开。未写入，以免覆盖。" };
  }
  const fp = current && isObj(current) && "doc" in current ? fingerprint(current.doc) : null;
  return { ok: true, others: list.filter((x): x is Record<string, unknown> => isObj(x) && x.id !== id), fingerprint: fp };
}

// ---------------------------------------------------------------- 多份简历

export interface DocSummary {
  id: string;
  /** 列表里显示的名字：备注名优先，其次是「姓名-求职意向」 */
  label: string;
  title: string;
  alias?: string;
  templateId: string;
  updatedAt: string;
  /** 有格式问题、但内容可恢复的草稿 */
  issueCount: number;
}

/** 生成新简历的存档 id。优先用 UUID；环境不支持时退回「毫秒时间戳 + 8 位随机」，避免同一毫秒内批量生成撞号 */
export function newDocumentId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c && typeof c.randomUUID === "function") return `doc-${c.randomUUID()}`;
  return `doc-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function readList(): { ok: true; list: unknown[] } | { ok: false; message: string } {
  let raw: string | null;
  try {
    raw = localStorage.getItem(DOCS_KEY);
  } catch (e) {
    return { ok: false, message: `无法读取本地存档（${(e as Error).message}）` };
  }
  if (raw === null || raw === "") return { ok: true, list: [] };
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? { ok: true, list } : { ok: false, message: "本地存档格式无法识别" };
  } catch {
    return { ok: false, message: "本地存档不是合法 JSON" };
  }
}

/** 列出所有能打开的简历，按最近使用排序（保存时当前简历排在最前）。读不出的条目跳过，但不删除 */
export function listDocuments(): DocSummary[] {
  const r = readList();
  if (!r.ok) return [];
  const out: DocSummary[] = [];
  for (const item of r.list) {
    if (!isObj(item) || typeof item.id !== "string" || item.id === "" || !("doc" in item)) continue;
    const rec = recoverDocument(item.doc);
    if (!rec) continue;
    const { meta, layout } = rec.doc;
    const alias = typeof meta.alias === "string" && meta.alias.trim() !== "" ? meta.alias.trim() : undefined;
    out.push({ id: item.id, label: alias ?? meta.title, title: meta.title, alias, templateId: layout.templateId, updatedAt: meta.updatedAt, issueCount: rec.issues.length });
  }
  return out;
}

/** 打开指定简历；不存在或无法恢复时返回 null */
export function loadDocument(id: string): { doc: RuyeDocument; issues: ValidationIssue[]; fingerprint: string } | null {
  const r = readList();
  if (!r.ok) return null;
  const item = r.list.find((x) => isObj(x) && x.id === id);
  if (!item || !isObj(item) || !("doc" in item)) return null;
  const rec = recoverDocument(item.doc);
  return rec ? { ...rec, fingerprint: fingerprint(item.doc) } : null;
}

/** 其他标签页写存档时浏览器发 storage 事件，用它判断是不是存档键变了 */
export function isDocsKey(key: string | null): boolean {
  return key === null || key === DOCS_KEY;
}

/** 记住当前打开的是哪一份（下次打开编辑器时恢复它） */
export function setCurrentId(id: string): void {
  try {
    localStorage.setItem(CURRENT_KEY, id);
  } catch {
    // 记不住当前文档不影响内容本身，忽略
  }
}

/**
 * 写入（或新增）一份简历，不改变「当前打开」的是哪一份，也不改变列表顺序（新增的排在最后）。
 * 云同步拉取时用。存档读不出来时拒绝写入，返回错误信息
 */
export function putDocument(id: string, doc: RuyeDocument): string | null {
  const r = readList();
  if (!r.ok) return `写入失败：${r.message}。未写入，以免覆盖。`;
  const list = r.list.slice();
  const i = list.findIndex((x) => isObj(x) && x.id === id);
  if (i >= 0) list[i] = { id, doc };
  else list.push({ id, doc });
  try {
    localStorage.setItem(DOCS_KEY, JSON.stringify(list));
    return null;
  } catch (e) {
    return `写入失败：${(e as Error).message}`;
  }
}

/** 删除一份简历。存档读不出来时拒绝写入，返回错误信息 */
export function deleteDocument(id: string): string | null {
  const r = readList();
  if (!r.ok) return `删除失败：${r.message}。未写入，以免覆盖。`;
  try {
    localStorage.setItem(DOCS_KEY, JSON.stringify(r.list.filter((x) => !(isObj(x) && x.id === id))));
    return null;
  } catch (e) {
    return `删除失败：${(e as Error).message}`;
  }
}

export function download(name: string, data: BlobPart, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// 本地存储：只用 localStorage，不上传任何内容。
// 键：ruye:documents（文档列表）、ruye:currentId（当前文档）
//
// 格式有问题的草稿也要读得回来。读失败时保留原始字符串，调用方在用户明确放弃之前不得覆盖。

import { createEmptyDocument, recoverDocument, type RuyeDocument, type ValidationIssue } from "../../../packages/schema/src/index.ts";

const DOCS_KEY = "ruye:documents";
const CURRENT_KEY = "ruye:currentId";

export type LoadOutcome =
  | { kind: "empty" }
  | { kind: "draft"; id: string; doc: RuyeDocument; issues: ValidationIssue[] }
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
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** 打开编辑器时怎么用本地存档。只有真正没有存档时才用示例。 */
export function openSession(outcome: LoadOutcome, sample: RuyeDocument): SessionStart {
  if (outcome.kind === "empty") {
    return { doc: structuredClone(sample), persist: true, isSample: true, notice: null, rawBackup: null, storageId: null };
  }
  if (outcome.kind === "draft") {
    const notice = outcome.issues.length
      ? `已恢复本地草稿，姓名和正文都还在。有 ${outcome.issues.length} 处格式问题需要修正，刷新不会丢掉内容。`
      : null;
    return { doc: outcome.doc, persist: true, isSample: false, notice, rawBackup: null, storageId: outcome.id };
  }
  return {
    doc: createEmptyDocument(),
    persist: false,
    isSample: false,
    notice: `${outcome.message}可以下载原始存档。在你明确新建、载入示例或导入之前，不会写入，也不会换成示例简历。`,
    rawBackup: outcome.raw,
    storageId: null,
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
    return { kind: "draft", id, doc: recovered.doc, issues: recovered.issues };
  }
  return { kind: "unreadable", message: "本地存档里没有可恢复的简历，已原样保留，没有用示例覆盖。", raw };
}

/** 保存当前文档，包括尚未通过校验的草稿。返回错误信息（例如超出配额）或 null */
export function saveCurrent(doc: RuyeDocument, id?: string): string | null {
  try {
    const current = id ?? localStorage.getItem(CURRENT_KEY) ?? "doc-1";
    const stored = { id: current, doc: { ...doc, meta: { ...doc.meta, updatedAt: new Date().toISOString() } } };
    const others = otherEntries(current);
    localStorage.setItem(DOCS_KEY, JSON.stringify([stored, ...others]));
    localStorage.setItem(CURRENT_KEY, current);
    return null;
  } catch (e) {
    return `本地保存失败：${(e as Error).message}`;
  }
}

function otherEntries(id: string): Record<string, unknown>[] {
  try {
    const raw = localStorage.getItem(DOCS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as unknown;
    if (!Array.isArray(list)) return [];
    return list.filter((x): x is Record<string, unknown> => isObj(x) && x.id !== id);
  } catch {
    return [];
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

// 本地存储：只用 localStorage，不上传任何内容。
// 键：ruye:documents（文档列表）、ruye:currentId（当前文档）

import { validateDocument, type RuyeDocument } from "../../../packages/schema/src/index.ts";

const DOCS_KEY = "ruye:documents";
const CURRENT_KEY = "ruye:currentId";

interface Stored {
  id: string;
  doc: RuyeDocument;
}

function readAll(): Stored[] {
  try {
    const raw = localStorage.getItem(DOCS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as Stored[];
    return Array.isArray(list) ? list.filter((x) => x && typeof x.id === "string" && validateDocument(x.doc).ok) : [];
  } catch {
    return [];
  }
}

export function loadCurrent(): RuyeDocument | null {
  try {
    const list = readAll();
    const id = localStorage.getItem(CURRENT_KEY);
    return (list.find((x) => x.id === id) ?? list[0])?.doc ?? null;
  } catch {
    return null;
  }
}

/** 保存当前文档；返回错误信息（例如超出浏览器存储配额）或 null */
export function saveCurrent(doc: RuyeDocument): string | null {
  try {
    const list = readAll();
    const id = localStorage.getItem(CURRENT_KEY) ?? "doc-1";
    const next = list.filter((x) => x.id !== id);
    next.unshift({ id, doc: { ...doc, meta: { ...doc.meta, updatedAt: new Date().toISOString() } } });
    localStorage.setItem(DOCS_KEY, JSON.stringify(next));
    localStorage.setItem(CURRENT_KEY, id);
    return null;
  } catch (e) {
    return `本地保存失败：${(e as Error).message}`;
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

// 编辑器对文档的所有修改都走这里：纯函数，返回新文档，不改原对象（便于撤销和测试）。

import { createModule, MODULE_LABELS, newId, type Module, type ModuleType, type RuyeDocument } from "../../../packages/schema/src/index.ts";

export type ListModule = Extract<Module, { data: { items: unknown[] } }>;
export type ListItem = ListModule["data"]["items"][number];

const touch = (doc: RuyeDocument): RuyeDocument => ({ ...doc, meta: { ...doc.meta, updatedAt: new Date().toISOString() } });

export function replaceModule(doc: RuyeDocument, id: string, f: (m: Module) => Module): RuyeDocument {
  return touch({ ...doc, modules: doc.modules.map((m) => (m.id === id ? f(m) : m)) });
}

export function moveModule(doc: RuyeDocument, id: string, delta: number): RuyeDocument {
  const i = doc.modules.findIndex((m) => m.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= doc.modules.length) return doc;
  const modules = [...doc.modules];
  [modules[i], modules[j]] = [modules[j], modules[i]];
  return touch({ ...doc, modules });
}

/** 拖拽排序：把 id 移到 targetId 的位置 */
export function moveModuleTo(doc: RuyeDocument, id: string, targetId: string): RuyeDocument {
  if (id === targetId) return doc;
  const from = doc.modules.findIndex((m) => m.id === id);
  const to = doc.modules.findIndex((m) => m.id === targetId);
  if (from < 0 || to < 0) return doc;
  const modules = [...doc.modules];
  const [m] = modules.splice(from, 1);
  modules.splice(to, 0, m);
  return touch({ ...doc, modules });
}

export function toggleModule(doc: RuyeDocument, id: string): RuyeDocument {
  return replaceModule(doc, id, (m) => ({ ...m, visible: !m.visible }));
}

export function addModule(doc: RuyeDocument, type: ModuleType): { doc: RuyeDocument; id: string } {
  const m = createModule(type);
  if (type === "basic_info") return { doc: touch({ ...doc, modules: [m, ...doc.modules] }), id: m.id };
  return { doc: touch({ ...doc, modules: [...doc.modules, m] }), id: m.id };
}

export function removeModule(doc: RuyeDocument, id: string): RuyeDocument {
  return touch({ ...doc, modules: doc.modules.filter((m) => m.id !== id) });
}

/** 文档里还没有的模块类型（v1 每种最多一个） */
export function missingTypes(doc: RuyeDocument): ModuleType[] {
  const have = new Set(doc.modules.map((m) => m.type));
  return (Object.keys(MODULE_LABELS) as ModuleType[]).filter((t) => !have.has(t));
}

export function newItem(type: ListModule["type"]): ListItem {
  const id = newId(type);
  switch (type) {
    case "education":
      return { id, school: "", start: "", end: "", highlights: [] };
    case "work":
    case "internship":
      return { id, org: "", title: "", start: "", end: "", techStack: [], bullets: [""] };
    case "project":
      return { id, name: "", techStack: [], bullets: [""] };
    case "research":
      return { id, name: "", bullets: [""] };
    case "paper":
      return { id, title: "" };
    case "award":
      return { id, name: "" };
  }
}

function withItems(m: Module, f: (items: ListItem[]) => ListItem[]): Module {
  if (!("items" in m.data)) return m;
  return { ...m, data: { ...m.data, items: f(m.data.items as ListItem[]) } } as Module;
}

export function addItem(doc: RuyeDocument, moduleId: string): { doc: RuyeDocument; itemId: string | null } {
  let itemId: string | null = null;
  const next = replaceModule(doc, moduleId, (m) =>
    withItems(m, (items) => {
      const it = newItem(m.type as ListModule["type"]);
      itemId = it.id;
      return [...items, it];
    }),
  );
  return { doc: next, itemId };
}

export function updateItem(doc: RuyeDocument, moduleId: string, itemId: string, patch: Record<string, unknown>): RuyeDocument {
  return replaceModule(doc, moduleId, (m) => withItems(m, (items) => items.map((it) => (it.id === itemId ? ({ ...it, ...patch } as ListItem) : it))));
}

export function moveItem(doc: RuyeDocument, moduleId: string, itemId: string, delta: number): RuyeDocument {
  return replaceModule(doc, moduleId, (m) =>
    withItems(m, (items) => {
      const i = items.findIndex((x) => x.id === itemId);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= items.length) return items;
      const next = [...items];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    }),
  );
}

export function removeItem(doc: RuyeDocument, moduleId: string, itemId: string): RuyeDocument {
  return replaceModule(doc, moduleId, (m) => withItems(m, (items) => items.filter((x) => x.id !== itemId)));
}

/** 条目在列表里显示的标题 */
export function itemTitle(it: ListItem): string {
  const r = it as unknown as Record<string, unknown>;
  const main = (r.school ?? r.org ?? r.name ?? r.title ?? "") as string;
  const sub = (r.major ?? r.title ?? r.role ?? r.issuer ?? "") as string;
  const t = [main, sub !== main ? sub : ""].filter(Boolean).join(" · ");
  return t || "（未填写）";
}

/** 模块在左栏显示的摘要（条目数等） */
export function moduleSummary(m: Module): string {
  switch (m.type) {
    case "basic_info":
      return m.data.name || "未填写姓名";
    case "job_intention":
      return m.data.role || "未填写岗位";
    case "skills": {
      const notes = (m.data.notes ?? []).filter((n) => n.trim() !== "").length;
      const parts = [m.data.categories.length ? `${m.data.categories.length} 类` : "", notes ? `${notes} 句` : ""].filter(Boolean);
      return parts.join(" · ") || "未填写";
    }
    case "summary":
      return m.data.text.trim() ? `${m.data.text.trim().length} 字` : "未填写";
    default:
      return `${m.data.items.length} 条`;
  }
}

/** 从文档标题、姓名、意向生成默认标题 */
export function syncTitle(doc: RuyeDocument): RuyeDocument {
  const info = doc.modules.find((m) => m.type === "basic_info");
  const intent = doc.modules.find((m) => m.type === "job_intention");
  const name = info && info.type === "basic_info" ? info.data.name : "";
  const role = intent && intent.type === "job_intention" ? intent.data.role ?? "" : "";
  const title = [name, role].filter(Boolean).join("-") || "未命名简历";
  return title === doc.meta.title ? doc : { ...doc, meta: { ...doc.meta, title } };
}

/** 复制一份简历（例如为另一个岗位改一版）：内容相同，备注名加「副本」 */
export function duplicateDocument(doc: RuyeDocument): RuyeDocument {
  const copy = structuredClone(doc);
  const base = doc.meta.alias?.trim() || doc.meta.title;
  copy.meta = { ...copy.meta, alias: `${base} 副本`, updatedAt: new Date().toISOString() };
  return copy;
}

/** 设置备注名；空白视为清除 */
export function setAlias(doc: RuyeDocument, alias: string): RuyeDocument {
  const meta = { ...doc.meta };
  if (alias.trim() === "") delete meta.alias;
  else meta.alias = alias;
  return { ...doc, meta };
}

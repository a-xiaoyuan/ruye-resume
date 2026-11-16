import type { Module, ModuleType, RuyeDocument } from "./types.ts";

/** 生成短 id（编辑器内用，不要求密码学安全） */
export function newId(prefix = "id"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

export function createModule(type: ModuleType): Module {
  const base = { id: newId("m"), visible: true };
  switch (type) {
    case "basic_info":
      return { ...base, type, data: { name: "" } };
    case "job_intention":
      return { ...base, type, data: {} };
    case "skills":
      return { ...base, type, data: { categories: [] } };
    case "summary":
      return { ...base, type, data: { text: "" } };
    default:
      return { ...base, type, data: { items: [] } } as Module;
  }
}

export function createEmptyDocument(): RuyeDocument {
  return {
    version: 1,
    meta: { title: "未命名简历", locale: "zh-CN", updatedAt: new Date().toISOString() },
    layout: { templateId: "classic", pageMode: "fit-a4" },
    modules: (["basic_info", "job_intention", "education", "skills", "internship", "project", "award"] as ModuleType[]).map(createModule),
  };
}

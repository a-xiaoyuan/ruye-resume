// 界面皮肤：只换编辑器的外观，不影响简历本身（简历的样子由「外观」里的模板决定）
import type { ModuleType } from "../../../packages/schema/src/index.ts";

export type Skin = "paper" | "terminal";

export const SKINS: { key: Skin; label: string; hint: string }[] = [
  { key: "paper", label: "浅色", hint: "整篇连着写" },
  { key: "terminal", label: "深色终端", hint: "一次打开一个模块" },
];

const KEY = "ruye.skin";

export function loadSkin(): Skin {
  try {
    const v = localStorage.getItem(KEY);
    return v === "terminal" ? v : "paper";
  } catch {
    return "paper";
  }
}

export function saveSkin(s: Skin) {
  try {
    localStorage.setItem(KEY, s);
  } catch {
    // 存不了就只在这次打开里生效
  }
}

/** 终端皮肤里把模块显示成「文件」 */
export const MODULE_FILES: Record<ModuleType, string> = {
  basic_info: "profile.md",
  job_intention: "intention.md",
  education: "education.md",
  work: "work.md",
  internship: "internship.md",
  project: "projects.md",
  skills: "skills.md",
  research: "research.md",
  paper: "papers.md",
  award: "awards.md",
  summary: "summary.md",
};

// 界面皮肤：只换编辑器的外观，不影响简历本身（简历的样子由「外观」里的模板决定）
import type { ModuleType } from "../../../packages/schema/src/index.ts";

export type Skin = "paper" | "terminal" | "manuscript";

export const SKINS: { key: Skin; label: string; hint: string }[] = [
  { key: "paper", label: "纸感", hint: "浅色，安静" },
  { key: "terminal", label: "终端", hint: "深色，等宽字体" },
  { key: "manuscript", label: "稿纸", hint: "绿格稿纸，朱笔批注" },
];

const KEY = "ruye.skin";

export function loadSkin(): Skin {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "brutal") return "manuscript"; // 旧的「撞色」已换成「稿纸」
    return v === "terminal" || v === "manuscript" ? v : "paper";
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

// Node 环境下读取模板源码（测试、smoke 脚本用）
import { readFileSync } from "node:fs";
import type { TemplateId } from "../../schema/src/index.ts";
import { createTemplates, TEMPLATE_META } from "./index.ts";

export function loadNodeTemplates() {
  const sources: Partial<Record<TemplateId, string>> = {};
  for (const m of TEMPLATE_META) {
    sources[m.id] = readFileSync(new URL(`../typst/${m.id}.typ`, import.meta.url), "utf8");
  }
  return createTemplates(sources);
}

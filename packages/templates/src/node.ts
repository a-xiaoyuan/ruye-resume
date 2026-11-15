// Node 环境下读取模板源码（测试、smoke 脚本用）
import { readFileSync } from "node:fs";
import { createTemplates, TEMPLATE_META, type TemplateSources } from "./index.ts";

const read = (name: string) => readFileSync(new URL(`../typst/${name}.typ`, import.meta.url), "utf8");

export function loadNodeTemplates() {
  const sources: TemplateSources = { common: read("common") };
  for (const m of TEMPLATE_META) sources[m.id] = read(m.id);
  return createTemplates(sources);
}

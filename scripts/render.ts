// 渲染单份样本为 PDF，便于肉眼检查：node scripts/render.ts <fixture> <templateId> [mode] [theme]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { PageMode, RuyeDocument, ThemeId } from "../packages/schema/src/index.ts";
import { describeFit, LayoutEngine } from "../packages/engine/src/index.ts";
import { loadNodeTemplates } from "../packages/templates/src/node.ts";
import { loadNodeTypst } from "./typst-node.ts";

const [name = "full", id = "classic", mode = "fit-a4", theme] = process.argv.slice(2);
const loaded = await loadNodeTypst();
if ("skip" in loaded) throw new Error(loaded.skip);
const engine = new LayoutEngine(loaded.backend);
const template = loadNodeTemplates().get(id as never);
if (!template) throw new Error(`未知模板 ${id}`);
const doc: RuyeDocument = JSON.parse(readFileSync(new URL(`../fixtures/${name}.ruye.json`, import.meta.url), "utf8"));
if (theme) doc.layout.theme = theme as ThemeId;
const r = await engine.layout(doc, template, mode as PageMode);
console.log(`${id} / ${name} / ${mode}: ${r.status}，${r.metrics.pageCount} 页，内容 ${r.metrics.contentHeightMm}mm — ${describeFit(r).text}`);
mkdirSync(new URL("../out/", import.meta.url), { recursive: true });
const file = new URL(`../out/${id}-${name}-${mode}${theme ? "-" + theme : ""}.pdf`, import.meta.url);
writeFileSync(file, await engine.pdf(doc, template, r.tokens, r.pageHeight));
console.log(file.pathname);

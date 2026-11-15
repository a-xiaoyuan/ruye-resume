// pnpm smoke：用真实 Typst 把三份样本按三种模式排一遍，输出 PDF 和报告到 out/。
// 阶段 1 的验收报告 docs/sample1-report.md 由它生成。

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { PageMode, RuyeDocument } from "../packages/schema/src/index.ts";
import { describeFit, LayoutEngine, STEP_LABELS } from "../packages/engine/src/index.ts";
import { loadNodeTemplates } from "../packages/templates/src/node.ts";
import { loadNodeTypst } from "./typst-node.ts";

const loaded = await loadNodeTypst();
if ("skip" in loaded) {
  console.error(loaded.skip);
  process.exit(1);
}
const engine = new LayoutEngine(loaded.backend);
const template = loadNodeTemplates().get("campus-serif")!;
const out = new URL("../out/", import.meta.url);
mkdirSync(out, { recursive: true });

const lines: string[] = ["# 样本报告（自动生成）", "", `生成时间：${new Date().toISOString()}　模板：${template.id}`, ""];
lines.push("| 样本 | 模式 | 状态 | 页数 | 内容高度 | 导出页高 | 收紧步骤 | 说明 | PDF |", "|---|---|---|---|---|---|---|---|---|");

for (const name of ["short", "medium", "long"]) {
  const doc: RuyeDocument = JSON.parse(readFileSync(new URL(`../fixtures/${name}.ruye.json`, import.meta.url), "utf8"));
  for (const mode of ["standard", "fit-a4", "continuous"] as PageMode[]) {
    const t0 = performance.now();
    const r = await engine.layout(doc, template, mode);
    const file = `${name}-${mode}.pdf`;
    let pdfNote = file;
    if (r.status === "overflow" || r.status === "too-long") pdfNote = "（失败，不导出）";
    else writeFileSync(new URL(file, out), await engine.pdf(doc, template, r.tokens, r.pageHeight));
    const ms = Math.round(performance.now() - t0);
    lines.push(
      `| ${name} | ${mode} | ${r.status} | ${r.metrics.pageCount} | ${r.metrics.contentHeightMm}mm | ${r.metrics.pageHeightMm}mm | ${r.appliedSteps.map((s) => STEP_LABELS[s]).join("、") || "—"} | ${describeFit(r).text} | ${pdfNote} |`,
    );
    if (r.suggestions) for (const s of r.suggestions) lines.push(`|  |  |  |  |  |  |  | 建议：${s} |  |`);
    console.log(`${name} / ${mode}: ${r.status}（${ms}ms）`);
  }
}

writeFileSync(new URL("report.md", out), lines.join("\n") + "\n");
console.log(`\n报告：out/report.md，PDF：out/*.pdf`);

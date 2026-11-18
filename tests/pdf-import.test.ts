import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { LayoutEngine } from "../packages/engine/src/index.ts";
import { loadNodeTemplates } from "../packages/templates/src/node.ts";
import { loadNodeTypst } from "../scripts/typst-node.ts";
import { LayoutService } from "../apps/web/src/layout-service.ts";
import { importPdfBytes, pdfPlainTextToMarkdown } from "../apps/web/src/pdf-import.ts";

function latinPdf(text: string): Uint8Array {
  const stream = `BT /F1 24 Tf 72 720 Td (${text.replace(/[()\\]/g, "")}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >> stream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(body.length);
    body += `${i + 1} 0 obj ${o} endobj\n`;
  });
  const xref = body.length;
  let table = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) table += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  body += `${table}trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(body);
}

test("PDF 文字整理成可导入的 Markdown", () => {
  const md = pdfPlainTextToMarkdown(`张三
电话：13800000000
教育背景
示例大学 · 计算机 · 本科
2020.09 - 2024.06
GPA 3.8
工作经历
示例公司 · 后端
2024.07 - 至今
写过接口`);
  assert.match(md, /^# 张三/);
  assert.match(md, /## 教育背景/);
  assert.match(md, /### 示例大学/);
  assert.match(md, /## 工作经历/);
  assert.match(md, /至今/);
});

test("文本 PDF 在本地读出姓名并导入，不把文件当成功的空简历", async () => {
  const r = await importPdfBytes(latinPdf("Zhang San"));
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const basic = r.doc.modules.find((m) => m.type === "basic_info");
  assert.ok(basic && basic.type === "basic_info");
  assert.equal(basic.data.name, "Zhang San");
  assert.match(r.message, /没有上传/);
});

test("没有文字的 PDF 明确失败，结果里没有文档", async () => {
  const blank = latinPdf("");
  const r = await importPdfBytes(blank);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.message, /没有可复制的文字/);
  assert.match(r.message, /没有被替换/);
  assert.match(r.message, /没有.*上传|没有把文件上传/);
  assert.equal("doc" in r, false);
});

test("损坏、加密、过大的 PDF 都失败且不给出文档", async () => {
  const corrupt = await importPdfBytes(new TextEncoder().encode("hello"));
  assert.equal(corrupt.ok, false);
  if (!corrupt.ok) assert.match(corrupt.message, /不是有效的 PDF/);

  const locked = await importPdfBytes(new TextEncoder().encode("%PDF-1.4\n1 0 obj << /Encrypt 2 0 R >> endobj\n%%EOF"));
  assert.equal(locked.ok, false);
  if (!locked.ok) assert.match(locked.message, /密码/);

  const big = new Uint8Array(8 * 1024 * 1024 + 1);
  big.set(new TextEncoder().encode("%PDF-1.4\n"), 0);
  const over = await importPdfBytes(big);
  assert.equal(over.ok, false);
  if (!over.ok) assert.match(over.message, /8MB/);
});

const typst = await loadNodeTypst();
const typstSkip = "skip" in typst ? typst.skip : false;

test("本应用导出的 PDF 再导入，中文姓名、电话、学校、日期和链接还在", { skip: typstSkip }, async () => {
  if (!("backend" in typst)) return;
  const svc = new LayoutService(new LayoutEngine(typst.backend), loadNodeTemplates());
  const doc = JSON.parse(readFileSync(new URL("../fixtures/full.ruye.json", import.meta.url), "utf8"));
  const out = await svc.exportPdf(doc, "fit-a4");
  assert.equal(out.kind, "pdf");
  if (out.kind !== "pdf") return;
  const r = await importPdfBytes(out.pdf);
  assert.equal(r.ok, true, r.ok ? "" : r.message);
  if (!r.ok) return;
  const basic = r.doc.modules.find((m) => m.type === "basic_info");
  assert.ok(basic && basic.type === "basic_info");
  assert.equal(basic.data.name, "林知夏");
  assert.equal(basic.data.phone, "13800000000");
  assert.equal(basic.data.email, "zhixia.lin@example.com");
  assert.equal(basic.data.github, "https://github.com/example");
  assert.equal(basic.data.photoDataUrl, undefined);
  const edu = r.doc.modules.find((m) => m.type === "education");
  assert.ok(edu && edu.type === "education");
  assert.equal(edu.data.items[0].school, "示例理工大学");
  assert.equal(edu.data.items[0].major, "网络工程");
  assert.equal(edu.data.items[0].degree, "本科");
  assert.equal(edu.data.items[0].start, "2024-09");
  assert.equal(edu.data.items[0].end, "2028-06");
  const projects = r.doc.modules.find((m) => m.type === "project");
  assert.ok(projects && projects.type === "project");
  assert.equal(projects.data.items[1]?.name, "轻量级 RPC 框架");
  assert.equal(projects.data.items[1]?.url, "https://github.com/example/mini-rpc");
  assert.match(r.message, /没有上传/);
  assert.match(r.message, /扫描件/);
  assert.match(r.message, /照片/);
});

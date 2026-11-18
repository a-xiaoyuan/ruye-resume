import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { toMarkdown, type RuyeDocument } from "../packages/schema/src/index.ts";
import { parseImport, parseImportAsync, parsePdfImport } from "../apps/web/src/import-file.ts";
import { parseResumeFromPdfLines } from "../apps/web/src/pdf-resume.ts";

const load = (name: string): RuyeDocument => JSON.parse(readFileSync(new URL(`../fixtures/${name}.ruye.json`, import.meta.url), "utf8"));

test("导入 JSON：合法、可恢复、无法恢复、不是 JSON", () => {
  const doc = load("role-go");
  const ok = parseImport("a.ruye.json", JSON.stringify(doc));
  assert.ok(ok.ok && ok.doc.meta.title === doc.meta.title && !ok.level);

  const broken = structuredClone(doc) as unknown as { layout: { templateId: string } };
  broken.layout.templateId = "nope";
  const rec = parseImport("a.JSON", JSON.stringify(broken));
  assert.ok(rec.ok && rec.level === "error" && rec.sticky);

  const bad = parseImport("a.json", JSON.stringify({ hello: 1 }));
  assert.ok(!bad.ok && bad.message.includes("没有被替换"));
  const notJson = parseImport("a.json", "{oops");
  assert.ok(!notJson.ok && notJson.message.includes("不是合法的 JSON"));
});

test("导入 Markdown：岗位示例往返", () => {
  for (const name of ["role-go", "role-frontend", "role-testdev", "role-algo", "role-pm"]) {
    const r = parseImport("a.md", toMarkdown(load(name)));
    assert.ok(r.ok, name);
    assert.equal(r.message, "已从 Markdown 导入。", name);
  }
});

test("PDF 文本行解析：基础信息与各模块提取", () => {
  const sampleLines = [
    "张小明",
    "电话：13812345678  邮箱：xiaoming@example.com  城市：北京",
    "求职意向：前端高级工程师",
    "教育背景",
    "北京航空航天大学 · 软件工程 · 硕士",
    "2019.09 - 2022.06",
    "- 获得国家奖学金，专业排名前 5%",
    "工作经历",
    "字节跳动 · 前端开发专家",
    "2022.07 - 至今",
    "技术栈：Vue、React、TypeScript",
    "- 主导自研低代码排版引擎研发",
    "- 优化首屏加载性能 40%",
    "项目经历",
    "如页简历编辑器",
    "2023.03 - 2023.12",
    "- 开源现代化技术简历编辑器",
    "专业技能",
    "前端：React、Vue3、Vite、TypeScript",
    "后端：Node.js、Go、MySQL",
    "- 深入理解前端性能优化及浏览器渲染原理",
    "荣誉奖项",
    "全国大学生程序设计竞赛金奖 2021.10",
    "自我评价",
    "热爱前端技术，拥有良好的工程素养与架构能力。",
  ];

  const res = parseResumeFromPdfLines(sampleLines, "张小明简历.pdf");
  assert.equal(res.doc.meta.title, "张小明的简历");

  const basic = res.doc.modules.find((m) => m.type === "basic_info");
  assert.ok(basic && basic.type === "basic_info");
  assert.equal(basic.data.name, "张小明");
  assert.equal(basic.data.phone, "13812345678");
  assert.equal(basic.data.email, "xiaoming@example.com");
  assert.equal(basic.data.location, "北京");

  const edu = res.doc.modules.find((m) => m.type === "education");
  assert.ok(edu && edu.type === "education");
  assert.equal(edu.data.items[0].school, "北京航空航天大学");
  assert.equal(edu.data.items[0].degree, "硕士");

  const work = res.doc.modules.find((m) => m.type === "work");
  assert.ok(work && work.type === "work");
  assert.equal(work.data.items[0].org, "字节跳动");
  assert.equal(work.data.items[0].bullets.length, 2);

  const skills = res.doc.modules.find((m) => m.type === "skills");
  assert.ok(skills && skills.type === "skills");
  assert.equal(skills.data.categories.length, 2);
  assert.equal(skills.data.notes?.length, 1);
});

/** 构造一个包含文本的极简有效 PDF 字节用于端到端测试 */
function createMinimalPdf(lines: string[]): Uint8Array {
  const streamContent = ["BT", "/F1 12 Tf", "50 700 Td", ...lines.map((l, i) => (i === 0 ? `(${l}) Tj` : `0 -20 Td (${l}) Tj`)), "ET"].join("\n");
  const streamBytes = Buffer.from(streamContent, "utf8");

  const objects: Buffer[] = [];
  objects[1] = Buffer.from("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  objects[2] = Buffer.from("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  objects[3] = Buffer.from("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n");
  objects[4] = Buffer.from(`4 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n${streamContent}\nendstream\nendobj\n`);
  objects[5] = Buffer.from("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");

  const header = Buffer.from("%PDF-1.4\n");
  let currentOffset = header.length;
  const offsets: number[] = [0];

  for (let i = 1; i <= 5; i++) {
    offsets[i] = currentOffset;
    currentOffset += objects[i].length;
  }

  let xref = `xref\n0 6\n0000000000 65535 f \n`;
  for (let i = 1; i <= 5; i++) {
    xref += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  }
  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${currentOffset}\n%%EOF\n`;

  return Buffer.concat([header, ...objects.slice(1), Buffer.from(xref), Buffer.from(trailer)]);
}

test("PDF 端到端解析与 parseImportAsync", async () => {
  const pdfBytes = createMinimalPdf(["Alex Wang", "Phone: 13900139000 Email: alex@test.com"]);

  const res = await parsePdfImport(pdfBytes, "alex-resume.pdf");
  assert.ok(res.ok);
  assert.ok(res.message.includes("已成功从 PDF 导入"));
  assert.equal(res.doc.meta.title, "Alex Wang的简历");

  const asyncRes = await parseImportAsync("alex-resume.pdf", pdfBytes);
  assert.ok(asyncRes.ok);

  const emptyRes = await parsePdfImport(new Uint8Array([1, 2, 3]), "broken.pdf");
  assert.ok(!emptyRes.ok);
  assert.ok(emptyRes.message.includes("失败"));
});

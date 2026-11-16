import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { RuyeDocument } from "../packages/schema/src/index.ts";
import {
  A4_HEIGHT_MM,
  checkTokenFloors,
  describeFit,
  FIT_STEPS,
  LayoutEngine,
  parseSvgSize,
  READABILITY_FLOOR,
  sanitizeSvgLinks,
  parseSvgPages,
  countPdfPages,
  pdfPageHeightsMm,
  findMissingChars,
  type TypographyTokens,
} from "../packages/engine/src/index.ts";
import { decodeDataUrl, sortByRecommended, TEMPLATE_META } from "../packages/templates/src/index.ts";
import { loadNodeTemplates } from "../packages/templates/src/node.ts";
import { FakeBackend } from "./helpers/fake-backend.ts";

const load = (name: string): RuyeDocument => JSON.parse(readFileSync(new URL(`../fixtures/${name}.ruye.json`, import.meta.url), "utf8"));
const template = loadNodeTemplates().get("campus-serif")!;

/** 把长样本的项目经历复制 n 倍，造一份必然溢出的超长文档 */
function inflate(doc: RuyeDocument, times: number): RuyeDocument {
  const d = structuredClone(doc);
  const proj = d.modules.find((m) => m.type === "project");
  if (proj && proj.type === "project") {
    const base = proj.data.items;
    proj.data.items = Array.from({ length: times }, (_, k) => base.map((it) => ({ ...it, id: `${it.id}-${k}` }))).flat();
  }
  return d;
}

function assertAboveFloor(t: TypographyTokens) {
  const f = READABILITY_FLOOR;
  assert.ok(t.bodyPt >= f.bodyPt && t.metaPt >= f.bodyPt, "正文/次级字号低于 10.5pt");
  assert.ok(t.namePt >= f.namePt && t.headingPt >= f.headingPt, "标题字号低于底线");
  assert.ok(t.lineHeight >= f.lineHeight, "行距低于 1.35");
  for (const v of Object.values(t.pageMarginMm)) assert.ok(v >= f.pageMarginMm, "页边距低于 12mm");
}

test("三套模板的 token 都满足可读性底线", () => {
  assert.equal(TEMPLATE_META.length, 3);
  for (const m of TEMPLATE_META) assert.deepEqual(checkTokenFloors(m.tokens.default, m.tokens.floor), [], m.id);
});

test("按模板推荐顺序排列模块", () => {
  const doc = load("long");
  const sorted = sortByRecommended(doc, "social-sans");
  assert.deepEqual(sorted.modules.slice(0, 4).map((m) => m.type), ["basic_info", "job_intention", "skills", "internship"]);
  assert.equal(sorted.modules.length, doc.modules.length);
});

test("解析 typst.ts SVG 根元素尺寸", () => {
  // 根元素格式取自 typst.ts vec2svg frontend 的 header_inner
  const svg = `<svg style="overflow: visible;" class="typst-doc" viewBox="0 0 595.276 841.890" width="595.276" height="841.890" data-width="595.276" data-height="841.890" xmlns="http://www.w3.org/2000/svg"><g/></svg>`;
  assert.deepEqual(parseSvgSize(svg), { widthPt: 595.276, heightPt: 841.89 });
  assert.deepEqual(parseSvgSize(`<svg viewBox="0 0 100 200"></svg>`), { widthPt: 100, heightPt: 200 });
  assert.throws(() => parseSvgSize("<div></div>"));
});

test("数据只走 JSON 文件，用户文本不进入 Typst 源码", () => {
  const doc = load("short");
  if (doc.modules[0].type === "basic_info") doc.modules[0].data.name = '#panic("x") *粗体* $x$ <label>';
  const input = template.build(doc, template.defaultTokens, 297);
  assert.ok(!(input.files["/main.typ"] as string).includes("#panic"));
  assert.ok(new TextDecoder().decode(input.files["/data.json"] as Uint8Array).includes("#panic"));
});

test("照片作为二进制文件注入，data.json 不带 base64", () => {
  const doc = load("short");
  // 1x1 PNG
  const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
  if (doc.modules[0].type === "basic_info") doc.modules[0].data.photoDataUrl = `data:image/png;base64,${png}`;
  const input = template.build(doc, template.defaultTokens, 297);
  assert.ok(input.files["/photo.png"] instanceof Uint8Array);
  const data = new TextDecoder().decode(input.files["/data.json"] as Uint8Array);
  assert.ok(!data.includes("base64"));
  const page = JSON.parse(new TextDecoder().decode(input.files["/page.json"] as Uint8Array));
  assert.equal(page.photo, "photo.png");
});

test("短样本 + fit-a4：默认 token 即装下", async () => {
  const engine = new LayoutEngine(new FakeBackend());
  const r = await engine.fitA4(load("short"), template);
  assert.equal(r.status, "fitted-default");
  assert.equal(r.metrics.pageCount, 1);
  assert.equal(r.metrics.overflowMm, 0);
  assert.deepEqual(r.tokens, template.defaultTokens);
  assert.equal(r.pageHeight, A4_HEIGHT_MM);
});

test("短样本 + standard：1 页", async () => {
  const r = await new LayoutEngine(new FakeBackend()).standard(load("short"), template);
  assert.equal(r.status, "paginated");
  assert.equal(r.metrics.pageCount, 1);
});

test("中等样本 + fit-a4：收紧后装下，按顺序收紧并提前停止", async () => {
  const engine = new LayoutEngine(new FakeBackend());
  const doc = load("medium");
  const h = await engine.contentHeightMm(doc, template, template.defaultTokens);
  assert.ok(h > A4_HEIGHT_MM, `中等样本默认高度应超过一页，实际 ${h.toFixed(1)}mm`);
  const r = await engine.fitA4(doc, template);
  assert.equal(r.status, "fitted-tightened");
  assert.ok(r.appliedSteps.length > 0);
  // appliedSteps 必须是 FIT_STEPS 的前缀（按顺序收紧，不跳步）
  assert.deepEqual(r.appliedSteps, FIT_STEPS.slice(0, r.appliedSteps.length));
  // 提前停止：最终 token 不应把所有步骤都推到底线
  assert.notDeepEqual(r.tokens, template.floorTokens);
  assertAboveFloor(r.tokens);
  assert.ok(r.metrics.contentHeightMm <= A4_HEIGHT_MM);
  assert.equal(r.metrics.pageCount, 1);
});

test("长样本：默认 token 不收紧时高度 > 297mm", async () => {
  const h = await new LayoutEngine(new FakeBackend()).contentHeightMm(load("long"), template, template.defaultTokens);
  assert.ok(h > A4_HEIGHT_MM, `${h}`);
});

test("超长文档 + fit-a4：溢出时如实报告，不删内容", async () => {
  const doc = inflate(load("long"), 2);
  const before = JSON.stringify(doc);
  const r = await new LayoutEngine(new FakeBackend()).fitA4(doc, template);
  assert.equal(r.status, "overflow");
  assert.equal(JSON.stringify(doc), before, "引擎不得修改用户内容");
  assert.ok(r.metrics.overflowMm > 0);
  assert.ok(r.metrics.pageCount > 1, "溢出时不得声称 1 页");
  assert.deepEqual(r.appliedSteps, [...FIT_STEPS], "溢出前应把所有步骤推到底线");
  assertAboveFloor(r.tokens);
  assert.ok(r.suggestions && r.suggestions.length >= 2 && r.suggestions.length <= 4);
  assert.ok(r.suggestions![0].includes("项目经历"), r.suggestions![0]);
  const hs = r.metrics.moduleHeights.map((m) => m.heightMm);
  assert.deepEqual(hs, [...hs].sort((a, b) => b - a), "模块占高应降序");
  assert.ok(r.metrics.itemHeights && r.metrics.itemHeights.length > 0);
  const d = describeFit(r);
  assert.equal(d.level, "error");
  assert.match(d.text, /^超出约 \d+ mm（约 \d+%）。占高最多的是「项目经历」。$/);
});

test("长样本 + continuous：1 页、默认字号、高度在 (297, 297×4]", async () => {
  const r = await new LayoutEngine(new FakeBackend()).continuous(load("long"), template);
  assert.equal(r.status, "continuous");
  assert.equal(r.metrics.pageCount, 1);
  assert.deepEqual(r.tokens, template.defaultTokens);
  assert.equal(r.pageHeight, "auto");
  assert.ok(r.metrics.pageHeightMm > A4_HEIGHT_MM && r.metrics.pageHeightMm <= A4_HEIGHT_MM * 4);
  assert.match(describeFit(r).text, /^无损长一页，高度约 \d\.\d\d 页 A4。$/);
});

test("短内容的 continuous 仍输出整页 A4", async () => {
  const r = await new LayoutEngine(new FakeBackend()).continuous(load("short"), template);
  assert.equal(r.pageHeight, A4_HEIGHT_MM);
  assert.equal(r.metrics.pageHeightMm, A4_HEIGHT_MM);
});

test("continuous 超过 4 页 A4 时失败", async () => {
  const r = await new LayoutEngine(new FakeBackend()).continuous(inflate(load("long"), 8), template);
  assert.equal(r.status, "too-long");
  assert.ok(r.suggestions?.[0].includes("标准分页"));
});

test("standard：长文档诚实分页", async () => {
  const r = await new LayoutEngine(new FakeBackend()).standard(load("long"), template);
  assert.ok(r.metrics.pageCount >= 2);
  assert.equal(r.metrics.overflowMm, 0);
  assert.match(describeFit(r).text, /共 \d+ 页/);
});

test("预览与导出同源：SVG 和 PDF 来自同一份 Typst 输入", async () => {
  const seen: string[] = [];
  const backend = new FakeBackend();
  const spy = {
    svg: (i: any) => (seen.push(JSON.stringify(i, (_k, v) => (v instanceof Uint8Array ? Array.from(v) : v))), backend.svg(i)),
    pdf: (i: any) => (seen.push(JSON.stringify(i, (_k, v) => (v instanceof Uint8Array ? Array.from(v) : v))), backend.pdf(i)),
  };
  const engine = new LayoutEngine(spy);
  const doc = load("medium");
  const r = await engine.fitA4(doc, template);
  seen.length = 0;
  await engine.svg(doc, template, r.tokens, r.pageHeight);
  await engine.pdf(doc, template, r.tokens, r.pageHeight);
  assert.equal(seen.length, 2);
  assert.equal(seen[0], seen[1]);
});

test("测量结果有缓存：相同输入不重复编译", async () => {
  const backend = new FakeBackend();
  const engine = new LayoutEngine(backend);
  const doc = load("short");
  await engine.contentHeightMm(doc, template, template.defaultTokens);
  const n = backend.calls;
  await engine.contentHeightMm(doc, template, template.defaultTokens);
  assert.equal(backend.calls, n);
});

test("预览 SVG 只保留安全链接", () => {
  const svg = `<svg><a target="_blank" xlink:href="javascript:alert(1)"><use xlink:href="#g1"/></a><a href='JavaScript:x'></a><a xlink:href="https://a.com"></a><a xlink:href="mailto:a@b.c"></a><a href="data:text/html,1"></a></svg>`;
  const out = sanitizeSvgLinks(svg);
  assert.ok(!/javascript:/i.test(out) && !out.includes("data:"));
  assert.ok(out.includes('xlink:href="#g1"') && out.includes("https://a.com") && out.includes("mailto:a@b.c"));
});

test("照片数据损坏或格式不符时跳过照片，不让整份文档失败", () => {
  const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
  assert.ok(decodeDataUrl(`data:image/png;base64,${png}`));
  assert.equal(decodeDataUrl("data:image/png;base64,@@@@"), null);
  assert.equal(decodeDataUrl(`data:image/jpeg;base64,${png}`), null, "声明是 JPEG，内容是 PNG");
  assert.equal(decodeDataUrl("data:image/svg+xml;base64,PHN2Zy8+"), null);
  const doc = load("short");
  if (doc.modules[0].type === "basic_info") doc.modules[0].data.photoDataUrl = "data:image/png;base64,AAAA";
  const input = template.build(doc, template.defaultTokens, 297);
  assert.ok(!Object.keys(input.files).some((f) => f.startsWith("/photo")));
});

test("从 SVG 读出 Typst 实际分出的每一页", () => {
  const svg = `<svg class="typst-doc" data-height="1684"><g class="typst-page" transform="translate(0, 0)" data-tid="a" data-page-width="596" data-page-height="842"></g><g class="typst-page" transform="translate(0, 842)" data-tid="b" data-page-width="596" data-page-height="842"></g></svg>`;
  assert.deepEqual(parseSvgPages(svg), [{ heightPt: 842 }, { heightPt: 842 }]);
  assert.equal(parseSvgPages("<svg data-height=\"10\"></svg>"), null);
});

test("读取 PDF 自身的页数与页面高度", () => {
  const enc = (s: string) => new TextEncoder().encode(s);
  const pdf = enc("%PDF-1.7\n1 0 obj\n<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>\nendobj\n3 0 obj\n<< /Type /Page /MediaBox [0 0 595.2756 841.8898] >>\nendobj\n4 0 obj\n<< /Type /Page /MediaBox [0 0 595.2756 841.8898] >>\nendobj");
  assert.equal(countPdfPages(pdf), 2);
  assert.equal(countPdfPages(enc("<< /Type /Page >> << /Type /Page >> << /Type /Page >>")), 3);
  assert.equal(countPdfPages(enc("%PDF-1.7 nothing")), null);
  assert.deepEqual(pdfPageHeightsMm(pdf).map((h) => Math.round(h)), [297, 297]);
});

test("exportPdf：PDF 页数与排版结果不符时拒绝导出", async () => {
  const backend = new FakeBackend();
  const engine = new LayoutEngine({ svg: (i) => backend.svg(i), pdf: async () => new TextEncoder().encode("<< /Type /Pages /Count 3 >>") });
  const r = await engine.fitA4(load("short"), template);
  await assert.rejects(engine.exportPdf(load("short"), template, r), /PDF 有 3 页，但排版结果是 1 页/);
  const bad = await new LayoutEngine(backend).fitA4(inflate(load("long"), 2), template);
  await assert.rejects(engine.exportPdf(load("long"), template, bad), /失败状态/);
});

test("缺字检查：列出子集外的字；完整字体（空字符表）不检查", () => {
  const doc = load("short");
  if (doc.modules[0].type === "basic_info") doc.modules[0].data.name = "林䶮夏";
  const charset = "林夏" + doc.modules.map((m) => JSON.stringify(m.data)).join("");
  const filtered = Array.from(charset).filter((c) => c !== "䶮").join("");
  assert.deepEqual(findMissingChars(doc, filtered), ["䶮"]);
  assert.deepEqual(findMissingChars(doc, ""), []);
  if (doc.modules[0].type === "basic_info") doc.modules[0].visible = false;
  assert.deepEqual(findMissingChars(doc, filtered), [], "隐藏模块不导出，不检查");
});

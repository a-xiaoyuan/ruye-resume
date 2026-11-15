// 黄金测试（说明书 §10 表格）：用真实 Typst 排版验证。
// 需要先 pnpm install && pnpm fonts；缺任何一样时整组跳过并说明原因（CI 会在准备好后再跑一遍）。

import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { RuyeDocument } from "../packages/schema/src/index.ts";
import { A4_HEIGHT_MM, findMissingChars, LayoutEngine, parseSvgSize, PT_PER_MM, READABILITY_FLOOR } from "../packages/engine/src/index.ts";
import { loadNodeTemplates } from "../packages/templates/src/node.ts";
import { loadCharset, loadNodeTypst } from "../scripts/typst-node.ts";

const load = (name: string): RuyeDocument => JSON.parse(readFileSync(new URL(`../fixtures/${name}.ruye.json`, import.meta.url), "utf8"));
const templates = loadNodeTemplates();
const template = templates.get("campus-serif")!;
const loaded = await loadNodeTypst();
const skip = "skip" in loaded ? loaded.skip : false;
const outDir = new URL("../out/", import.meta.url);
// 1x1 灰色 PNG
const PHOTO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGOYOXMmAAOaAcwPZWQaAAAAAElFTkSuQmCC";

/** 尽力从 PDF 里读页面尺寸（Typst 可能压缩对象流，读不到就返回空数组） */
function pdfMediaBoxes(pdf: Uint8Array): number[][] {
  const text = new TextDecoder("latin1").decode(pdf);
  return [...text.matchAll(/\/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]/g)].map((m) => m.slice(1, 5).map(Number));
}

describe("Typst 黄金测试", { skip }, () => {
  let engine: LayoutEngine;
  before(() => {
    if ("backend" in loaded) engine = new LayoutEngine(loaded.backend);
    mkdirSync(outDir, { recursive: true });
  });

  test("短样本 + fit-a4：一页，无溢出", async () => {
    const r = await engine.fitA4(load("short"), template);
    assert.ok(r.status === "fitted-default" || r.status === "fitted-tightened", r.status);
    assert.equal(r.metrics.pageCount, 1);
    assert.equal(r.metrics.overflowMm, 0);
    const pdf = await engine.pdf(load("short"), template, r.tokens, r.pageHeight);
    writeFileSync(new URL("short-fit-a4.pdf", outDir), pdf);
    assert.equal(new TextDecoder("latin1").decode(pdf.slice(0, 5)), "%PDF-");
  });

  test("短样本 + standard：1 页", async () => {
    const r = await engine.standard(load("short"), template);
    assert.equal(r.metrics.pageCount, 1);
  });

  test("中等样本：默认超过一页，fit-a4 收紧后装下", async () => {
    const doc = load("medium");
    const h = await engine.contentHeightMm(doc, template, template.defaultTokens);
    assert.ok(h > A4_HEIGHT_MM, `中等样本默认高度 ${h.toFixed(1)}mm，应略超 297mm；需调整 fixtures/medium`);
    const r = await engine.fitA4(doc, template);
    assert.equal(r.status, "fitted-tightened", `实际 ${r.status}，默认高度 ${h.toFixed(1)}mm`);
    assert.equal(r.metrics.pageCount, 1);
    writeFileSync(new URL("medium-fit-a4.pdf", outDir), await engine.pdf(doc, template, r.tokens, r.pageHeight));
  });

  test("长样本：默认 token、不收紧时高度 > 297mm", async () => {
    const h = await engine.contentHeightMm(load("long"), template, template.defaultTokens);
    assert.ok(h > A4_HEIGHT_MM, `${h}`);
  });

  test("长样本 + fit-a4：要么一页成功，要么 overflow 且建议非空", async () => {
    const doc = load("long");
    const r = await engine.fitA4(doc, template);
    if (r.status === "overflow") {
      assert.ok(r.suggestions && r.suggestions.length >= 2);
      assert.ok(r.metrics.pageCount > 1, "溢出时不得声称 1 页");
      assert.ok(r.metrics.overflowMm > 0);
    } else {
      assert.equal(r.status, "fitted-tightened");
      assert.equal(r.metrics.pageCount, 1);
    }
    assert.ok(r.tokens.bodyPt >= READABILITY_FLOOR.bodyPt && r.tokens.lineHeight >= READABILITY_FLOOR.lineHeight);
  });

  test("长样本 + continuous：1 页，默认字号，高度 ∈ (297, 1188]", async () => {
    const doc = load("long");
    const r = await engine.continuous(doc, template);
    assert.equal(r.status, "continuous");
    assert.equal(r.metrics.pageCount, 1);
    assert.deepEqual(r.tokens, template.defaultTokens);
    assert.ok(r.metrics.pageHeightMm > A4_HEIGHT_MM && r.metrics.pageHeightMm <= A4_HEIGHT_MM * 4);
    const svg = await engine.svg(doc, template, r.tokens, r.pageHeight);
    const pdf = await engine.pdf(doc, template, r.tokens, r.pageHeight);
    writeFileSync(new URL("long-continuous.pdf", outDir), pdf);
    // 预览与导出同源：SVG 高度与内容高度一致；PDF 页面尺寸能读到时也必须一致（误差 < 1mm）
    const svgMm = parseSvgSize(svg).heightPt / PT_PER_MM;
    assert.ok(Math.abs(svgMm - r.metrics.pageHeightMm) < 1, `${svgMm} vs ${r.metrics.pageHeightMm}`);
    const boxes = pdfMediaBoxes(pdf);
    if (boxes.length > 0) {
      assert.equal(boxes.length, 1, "长一页 PDF 必须只有 1 页");
      const hMm = (boxes[0][3] - boxes[0][1]) / PT_PER_MM;
      assert.ok(Math.abs(hMm - svgMm) < 1, `PDF ${hMm}mm vs SVG ${svgMm}mm`);
    } else {
      console.log("  (PDF 对象被压缩，未读取 MediaBox；页数由 SVG 高度保证)");
    }
  });

  test("长样本 + standard：诚实分页", async () => {
    const doc = load("long");
    const r = await engine.standard(doc, template);
    assert.ok(r.metrics.pageCount >= 2);
    writeFileSync(new URL("long-standard.pdf", outDir), await engine.pdf(doc, template, r.tokens, r.pageHeight));
  });

  test("示例数据不缺字", () => {
    for (const name of ["short", "medium", "long"]) assert.deepEqual(findMissingChars(load(name), loadCharset()), []);
  });

  for (const id of ["social-sans", "split-compact"] as const) {
    test(`${id}：短样本一页、长样本 continuous 一页、带照片和主题色可编译`, async () => {
      const t = templates.get(id)!;
      const short = await engine.fitA4(load("short"), t);
      assert.ok(short.status === "fitted-default" || short.status === "fitted-tightened", short.status);
      assert.equal(short.metrics.pageCount, 1);
      const long = await engine.continuous(load("long"), t);
      assert.equal(long.status, "continuous");
      assert.equal(long.metrics.pageCount, 1);
      const std = await engine.standard(load("long"), t);
      assert.ok(std.metrics.pageCount >= 1);
      const doc = load("short");
      doc.layout.theme = "wine";
      if (doc.modules[0].type === "basic_info") doc.modules[0].data.photoDataUrl = PHOTO;
      const pdf = await engine.pdf(doc, t, t.defaultTokens, A4_HEIGHT_MM);
      writeFileSync(new URL(`${id}-short-photo.pdf`, outDir), pdf);
      assert.equal(new TextDecoder("latin1").decode(pdf.slice(0, 5)), "%PDF-");
    });
  }

  test("campus-serif：带照片、四种主题色都能编译", async () => {
    for (const theme of ["ink", "teal", "wine", "graphite"] as const) {
      const doc = load("short");
      doc.layout.theme = theme;
      if (doc.modules[0].type === "basic_info") doc.modules[0].data.photoDataUrl = PHOTO;
      const svg = await engine.svg(doc, template, template.defaultTokens, A4_HEIGHT_MM);
      assert.ok(svg.includes("typst-doc"), theme);
    }
  });

  test("用户文本里的 Typst 特殊字符原样显示，不报错", async () => {
    const doc = load("short");
    if (doc.modules[0].type === "basic_info") doc.modules[0].data.name = '林#知*夏_$x$ @ref <lbl> \\ "引号"';
    for (const t of templates.values()) {
      const svg = await engine.svg(doc, t, t.defaultTokens, A4_HEIGHT_MM);
      assert.ok(svg.includes("typst-doc"), t.id);
    }
  });

  test("没有基本信息模块、只有正文模块时也能排版", async () => {
    const doc = load("short");
    doc.modules = doc.modules.filter((m) => m.type !== "basic_info" && m.type !== "job_intention");
    for (const t of templates.values()) {
      const svg = await engine.svg(doc, t, t.defaultTokens, A4_HEIGHT_MM);
      assert.ok(svg.includes("typst-doc"), t.id);
    }
  });
});

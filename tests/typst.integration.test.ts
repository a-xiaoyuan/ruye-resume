// 黄金测试（说明书 §10 表格）：用真实 Typst 排版验证。
// 需要先 pnpm install && pnpm fonts；缺任何一样时整组跳过并说明原因（CI 会在准备好后再跑一遍）。

import { before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { THEME_IDS, type RuyeDocument } from "../packages/schema/src/index.ts";
import { A4_HEIGHT_MM, countPdfPages, findMissingChars, LayoutEngine, parseSvgPages, parseSvgSize, pdfPageHeightsMm, PT_PER_MM, READABILITY_FLOOR } from "../packages/engine/src/index.ts";
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
    assert.ok(r.status === "fitted-default" || r.status === "fitted-relaxed" || r.status === "fitted-tightened", r.status);
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
    for (const name of ["full", "short", "medium", "long"]) assert.deepEqual(findMissingChars(load(name), loadCharset()), []);
  });

  for (const id of ["classic", "minimal", "elegant", "timeline", "social-sans", "split-compact"] as const) {
    test(`${id}：短样本一页、长样本 continuous 一页、带照片和主题色可编译`, async () => {
      const t = templates.get(id)!;
      const short = await engine.fitA4(load("short"), t);
      assert.ok(short.status === "fitted-default" || short.status === "fitted-relaxed" || short.status === "fitted-tightened", short.status);
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

  test("完整示例在所有模板下都能装进一页 A4，且至多收紧到行距这一步", async () => {
    for (const t of templates.values()) {
      const r = await engine.fitA4(load("full"), t);
      assert.ok(r.status === "fitted-default" || r.status === "fitted-relaxed" || r.status === "fitted-tightened", `${t.id}: ${r.status}`);
      assert.equal(r.metrics.pageCount, 1, t.id);
      if (t.id === "classic") assert.ok(!r.appliedSteps.includes("font-size"), `classic 不应缩字号：${r.appliedSteps.join(",")}`);
    }
  });

  test("极简模板固定黑白色板：换主题色不改变输出", async () => {
    const t = templates.get("minimal")!;
    const a = load("full");
    const b = load("full");
    a.layout.theme = "ink";
    b.layout.theme = "wine";
    assert.equal(await engine.svg(a, t, t.defaultTokens, A4_HEIGHT_MM), await engine.svg(b, t, t.defaultTokens, A4_HEIGHT_MM));
  });

  test("要点小标题、句首短标题与自我评价都能排版；只有小标题的要点也不报错", async () => {
    const doc = load("full");
    const p = doc.modules.find((m) => m.type === "project")!;
    if (p.type === "project") p.data.items[0].bullets = ["个人职责：", "技术亮点：", "缓存：", "：只有冒号", "#*$ 带特殊字符的短标题：说明"];
    const s = doc.modules.find((m) => m.type === "summary")!;
    if (s.type === "summary") s.data.text = "第一段\n\n第二段 #*$<x>";
    for (const t of templates.values()) {
      const svg = await engine.svg(doc, t, t.defaultTokens, A4_HEIGHT_MM);
      assert.ok(svg.includes("typst-doc"), t.id);
    }
  });

  test("所有模板 × 六种主题色 × 带照片都能编译", async () => {
    for (const t of templates.values()) for (const theme of THEME_IDS) {
      const doc = load("short");
      doc.layout.theme = theme;
      if (doc.modules[0].type === "basic_info") doc.modules[0].data.photoDataUrl = PHOTO;
      const svg = await engine.svg(doc, t, t.defaultTokens, A4_HEIGHT_MM);
      assert.ok(svg.includes("typst-doc"), `${t.id}/${theme}`);
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

  test("真实页码：所有模板 × 三份样本 × 三种模式，PDF 自身的页数与高度都和排版结果一致", async () => {
    for (const t of templates.values()) {
      for (const name of ["short", "medium", "long"]) {
        for (const mode of ["standard", "fit-a4", "continuous"] as const) {
          const doc = load(name);
          const r = await engine.layout(doc, t, mode);
          const where = `${t.id}/${name}/${mode}`;
          if (r.status === "overflow" || r.status === "too-long") {
            await assert.rejects(engine.exportPdf(doc, t, r), /失败状态/, where);
            continue;
          }
          const { pdf, pageCount } = await engine.exportPdf(doc, t, r);
          assert.equal(pageCount, r.metrics.pageCount, where);
          assert.equal(countPdfPages(pdf), r.metrics.pageCount, where);
          const heights = pdfPageHeightsMm(pdf);
          assert.equal(heights.length, r.metrics.pageCount, where);
          for (const h of heights) assert.ok(Math.abs(h - r.metrics.pageHeightMm) < 1, `${where}: PDF 页高 ${h.toFixed(1)}mm，排版结果 ${r.metrics.pageHeightMm}mm`);
          if (mode !== "standard") assert.equal(pageCount, 1, where);
        }
      }
    }
  });

  test("页码只在多页时印出，且与实际页数一致", async () => {
    for (const t of templates.values()) {
      const long = await engine.standard(load("long"), t);
      const short = await engine.standard(load("short"), t);
      const svgLong = await engine.svg(load("long"), t, long.tokens, A4_HEIGHT_MM);
      const svgShort = await engine.svg(load("short"), t, short.tokens, A4_HEIGHT_MM);
      const n = long.metrics.pageCount;
      assert.equal(parseSvgPages(svgLong)?.length, n, t.id);
      if (n > 1) {
        for (let i = 1; i <= n; i++) assert.ok(svgLong.includes(`>${i} / ${n}<`), `${t.id} 缺少页码 ${i} / ${n}`);
      }
      assert.equal(short.metrics.pageCount, 1, t.id);
      assert.ok(!/>\d+ \/ \d+</.test(svgShort), `${t.id} 单页不应印页码`);
    }
  });

  test("javascript: 链接不会出现在预览 SVG 里；没写协议的网址补 https://", async () => {
    const doc = load("short");
    if (doc.modules[0].type === "basic_info") {
      doc.modules[0].data.github = "javascript:alert(document.cookie)";
      doc.modules[0].data.website = "example.com/me";
    }
    for (const t of templates.values()) {
      const svg = await engine.svg(doc, t, t.defaultTokens, A4_HEIGHT_MM);
      // 文字本身照常显示；不允许的是带 javascript: 的可点击链接
      assert.ok(!/href\s*=\s*["']\s*javascript:/i.test(svg), t.id);
      assert.ok(svg.includes('href="https://example.com/me"'), t.id);
    }
  });

  test("专业技能只有描述句、或分类与描述句混用时，所有模板都能排版", async () => {
    for (const notesOnly of [true, false]) {
      const doc = load("short");
      const s = doc.modules.find((m) => m.type === "skills")!;
      if (s.type === "skills") {
        s.data = {
          categories: notesOnly ? [] : s.data.categories,
          notes: ["熟悉 Java 并发编程，理解 AQS", "JVM：了解 GC 调优", "能够独立完成接口设计与压测", "带 # * $ <x> 的描述句"],
        };
      }
      for (const t of templates.values()) {
        for (const mode of ["fit-a4", "standard", "continuous"] as const) {
          const r = await engine.layout(doc, t, mode);
          assert.ok(r.status !== "too-long", `${t.id}/${mode}`);
          const svg = await engine.svg(doc, t, r.tokens, r.pageHeight);
          assert.ok(svg.includes(">JVM<") || svg.includes("JVM"), `${t.id}/${mode} 描述句没有排出来`);
        }
      }
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

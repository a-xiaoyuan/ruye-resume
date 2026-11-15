// 测试用的假排版后端：按一个简化的行数模型算高度，并输出和 typst.ts 同格式的 SVG 根元素。
// 只用于验证引擎算法（收紧顺序、提前停止、溢出报告、页数推算），不代表真实排版。
// 真实排版由 tests/typst.integration.test.ts 在装好 typst.ts 与字体后验证。

import type { RenderBackend, TypstInput } from "../../packages/engine/src/index.ts";

const PT_PER_MM = 72 / 25.4;
const dec = new TextDecoder();

function readJson(input: TypstInput, path: string): any {
  const f = input.files[path];
  return JSON.parse(typeof f === "string" ? f : dec.decode(f));
}

export function fakeHeightPt(input: TypstInput): number {
  const { modules } = readJson(input, "/data.json");
  const t = readJson(input, "/tokens.json");
  const line = t.bodyPt * t.lineHeight;
  const lead = (t.lineHeight - 1) * t.bodyPt;
  const mm = (x: number) => x * PT_PER_MM;
  const gap = (extra: number) => lead + mm(extra);

  let h = mm(t.pageMarginMm.top + t.pageMarginMm.bottom);
  modules.forEach((m: any, i: number) => {
    if (i > 0) h += gap(t.sectionGapMm);
    if (m.type === "basic_info") {
      h += t.namePt + lead + mm(1.5) + t.metaPt;
      return;
    }
    if (m.type === "job_intention") {
      h += line;
      return;
    }
    h += t.headingPt * 1.2 + mm(t.compact ? 2.2 : 3.2);
    if (m.type === "skills") {
      const rows = m.data.categories.length;
      const n = t.compact ? Math.ceil(rows / 2) : rows;
      h += n * t.bodyPt + (n - 1) * gap(t.paragraphGapMm);
      return;
    }
    m.data.items.forEach((it: any, j: number) => {
      if (j > 0) h += gap(t.itemGapMm);
      let units = 1; // 标题行
      const meta = (it.summary ? 1 : 0) + (it.techStack?.length ? 1 : 0);
      units += t.compact ? Math.min(meta, 1) : meta;
      const bl = (it.bullets ?? it.highlights ?? []).length;
      units += m.type === "education" && t.compact ? Math.min(bl, 1) : bl;
      h += units * t.bodyPt + (units - 1) * gap(t.paragraphGapMm);
    });
  });
  return h;
}

export class FakeBackend implements RenderBackend {
  calls = 0;
  async svg(input: TypstInput): Promise<string> {
    this.calls++;
    const page = readJson(input, "/page.json");
    const content = fakeHeightPt(input);
    let height: number;
    if (page.height === "auto") height = content;
    else {
      const pageH = page.height * PT_PER_MM;
      height = Math.max(1, Math.ceil(content / pageH - 1e-9)) * pageH;
    }
    const w = (210 * PT_PER_MM).toFixed(3);
    const hh = height.toFixed(3);
    return `<svg style="overflow: visible;" class="typst-doc" viewBox="0 0 ${w} ${hh}" width="${w}" height="${hh}" data-width="${w}" data-height="${hh}" xmlns="http://www.w3.org/2000/svg"></svg>`;
  }
  async pdf(input: TypstInput): Promise<Uint8Array> {
    return new TextEncoder().encode(`%PDF-fake ${await this.svg(input)}`);
  }
}

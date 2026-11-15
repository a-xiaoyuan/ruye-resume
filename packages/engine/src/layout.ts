// 排版引擎：measure / fit-a4 / continuous / standard / 溢出报告。
// 所有高度都来自真实排版结果（后端编译出的 SVG 页面尺寸），不按字数估算。

import { MODULE_LABELS, renderableModules, type Module, type PageMode, type RuyeDocument } from "../../schema/src/index.ts";
import { applyStep, FIT_STEPS, isDiscreteStep, STEP_LABELS, STEP_LEVELS } from "./tokens.ts";
import {
  A4_HEIGHT_MM,
  CONTINUOUS_MAX_MM,
  EPSILON_MM,
  PT_PER_MM,
  type FitResult,
  type FitStep,
  type LayoutMetrics,
  type PageHeight,
  type RenderBackend,
  type TemplateDef,
  type TypographyTokens,
} from "./types.ts";

/** 从 typst.ts 输出的 SVG 根元素读取总尺寸（单位 pt）。根元素形如 <svg class="typst-doc" ... data-width="595.276" data-height="841.89"> */
export function parseSvgSize(svg: string): { widthPt: number; heightPt: number } {
  const head = svg.slice(0, 4096);
  const root = head.match(/<svg\b[^>]*>/);
  if (!root) throw new Error("SVG 输出里找不到根元素");
  const attr = (name: string) => {
    const m = root[0].match(new RegExp(`\\s${name}="([0-9.]+)"`));
    return m ? Number(m[1]) : NaN;
  };
  let widthPt = attr("data-width");
  let heightPt = attr("data-height");
  if (!Number.isFinite(widthPt) || !Number.isFinite(heightPt)) {
    const vb = root[0].match(/viewBox="[-0-9.]+\s+[-0-9.]+\s+([0-9.]+)\s+([0-9.]+)"/);
    if (!vb) throw new Error("SVG 根元素既没有 data-width/data-height，也没有 viewBox");
    widthPt = Number(vb[1]);
    heightPt = Number(vb[2]);
  }
  return { widthPt, heightPt };
}

const ptToMm = (pt: number) => pt / PT_PER_MM;
const round1 = (x: number) => Math.round(x * 10) / 10;

/** 只保留参与排版的模块（可见且非空），模板只需要处理这些 */
export function renderableDoc(doc: RuyeDocument): RuyeDocument {
  return { ...doc, modules: renderableModules(doc) };
}

export class LayoutEngine {
  private backend: RenderBackend;
  private cache = new Map<string, Promise<number>>();

  constructor(backend: RenderBackend) {
    this.backend = backend;
  }

  /** 编译一次并返回 SVG（预览用）。和 pdf() 使用完全相同的输入 */
  async svg(doc: RuyeDocument, template: TemplateDef, tokens: TypographyTokens, pageHeight: PageHeight): Promise<string> {
    return this.backend.svg(template.build(renderableDoc(doc), tokens, pageHeight));
  }

  async pdf(doc: RuyeDocument, template: TemplateDef, tokens: TypographyTokens, pageHeight: PageHeight): Promise<Uint8Array> {
    return this.backend.pdf(template.build(renderableDoc(doc), tokens, pageHeight));
  }

  /** 不分页时的内容总高度（含页边距），mm。用 height: auto 编译一次得到 */
  async contentHeightMm(doc: RuyeDocument, template: TemplateDef, tokens: TypographyTokens): Promise<number> {
    const rdoc = renderableDoc(doc);
    const key = JSON.stringify([template.id, tokens, rdoc.modules]);
    let p = this.cache.get(key);
    if (!p) {
      p = this.backend.svg(template.build(rdoc, tokens, "auto")).then((svg) => ptToMm(parseSvgSize(svg).heightPt));
      this.cache.set(key, p);
      if (this.cache.size > 200) this.cache.delete(this.cache.keys().next().value!);
    }
    return p;
  }

  /** 以固定页高编译，返回页数。typst.ts 的 SVG 把各页上下叠放，总高 / 页高 即页数 */
  async pageCount(doc: RuyeDocument, template: TemplateDef, tokens: TypographyTokens, pageHeightMm: number): Promise<number> {
    const svg = await this.backend.svg(template.build(renderableDoc(doc), tokens, pageHeightMm));
    const totalMm = ptToMm(parseSvgSize(svg).heightPt);
    const n = totalMm / pageHeightMm;
    const rounded = Math.round(n);
    if (Math.abs(n - rounded) > 0.01 || rounded < 1) {
      throw new Error(`无法从 SVG 高度推出页数：总高 ${totalMm.toFixed(2)}mm，页高 ${pageHeightMm}mm`);
    }
    return rounded;
  }

  private baseMetrics(contentHeightMm: number, pageHeightMm: number, pageCount: number, withOverflow: boolean): LayoutMetrics {
    const overflowMm = withOverflow ? Math.max(0, contentHeightMm - A4_HEIGHT_MM) : 0;
    return {
      pageWidthMm: 210,
      pageHeightMm,
      pageCount,
      contentHeightMm: round1(contentHeightMm),
      overflowMm: round1(overflowMm),
      overflowRatio: Math.round((overflowMm / A4_HEIGHT_MM) * 1000) / 1000,
      moduleHeights: [],
    };
  }

  async layout(doc: RuyeDocument, template: TemplateDef, mode: PageMode = doc.layout.pageMode): Promise<FitResult> {
    switch (mode) {
      case "fit-a4":
        return this.fitA4(doc, template);
      case "continuous":
        return this.continuous(doc, template);
      case "standard":
        return this.standard(doc, template);
    }
  }

  async standard(doc: RuyeDocument, template: TemplateDef): Promise<FitResult> {
    const tokens = template.defaultTokens;
    const [h, n] = await Promise.all([this.contentHeightMm(doc, template, tokens), this.pageCount(doc, template, tokens, A4_HEIGHT_MM)]);
    return { status: "paginated", appliedSteps: [], tokens, pageHeight: A4_HEIGHT_MM, metrics: this.baseMetrics(h, A4_HEIGHT_MM, n, false) };
  }

  async continuous(doc: RuyeDocument, template: TemplateDef): Promise<FitResult> {
    const tokens = template.defaultTokens; // 长一页不收紧
    const h = await this.contentHeightMm(doc, template, tokens);
    if (h > CONTINUOUS_MAX_MM + EPSILON_MM) {
      const metrics = this.baseMetrics(h, h, 1, false);
      return {
        status: "too-long",
        appliedSteps: [],
        tokens,
        pageHeight: "auto",
        metrics,
        suggestions: [`内容约 ${(h / A4_HEIGHT_MM).toFixed(2)} 页 A4，超过长一页上限（4 页）。请改用标准分页，或拆成多份简历。`],
      };
    }
    // 内容不足一页时，长一页仍按一整页 A4 输出；超过时页面高度 = 内容高度（height: auto，一次排版即精确）
    const pageHeight: PageHeight = h <= A4_HEIGHT_MM ? A4_HEIGHT_MM : "auto";
    const pageHeightMm = Math.max(h, A4_HEIGHT_MM);
    return { status: "continuous", appliedSteps: [], tokens, pageHeight, metrics: this.baseMetrics(h, round1(pageHeightMm), 1, false) };
  }

  /** 判断 tokens 下能否真的装进一页 A4：先看 auto 高度，再用固定 297mm 编译复核页数 */
  private async fitsA4(doc: RuyeDocument, template: TemplateDef, tokens: TypographyTokens): Promise<{ fits: boolean; heightMm: number }> {
    const heightMm = await this.contentHeightMm(doc, template, tokens);
    if (heightMm > A4_HEIGHT_MM + EPSILON_MM) return { fits: false, heightMm };
    const n = await this.pageCount(doc, template, tokens, A4_HEIGHT_MM);
    return { fits: n === 1, heightMm };
  }

  async fitA4(doc: RuyeDocument, template: TemplateDef): Promise<FitResult> {
    const def = template.defaultTokens;
    const floor = template.floorTokens;

    let tokens = def;
    let probe = await this.fitsA4(doc, template, tokens);
    if (probe.fits) {
      return { status: "fitted-default", appliedSteps: [], tokens, pageHeight: A4_HEIGHT_MM, metrics: this.baseMetrics(probe.heightMm, A4_HEIGHT_MM, 1, true) };
    }

    const applied: FitStep[] = [];
    for (const step of FIT_STEPS) {
      const levels = isDiscreteStep(step) ? [1] : STEP_LEVELS;
      let stepTokens = tokens;
      let changed = false;
      for (const t of levels) {
        const candidate = applyStep(tokens, def, floor, step, t);
        if (JSON.stringify(candidate) === JSON.stringify(stepTokens)) continue; // 该步骤没有可收紧的余量
        stepTokens = candidate;
        changed = true;
        probe = await this.fitsA4(doc, template, stepTokens);
        if (probe.fits) {
          applied.push(step);
          return {
            status: "fitted-tightened",
            appliedSteps: applied,
            tokens: stepTokens,
            pageHeight: A4_HEIGHT_MM,
            metrics: this.baseMetrics(probe.heightMm, A4_HEIGHT_MM, 1, true),
          };
        }
      }
      // 这一步推到底线仍装不下：保留在底线，继续下一步
      if (changed) applied.push(step);
      tokens = stepTokens;
    }

    // 到底线仍溢出：生成溢出报告。不删任何内容
    const metrics = this.baseMetrics(probe.heightMm, A4_HEIGHT_MM, await this.pageCount(doc, template, tokens, A4_HEIGHT_MM), true);
    await this.attachBreakdown(doc, template, tokens, metrics);
    return { status: "overflow", appliedSteps: applied, tokens, pageHeight: A4_HEIGHT_MM, metrics, suggestions: buildSuggestions(doc, metrics) };
  }

  /**
   * 模块 / 条目占高：把它从文档里拿掉重新排版，差值就是它占的真实高度（含间距）。
   * 只在溢出时做（最多十几次编译），平时不付这个成本。
   */
  async attachBreakdown(doc: RuyeDocument, template: TemplateDef, tokens: TypographyTokens, metrics: LayoutMetrics): Promise<void> {
    const rdoc = renderableDoc(doc);
    const full = await this.contentHeightMm(rdoc, template, tokens);
    const without = (modules: Module[]) => this.contentHeightMm({ ...rdoc, modules }, template, tokens);

    metrics.moduleHeights = [];
    for (const m of rdoc.modules) {
      if (m.type === "basic_info") continue; // 姓名行无法删除，不参与建议
      const h = await without(rdoc.modules.filter((x) => x.id !== m.id));
      metrics.moduleHeights.push({ moduleId: m.id, type: m.type, heightMm: round1(full - h) });
    }
    metrics.moduleHeights.sort((a, b) => b.heightMm - a.heightMm);

    const top = rdoc.modules.find((m) => m.id === metrics.moduleHeights[0]?.moduleId);
    if (top && "items" in top.data && top.data.items.length > 1) {
      metrics.itemHeights = [];
      for (const it of top.data.items) {
        const reduced = { ...top, data: { ...top.data, items: top.data.items.filter((x: { id: string }) => x.id !== it.id) } } as Module;
        const h = await without(rdoc.modules.map((x) => (x.id === top.id ? reduced : x)));
        metrics.itemHeights.push({ moduleId: top.id, itemId: it.id, heightMm: round1(full - h) });
      }
      metrics.itemHeights.sort((a, b) => b.heightMm - a.heightMm);
    }
  }
}

function itemName(doc: RuyeDocument, moduleId: string, itemId: string): string {
  const m = doc.modules.find((x) => x.id === moduleId);
  if (!m || !("items" in m.data)) return itemId;
  const it = (m.data.items as unknown as Record<string, string>[]).find((x) => x.id === itemId);
  return it?.name ?? it?.org ?? it?.school ?? it?.title ?? itemId;
}

/** 根据真实占高生成 2～4 条中文建议 */
export function buildSuggestions(doc: RuyeDocument, metrics: LayoutMetrics): string[] {
  const out: string[] = [];
  const total = metrics.contentHeightMm;
  const top = metrics.moduleHeights[0];
  if (top) {
    const pct = Math.round((top.heightMm / total) * 100);
    out.push(`「${MODULE_LABELS[top.type as keyof typeof MODULE_LABELS]}」占总高约 ${pct}%（约 ${Math.round(top.heightMm)}mm），优先精简这里：删掉较弱的条目，或把每条经历的要点压到 2～3 条。`);
  }
  const biggest = metrics.itemHeights?.[0];
  if (biggest) {
    out.push(`单个条目里最长的是「${itemName(doc, biggest.moduleId, biggest.itemId)}」，约 ${Math.round(biggest.heightMm)}mm。`);
  }
  if (metrics.overflowMm <= 15) {
    out.push(`只超出约 ${Math.round(metrics.overflowMm)}mm，删掉 1～2 条要点或合并两行短句，通常就能装下。`);
  }
  out.push("也可以改用无损长一页（适合屏幕投递），或标准分页（适合打印）。");
  return out.slice(0, 4);
}

/** 顶栏溢出指示的文案（说明书 §14） */
export function describeFit(result: FitResult): { level: "ok" | "warn" | "error"; text: string } {
  const m = result.metrics;
  switch (result.status) {
    case "fitted-default":
      return { level: "ok", text: "已装进一页 A4，未做任何收紧。" };
    case "fitted-tightened":
      return { level: "warn", text: `已自动收紧：${result.appliedSteps.map((s) => STEP_LABELS[s]).join(" / ")}。` };
    case "overflow": {
      const top = m.moduleHeights[0];
      const where = top ? `占高最多的是「${MODULE_LABELS[top.type as keyof typeof MODULE_LABELS]}」。` : "";
      return { level: "error", text: `超出约 ${Math.round(m.overflowMm)} mm（约 ${Math.round(m.overflowRatio * 100)}%）。${where}` };
    }
    case "paginated":
      return { level: "ok", text: `标准分页，共 ${m.pageCount} 页。` };
    case "continuous":
      return { level: "ok", text: `无损长一页，高度约 ${(m.pageHeightMm / A4_HEIGHT_MM).toFixed(2)} 页 A4。` };
    case "too-long":
      return { level: "error", text: `内容约 ${(m.contentHeightMm / A4_HEIGHT_MM).toFixed(2)} 页 A4，超过长一页上限（4 页）。` };
  }
}

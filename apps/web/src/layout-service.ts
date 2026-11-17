// 排版服务：给界面用的两个操作——预览、导出。不依赖浏览器 API，
// 在 Web Worker、主线程退路和 Node 测试里都是同一份代码。

import type { PageMode, RuyeDocument, TemplateId } from "../../../packages/schema/src/index.ts";
import { A4_HEIGHT_MM, type FitResult, type LayoutEngine, type PageHeight, type TemplateDef } from "../../../packages/engine/src/index.ts";

export interface PreviewData {
  svg: string;
  result: FitResult;
  /** 画板总高度（mm）：溢出时比 297 高，用来画出页外部分 */
  boardMm: number;
}

export type ExportOutcome =
  | { kind: "pdf"; pdf: Uint8Array; pageCount: number }
  | { kind: "overflow" }
  | { kind: "too-long"; message: string };

export class LayoutService {
  private engine: LayoutEngine;
  private templates: Map<TemplateId, TemplateDef>;

  constructor(engine: LayoutEngine, templates: Map<TemplateId, TemplateDef>) {
    this.engine = engine;
    this.templates = templates;
  }

  private template(doc: RuyeDocument): TemplateDef {
    return this.templates.get(doc.layout.templateId) ?? this.templates.get("classic")!;
  }

  async preview(doc: RuyeDocument, mode: PageMode = doc.layout.pageMode): Promise<PreviewData> {
    const template = this.template(doc);
    const result = await this.engine.layout(doc, template, mode);
    // 版面标尺要知道每个模块占多高：装进一页时引擎没量过，这里补量一次（每个模块一次编译，约 100 ms）
    if (result.status.startsWith("fitted") && result.metrics.moduleHeights.length === 0) {
      await this.engine.attachBreakdown(doc, template, result.tokens, result.metrics, false);
    }
    // 溢出时按内容实际高度渲染，让用户看见页外的部分，而不是假装没有
    const showAuto = result.status === "overflow";
    const height: PageHeight = showAuto ? "auto" : result.pageHeight;
    const svg = await this.engine.svg(doc, template, result.tokens, height);
    const boardMm =
      result.status === "paginated" ? result.metrics.pageCount * A4_HEIGHT_MM : showAuto ? result.metrics.contentHeightMm : result.metrics.pageHeightMm;
    return { svg, result, boardMm };
  }

  /** 按指定模式排版并导出；exportPdf 会核对 PDF 自身的页数 */
  async exportPdf(doc: RuyeDocument, mode: PageMode): Promise<ExportOutcome> {
    const template = this.template(doc);
    const r = await this.engine.layout(doc, template, mode);
    if (r.status === "overflow") return { kind: "overflow" };
    if (r.status === "too-long") return { kind: "too-long", message: r.suggestions?.[0] ?? "内容过长" };
    const { pdf, pageCount } = await this.engine.exportPdf(doc, template, r);
    return { kind: "pdf", pdf, pageCount };
  }
}

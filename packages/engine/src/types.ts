import type { RuyeDocument, TemplateId } from "../../schema/src/index.ts";

export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
export const PT_PER_MM = 72 / 25.4;
/** 长一页最大高度：4 页 A4。超出则失败，避免生成异常超长的 PDF */
export const CONTINUOUS_MAX_MM = A4_HEIGHT_MM * 4;
/** 测量结果的容差（mm），抵消浮点误差 */
export const EPSILON_MM = 0.05;

/** 可读性底线（任何模板的 floor 都不能低于这些值） */
export const READABILITY_FLOOR = {
  pageMarginMm: 12,
  bodyPt: 10.5,
  namePt: 16,
  headingPt: 11.5,
  lineHeight: 1.35,
} as const;

export interface TypographyTokens {
  pageMarginMm: { top: number; right: number; bottom: number; left: number };
  fontFamily: { sans: string; serif: string; mono: string };
  namePt: number;
  headingPt: number;
  bodyPt: number;
  metaPt: number;
  lineHeight: number;
  sectionGapMm: number;
  itemGapMm: number;
  paragraphGapMm: number;
  compact: boolean;
}

/** 页面高度：固定毫米数，或 "auto"（页面高度 = 内容高度，Typst 的 height: auto） */
export type PageHeight = number | "auto";

/** 交给 Typst 编译的一组虚拟文件。main 是入口文件路径 */
export interface TypstInput {
  main: string;
  files: Record<string, string | Uint8Array>;
}

export interface TemplateDef {
  id: TemplateId;
  name: string;
  defaultTokens: TypographyTokens;
  floorTokens: TypographyTokens;
  /** 把文档、token、页面高度组装成 Typst 输入。数据只通过 JSON 文件注入，不拼接 Typst 源码 */
  build(doc: RuyeDocument, tokens: TypographyTokens, pageHeight: PageHeight): TypstInput;
}

/** 排版后端：唯一的排版器。预览（SVG）和导出（PDF）都走它，保证同源 */
export interface RenderBackend {
  svg(input: TypstInput): Promise<string>;
  pdf(input: TypstInput): Promise<Uint8Array>;
}

export interface LayoutMetrics {
  pageWidthMm: 210;
  /** 导出时每页的高度：standard / fit-a4 为 297，continuous 为内容高度 */
  pageHeightMm: number;
  pageCount: number;
  /** 不分页时的总高度（含页边距） */
  contentHeightMm: number;
  /** max(0, contentHeight - 297)，只对 fit-a4 有意义；standard 恒为 0 */
  overflowMm: number;
  overflowRatio: number;
  moduleHeights: { moduleId: string; type: string; heightMm: number }[];
  itemHeights?: { moduleId: string; itemId: string; heightMm: number }[];
}

export type FitStatus =
  | "fitted-default"
  | "fitted-tightened"
  | "overflow"
  | "continuous"
  | "paginated"
  /** 长一页超过 4 页 A4 的上限 */
  | "too-long";

export type FitStep = "section-gap" | "item-gap" | "paragraph-gap" | "compact-variants" | "line-height" | "font-size";

export interface FitResult {
  status: FitStatus;
  appliedSteps: FitStep[];
  tokens: TypographyTokens;
  /** 导出时使用的页面高度。预览与导出都用它，保证同源 */
  pageHeight: PageHeight;
  metrics: LayoutMetrics;
  suggestions?: string[];
}

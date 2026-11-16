import { READABILITY_FLOOR, type FitStep, type TypographyTokens } from "./types.ts";

/**
 * 收紧顺序（v1.1）：间距 → 紧凑变体 → 行距 → 字号。
 * 说明书原文把紧凑变体放在最后，但第 4 节原则写的是「宁可变紧凑模块，也不破坏阅读」，
 * 所以先改版式、最后才缩字。见 docs/DESIGN.md「与原说明书的差异」。
 */
export const FIT_STEPS: readonly FitStep[] = ["section-gap", "item-gap", "paragraph-gap", "compact-variants", "line-height", "font-size"];

/** 每个连续步骤在「默认 → 底线」之间试探的档位（取第一档能装下的） */
export const STEP_LEVELS: readonly number[] = [0.25, 0.5, 0.75, 1];

export const STEP_LABELS: Record<FitStep, string> = {
  "section-gap": "模块间距",
  "item-gap": "条目间距",
  "paragraph-gap": "要点间距",
  "compact-variants": "紧凑变体",
  "line-height": "行距",
  "font-size": "字号",
};

const lerp = (a: number, b: number, t: number) => Math.round((a + (b - a) * t) * 1000) / 1000;

/** 在 tokens 上把某个步骤推进到 t（0 = 默认值，1 = 底线），只改该步骤负责的字段 */
export function applyStep(tokens: TypographyTokens, def: TypographyTokens, floor: TypographyTokens, step: FitStep, t: number): TypographyTokens {
  const next: TypographyTokens = { ...tokens, pageMarginMm: { ...tokens.pageMarginMm }, fontFamily: { ...tokens.fontFamily } };
  switch (step) {
    case "section-gap":
      next.sectionGapMm = lerp(def.sectionGapMm, floor.sectionGapMm, t);
      break;
    case "item-gap":
      next.itemGapMm = lerp(def.itemGapMm, floor.itemGapMm, t);
      break;
    case "paragraph-gap":
      next.paragraphGapMm = lerp(def.paragraphGapMm, floor.paragraphGapMm, t);
      break;
    case "compact-variants":
      next.compact = t > 0 ? true : def.compact;
      break;
    case "line-height":
      next.lineHeight = lerp(def.lineHeight, floor.lineHeight, t);
      break;
    case "font-size":
      next.bodyPt = lerp(def.bodyPt, floor.bodyPt, t);
      next.metaPt = lerp(def.metaPt, floor.metaPt, t);
      next.headingPt = lerp(def.headingPt, floor.headingPt, t);
      next.namePt = lerp(def.namePt, floor.namePt, t);
      break;
  }
  return next;
}

export function isDiscreteStep(step: FitStep): boolean {
  return step === "compact-variants";
}

/** 校验模板的 floor 不低于可读性底线，且 default 不低于 floor。返回问题列表 */
export function checkTokenFloors(def: TypographyTokens, floor: TypographyTokens): string[] {
  const issues: string[] = [];
  const f = READABILITY_FLOOR;
  for (const side of ["top", "right", "bottom", "left"] as const) {
    if (floor.pageMarginMm[side] < f.pageMarginMm) issues.push(`页边距 ${side} 低于 ${f.pageMarginMm}mm`);
    if (def.pageMarginMm[side] !== floor.pageMarginMm[side]) issues.push(`页边距 ${side} 不参与收紧，default 与 floor 应相等`);
  }
  if (floor.bodyPt < f.bodyPt) issues.push(`正文字号低于 ${f.bodyPt}pt`);
  if (floor.namePt < f.namePt) issues.push(`姓名字号低于 ${f.namePt}pt`);
  if (floor.headingPt < f.headingPt) issues.push(`模块标题字号低于 ${f.headingPt}pt`);
  if (floor.lineHeight < f.lineHeight) issues.push(`行距低于 ${f.lineHeight}`);
  const pairs: [keyof TypographyTokens, string][] = [
    ["bodyPt", "正文字号"],
    ["metaPt", "次级字号"],
    ["headingPt", "标题字号"],
    ["namePt", "姓名字号"],
    ["lineHeight", "行距"],
    ["sectionGapMm", "模块间距"],
    ["itemGapMm", "条目间距"],
    ["paragraphGapMm", "要点间距"],
  ];
  for (const [k, label] of pairs) {
    if ((def[k] as number) < (floor[k] as number)) issues.push(`${label}：default 小于 floor`);
  }
  // 说明书 6.3：正文及次级文字（日期、电话等）都不低于 10.5pt
  if (floor.metaPt < f.bodyPt) issues.push(`次级文字低于 ${f.bodyPt}pt`);
  return issues;
}

// ---------------------------------------------------------------- 放宽（内容不满一页时）

/** 放宽的上限：间距最多放大到默认的 1.6 倍，行距最多 +0.12（且不超过 1.75）。字号、页边距不动 */
export const RELAX_LIMIT = { gapScale: 1.6, lineHeightDelta: 0.12, lineHeightMax: 1.75 } as const;

/** 在默认值与放宽上限之间插值：t = 0 为默认，t = 1 为上限 */
export function relaxTokens(def: TypographyTokens, t: number): TypographyTokens {
  const k = 1 + (RELAX_LIMIT.gapScale - 1) * t;
  const r3 = (x: number) => Math.round(x * 1000) / 1000;
  return {
    ...def,
    pageMarginMm: { ...def.pageMarginMm },
    fontFamily: { ...def.fontFamily },
    sectionGapMm: r3(def.sectionGapMm * k),
    itemGapMm: r3(def.itemGapMm * k),
    paragraphGapMm: r3(def.paragraphGapMm * k),
    lineHeight: r3(Math.min(RELAX_LIMIT.lineHeightMax, def.lineHeight + RELAX_LIMIT.lineHeightDelta * t)),
  };
}

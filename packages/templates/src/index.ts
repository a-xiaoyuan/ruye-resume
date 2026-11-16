// 模板注册表。模板 = 一份 Typst 源码（共用 common.typ）+ default/floor 两套 token + 推荐模块顺序。
// 源码由调用方注入（浏览器用 Vite 的 ?raw，Node 用 fs，见 node.ts），本包不依赖运行环境。

import type { ModuleType, RuyeDocument, TemplateId } from "../../schema/src/index.ts";
import type { PageHeight, TemplateDef, TypographyTokens, TypstInput } from "../../engine/src/index.ts";

const FONTS = { sans: "Noto Sans SC", serif: "Noto Serif SC", mono: "Noto Sans Mono" };

type Tokens = { default: TypographyTokens; floor: TypographyTokens };

function tokens(margin: TypographyTokens["pageMarginMm"], def: Omit<TypographyTokens, "pageMarginMm" | "fontFamily" | "compact">, floor: Omit<TypographyTokens, "pageMarginMm" | "fontFamily" | "compact">): Tokens {
  return {
    default: { pageMarginMm: margin, fontFamily: FONTS, ...def, compact: false },
    floor: { pageMarginMm: margin, fontFamily: FONTS, ...floor, compact: true },
  };
}

export const CAMPUS_SERIF_TOKENS = tokens(
  { top: 14, right: 15, bottom: 14, left: 15 },
  { namePt: 22, headingPt: 13.5, bodyPt: 11.25, metaPt: 10.75, lineHeight: 1.55, sectionGapMm: 5, itemGapMm: 3, paragraphGapMm: 0.8 },
  { namePt: 18, headingPt: 12, bodyPt: 10.5, metaPt: 10.5, lineHeight: 1.35, sectionGapMm: 2.5, itemGapMm: 1.2, paragraphGapMm: 0.2 },
);

export const SOCIAL_SANS_TOKENS = tokens(
  { top: 13, right: 14, bottom: 13, left: 14 },
  { namePt: 24, headingPt: 12.5, bodyPt: 11, metaPt: 10.5, lineHeight: 1.5, sectionGapMm: 4.5, itemGapMm: 2.6, paragraphGapMm: 0.6 },
  { namePt: 18, headingPt: 11.5, bodyPt: 10.5, metaPt: 10.5, lineHeight: 1.35, sectionGapMm: 2.2, itemGapMm: 1, paragraphGapMm: 0.15 },
);

export const SPLIT_COMPACT_TOKENS = tokens(
  { top: 12, right: 12, bottom: 12, left: 12 },
  { namePt: 21, headingPt: 12, bodyPt: 10.75, metaPt: 10.5, lineHeight: 1.45, sectionGapMm: 4, itemGapMm: 2.4, paragraphGapMm: 0.5 },
  { namePt: 17, headingPt: 11.5, bodyPt: 10.5, metaPt: 10.5, lineHeight: 1.35, sectionGapMm: 2, itemGapMm: 1, paragraphGapMm: 0.1 },
);

const encoder = new TextEncoder();

// 文件头魔数：只接受内容确实是 PNG / JPEG / GIF / WebP 的图片
const MAGIC: Record<string, (b: Uint8Array) => boolean> = {
  png: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  jpg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  gif: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46,
  webp: (b) => b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
};

/**
 * data:image/png;base64,... → { ext, bytes }。
 * base64 损坏、或内容与声明的格式不符时返回 null：照片会被跳过，而不是让整份简历编译失败。
 * （SVG 照片不接受：Typst 会解析其中的外部引用，没必要冒这个险。）
 */
export function decodeDataUrl(url: string): { ext: string; bytes: Uint8Array } | null {
  const m = url.match(/^data:image\/(png|jpe?g|gif|webp);base64,([A-Za-z0-9+/=\s]*)$/);
  if (!m) return null;
  const ext = m[1] === "jpeg" ? "jpg" : m[1];
  let bin: string;
  try {
    bin = atob(m[2].replace(/\s+/g, ""));
  } catch {
    return null;
  }
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.length >= 12 && MAGIC[ext](bytes) ? { ext, bytes } : null;
}

/** 把文档、token、页高组装成 Typst 虚拟文件。所有数据都走 JSON，不拼接 Typst 源码 */
export function buildTypstInput(source: string, common: string, doc: RuyeDocument, tokens: TypographyTokens, pageHeight: PageHeight): TypstInput {
  const files: Record<string, string | Uint8Array> = {};
  const page: { height: PageHeight; photo?: string } = { height: pageHeight };

  // 照片单独作为二进制文件，data.json 里去掉巨大的 base64 字符串
  const modules = doc.modules.map((m) => {
    if (m.type !== "basic_info" || !m.data.photoDataUrl) return m;
    const decoded = decodeDataUrl(m.data.photoDataUrl);
    const { photoDataUrl: _drop, ...rest } = m.data;
    if (decoded) {
      page.photo = `photo.${decoded.ext}`;
      files[`/photo.${decoded.ext}`] = decoded.bytes;
    }
    return { ...m, data: rest };
  });

  files["/main.typ"] = source;
  files["/common.typ"] = common;
  files["/data.json"] = encoder.encode(JSON.stringify({ modules, theme: doc.layout.theme ?? "ink" }));
  files["/tokens.json"] = encoder.encode(JSON.stringify(tokens));
  files["/page.json"] = encoder.encode(JSON.stringify(page));
  return { main: "/main.typ", files };
}

export interface TemplateMeta {
  id: TemplateId;
  name: string;
  description: string;
  tokens: Tokens;
  /** 推荐的模块顺序（编辑器里「按模板推荐顺序排列」用） */
  recommendedOrder: ModuleType[];
}

export const TEMPLATE_META: TemplateMeta[] = [
  {
    id: "campus-serif",
    name: "校招单栏",
    description: "衬线标题、教育前置、留白充足。适合应届生与实习。",
    tokens: CAMPUS_SERIF_TOKENS,
    recommendedOrder: ["basic_info", "job_intention", "education", "skills", "internship", "work", "project", "research", "paper", "award"],
  },
  {
    id: "social-sans",
    name: "社招单栏",
    description: "全无衬线、信息更密，技能与履历优先。适合 1～8 年经验。",
    tokens: SOCIAL_SANS_TOKENS,
    recommendedOrder: ["basic_info", "job_intention", "skills", "work", "internship", "project", "education", "research", "paper", "award"],
  },
  {
    id: "split-compact",
    name: "双栏紧凑",
    description: "左侧栏放联系方式、技能、教育、获奖，右侧放经历。内容多时提高一页容量。",
    tokens: SPLIT_COMPACT_TOKENS,
    recommendedOrder: ["basic_info", "job_intention", "skills", "education", "award", "work", "internship", "project", "research", "paper"],
  },
];

export function templateMeta(id: TemplateId): TemplateMeta {
  return TEMPLATE_META.find((m) => m.id === id) ?? TEMPLATE_META[0];
}

/** 按模板推荐顺序重排模块（推荐列表里没有的类型保持原相对顺序，排在最后） */
export function sortByRecommended(doc: RuyeDocument, id: TemplateId): RuyeDocument {
  const order = templateMeta(id).recommendedOrder;
  const rank = (t: ModuleType) => {
    const i = order.indexOf(t);
    return i === -1 ? order.length : i;
  };
  const modules = doc.modules.map((m, i) => ({ m, i })).sort((a, b) => rank(a.m.type) - rank(b.m.type) || a.i - b.i).map((x) => x.m);
  return { ...doc, modules };
}

export type TemplateSources = { common: string } & Partial<Record<TemplateId, string>>;

export function createTemplates(sources: TemplateSources): Map<TemplateId, TemplateDef> {
  const out = new Map<TemplateId, TemplateDef>();
  for (const meta of TEMPLATE_META) {
    const source = sources[meta.id];
    if (!source) continue;
    out.set(meta.id, {
      id: meta.id,
      name: meta.name,
      defaultTokens: meta.tokens.default,
      floorTokens: meta.tokens.floor,
      build: (doc, tokens, pageHeight) => buildTypstInput(source, sources.common, doc, tokens, pageHeight),
    });
  }
  return out;
}

// 模板注册表。模板 = 一份 Typst 源码 + default/floor 两套 token。
// 源码由调用方注入（浏览器用 Vite 的 ?raw，Node 用 fs，见 node.ts），本包不依赖运行环境。

import type { RuyeDocument, TemplateId } from "../../schema/src/index.ts";
import type { PageHeight, TemplateDef, TypographyTokens, TypstInput } from "../../engine/src/index.ts";

const FONTS = { sans: "Noto Sans SC", serif: "Noto Serif SC", mono: "Noto Sans Mono" };

export const CAMPUS_SERIF_TOKENS: { default: TypographyTokens; floor: TypographyTokens } = {
  default: {
    pageMarginMm: { top: 14, right: 15, bottom: 14, left: 15 },
    fontFamily: FONTS,
    namePt: 22,
    headingPt: 13.5,
    bodyPt: 11.25,
    metaPt: 10.75,
    lineHeight: 1.55,
    sectionGapMm: 5,
    itemGapMm: 3,
    paragraphGapMm: 0.8,
    compact: false,
  },
  floor: {
    pageMarginMm: { top: 14, right: 15, bottom: 14, left: 15 },
    fontFamily: FONTS,
    namePt: 18,
    headingPt: 12,
    bodyPt: 10.5,
    metaPt: 10.5,
    lineHeight: 1.35,
    sectionGapMm: 2.5,
    itemGapMm: 1.2,
    paragraphGapMm: 0.2,
    compact: true,
  },
};

const encoder = new TextEncoder();

/** data:image/png;base64,... → { ext, bytes } */
export function decodeDataUrl(url: string): { ext: string; bytes: Uint8Array } | null {
  const m = url.match(/^data:image\/(png|jpe?g|gif|svg\+xml|webp);base64,(.*)$/);
  if (!m) return null;
  const ext = m[1] === "jpeg" ? "jpg" : m[1] === "svg+xml" ? "svg" : m[1];
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { ext, bytes };
}

/** 把文档、token、页高组装成 Typst 虚拟文件。所有数据都走 JSON，不拼接 Typst 源码 */
export function buildTypstInput(source: string, doc: RuyeDocument, tokens: TypographyTokens, pageHeight: PageHeight): TypstInput {
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
  files["/data.json"] = encoder.encode(JSON.stringify({ modules }));
  files["/tokens.json"] = encoder.encode(JSON.stringify(tokens));
  files["/page.json"] = encoder.encode(JSON.stringify(page));
  return { main: "/main.typ", files };
}

export interface TemplateMeta {
  id: TemplateId;
  name: string;
  description: string;
  tokens: { default: TypographyTokens; floor: TypographyTokens };
}

/** v1 先实现 campus-serif；social-sans / split-compact 在阶段 2 加入 */
export const TEMPLATE_META: TemplateMeta[] = [
  { id: "campus-serif", name: "校招单栏", description: "衬线标题、教育前置，安静的纸感。适合应届生与实习。", tokens: CAMPUS_SERIF_TOKENS },
];

export function createTemplates(sources: Partial<Record<TemplateId, string>>): Map<TemplateId, TemplateDef> {
  const out = new Map<TemplateId, TemplateDef>();
  for (const meta of TEMPLATE_META) {
    const source = sources[meta.id];
    if (!source) continue;
    out.set(meta.id, {
      id: meta.id,
      name: meta.name,
      defaultTokens: meta.tokens.default,
      floorTokens: meta.tokens.floor,
      build: (doc, tokens, pageHeight) => buildTypstInput(source, doc, tokens, pageHeight),
    });
  }
  return out;
}

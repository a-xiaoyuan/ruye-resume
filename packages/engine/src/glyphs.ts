// 缺字检查：内置字体是子集（GB2312 + 常用符号），导出前找出文档里子集不包含的字符，
// 明确告诉用户而不是在 PDF 里留下方块。字符表由 `pnpm fonts` 生成（fonts/charset.txt）。

import type { RuyeDocument } from "../../schema/src/index.ts";

function collectStrings(v: unknown, out: string[]): void {
  if (typeof v === "string") out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => collectStrings(x, out));
  else if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) {
      if (k === "id" || k === "photoDataUrl" || k === "visible" || k === "type") continue;
      collectStrings(x, out);
    }
  }
}

/** 返回文档中字体子集缺少的字符（去重，按出现顺序）。charset 为空时视为完整字体，不检查 */
export function findMissingChars(doc: RuyeDocument, charset: string): string[] {
  if (!charset) return [];
  const have = new Set(Array.from(charset));
  const strings: string[] = [];
  collectStrings(doc.modules.filter((m) => m.visible), strings);
  const missing = new Set<string>();
  for (const s of strings) {
    for (const ch of s) {
      if (ch.trim() === "") continue;
      if (!have.has(ch)) missing.add(ch);
    }
  }
  return [...missing];
}

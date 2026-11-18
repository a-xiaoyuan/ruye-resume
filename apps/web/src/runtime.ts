// 浏览器端排版运行时：加载本地 wasm 与字体，创建唯一的排版引擎。
// 简历内容、字体、wasm 都不经过任何第三方服务器。

import { $typst, TypstSnippet } from "@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs";
import { initTypst, LayoutEngine, TypstSnippetBackend, type TemplateDef } from "../../../packages/engine/src/index.ts";
import { createTemplates } from "../../../packages/templates/src/index.ts";
import type { TemplateId } from "../../../packages/schema/src/index.ts";
import common from "../../../packages/templates/typst/common.typ?raw";
import classic from "../../../packages/templates/typst/classic.typ?raw";
import minimal from "../../../packages/templates/typst/minimal.typ?raw";
import elegant from "../../../packages/templates/typst/elegant.typ?raw";
import timeline from "../../../packages/templates/typst/timeline.typ?raw";
import campusSerif from "../../../packages/templates/typst/campus-serif.typ?raw";
import socialSans from "../../../packages/templates/typst/social-sans.typ?raw";
import splitCompact from "../../../packages/templates/typst/split-compact.typ?raw";

const FONT_FILES = ["NotoSansSC-Regular.otf", "NotoSansSC-Bold.otf", "NotoSerifSC-Bold.otf"];

export interface Runtime {
  engine: LayoutEngine;
  templates: Map<TemplateId, TemplateDef>;
  /** 字体子集包含的字符；空串表示完整字体，不做缺字检查 */
  charset: string;
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`加载失败：${url}（HTTP ${res.status}）。字体需要先运行 pnpm fonts 生成。`);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  // 校验是否是有效的字体二进制（防止开发服务器 SPA fallback 将 index.html 作为 200 返回）
  if (bytes.length < 4 || (bytes[0] === 0x3c && bytes[1] === 0x21)) {
    throw new Error(`加载字体失败：${url} 返回了 HTML 内容而非字体文件，请先运行 pnpm fonts 生成字体。`);
  }
  return bytes;
}

let pending: Promise<Runtime> | null = null;

/**
 * base：站点根目录的绝对地址（以 / 结尾）。在 Worker 里相对路径是相对 Worker 脚本解析的，
 * 而不是相对页面，所以由主线程算好绝对地址传进来。
 */
export function loadRuntime(base: string): Promise<Runtime> {
  const BASE = base.endsWith("/") ? base : `${base}/`;
  pending ??= (async () => {
    const [fonts, charset] = await Promise.all([
      Promise.all(FONT_FILES.map((f) => fetchBytes(`${BASE}fonts/${f}`))),
      fetch(`${BASE}fonts/charset.txt`).then((r) => (r.ok ? r.text() : "")),
    ]);
    initTypst($typst, TypstSnippet, {
      compilerWasm: `${BASE}wasm/compiler.wasm`,
      rendererWasm: `${BASE}wasm/renderer.wasm`,
      fonts,
    });
    return {
      engine: new LayoutEngine(new TypstSnippetBackend($typst)),
      templates: createTemplates({ common, classic, minimal, elegant, timeline, "campus-serif": campusSerif, "social-sans": socialSans, "split-compact": splitCompact }),
      charset,
    };
  })();
  return pending;
}

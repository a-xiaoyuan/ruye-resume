// 浏览器端排版运行时：加载本地 wasm 与字体，创建唯一的排版引擎。
// 简历内容、字体、wasm 都不经过任何第三方服务器。

import { $typst, TypstSnippet } from "@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs";
import { initTypst, LayoutEngine, TypstSnippetBackend, type TemplateDef } from "../../../packages/engine/src/index.ts";
import { createTemplates } from "../../../packages/templates/src/index.ts";
import type { TemplateId } from "../../../packages/schema/src/index.ts";
import common from "../../../packages/templates/typst/common.typ?raw";
import campusSerif from "../../../packages/templates/typst/campus-serif.typ?raw";
import socialSans from "../../../packages/templates/typst/social-sans.typ?raw";
import splitCompact from "../../../packages/templates/typst/split-compact.typ?raw";

const BASE = import.meta.env.BASE_URL;
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
  return new Uint8Array(await res.arrayBuffer());
}

let pending: Promise<Runtime> | null = null;

export function loadRuntime(): Promise<Runtime> {
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
      templates: createTemplates({ common, "campus-serif": campusSerif, "social-sans": socialSans, "split-compact": splitCompact }),
      charset,
    };
  })();
  return pending;
}

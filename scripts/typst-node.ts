// 在 Node 里加载 typst.ts（集成测试与 smoke 脚本共用）。
// 依赖没装或字体没准备好时返回 null 并说明原因，调用方据此跳过。

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { initTypst, TypstSnippetBackend, type TypstSnippetLike, type TypstSnippetStatics } from "../packages/engine/src/index.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(root, "package.json"));

export const FONT_DIR = join(root, "packages/templates/fonts");
export const FONT_FILES = ["NotoSansSC-Regular.otf", "NotoSansSC-Bold.otf", "NotoSerifSC-Bold.otf"];

function findWasm(pkg: string): string {
  const dir = dirname(require.resolve(`${pkg}/package.json`));
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop()!;
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) {
        if (name !== "node_modules") stack.push(p);
      } else if (name.endsWith("_bg.wasm")) return p;
    }
  }
  throw new Error(`在 ${pkg} 里找不到 *_bg.wasm`);
}

export async function loadNodeTypst(): Promise<{ backend: TypstSnippetBackend } | { skip: string }> {
  let mod: { $typst: TypstSnippetLike; TypstSnippet: TypstSnippetStatics };
  try {
    mod = await import("@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs" as string);
  } catch (e) {
    return { skip: `未安装 @myriaddreamin/typst.ts（先运行 pnpm install）：${(e as Error).message}` };
  }
  const missing = FONT_FILES.filter((f) => !existsSync(join(FONT_DIR, f)));
  if (missing.length) return { skip: `缺少字体 ${missing.join("、")}（先运行 pnpm fonts）` };

  initTypst(mod.$typst, mod.TypstSnippet, {
    compilerWasm: readFileSync(findWasm("@myriaddreamin/typst-ts-web-compiler")),
    rendererWasm: readFileSync(findWasm("@myriaddreamin/typst-ts-renderer")),
    fonts: FONT_FILES.map((f) => new Uint8Array(readFileSync(join(FONT_DIR, f)))),
  });
  return { backend: new TypstSnippetBackend(mod.$typst) };
}

export function loadCharset(): string {
  const p = join(FONT_DIR, "charset.txt");
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

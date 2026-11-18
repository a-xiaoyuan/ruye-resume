// 把 typst.ts 的编译器与渲染器 wasm 复制到 public/wasm/，网页按相对 URL 加载（不依赖 CDN）
import { copyFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, "..", "package.json"));
const outDir = join(here, "..", "public", "wasm");
mkdirSync(outDir, { recursive: true });

function findWasm(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "node_modules") continue;
      const hit = findWasm(p);
      if (hit) return hit;
    } else if (name.endsWith("_bg.wasm")) return p;
  }
  return null;
}

for (const [pkg, out] of [
  ["@myriaddreamin/typst-ts-web-compiler", "compiler.wasm"],
  ["@myriaddreamin/typst-ts-renderer", "renderer.wasm"],
]) {
  const wasm = findWasm(dirname(require.resolve(`${pkg}/package.json`)));
  if (!wasm) throw new Error(`找不到 ${pkg} 的 wasm`);
  copyFileSync(wasm, join(outDir, out));
  console.log(`wasm: ${pkg} → public/wasm/${out}`);
}

// 复制 pdf.worker.min.mjs 到 public/，供 pdfjs-dist 在浏览器端纯本地加载
try {
  const pdfWorkerSrc = require.resolve("pdfjs-dist/legacy/build/pdf.worker.min.mjs");
  const publicDir = join(here, "..", "public");
  copyFileSync(pdfWorkerSrc, join(publicDir, "pdf.worker.min.mjs"));
  console.log("pdf worker: pdfjs-dist → public/pdf.worker.min.mjs");
} catch (e) {
  console.warn("未能复制 pdf.worker.min.mjs:", e.message);
}

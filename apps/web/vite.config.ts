import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  // 相对路径，构建产物可直接放到 GitHub Pages 的子路径下
  base: "./",
  plugins: [react()],
  server: { fs: { allow: [repoRoot] } },
  // typst.ts 自带 wasm，交给它自己按 URL 加载，不让 Vite 预打包
  optimizeDeps: { exclude: ["@myriaddreamin/typst.ts"] },
  // 排版在 Web Worker 里跑；typst.ts 内部有动态 import，Worker 需要 ES 模块格式
  worker: { format: "es" },
});

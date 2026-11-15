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
});

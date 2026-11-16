import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  // 相对路径，构建产物可直接放到 GitHub Pages 的子路径下
  base: "./",
  plugins: [react()],
  server: {
    fs: { allow: [repoRoot] },
    // 开发时把 /api 转给本机的同步后端（server/），前端用 VITE_RUYE_API=/ 走同源，不需要跨域。
    // 去掉 Origin 头：对后端来说这就是同源请求，不受 CORS 白名单影响
    proxy: {
      "/api": {
        target: process.env.RUYE_API_TARGET ?? "http://localhost:8080",
        changeOrigin: true,
        configure: (proxy) => proxy.on("proxyReq", (req) => req.removeHeader("origin")),
      },
    },
  },
  // typst.ts 自带 wasm，交给它自己按 URL 加载，不让 Vite 预打包
  optimizeDeps: { exclude: ["@myriaddreamin/typst.ts"] },
  // 排版在 Web Worker 里跑；typst.ts 内部有动态 import，Worker 需要 ES 模块格式
  worker: { format: "es" },
});

// 端到端测试：真实浏览器打开编辑器，走一遍主要流程。
//   pnpm e2e        编辑、换模板、导出 PDF、Markdown 往返、撤销、刷新后内容仍在
//   pnpm e2e:sync   另外测登录同步：需要先在 server/ 里运行 mvn spring-boot:run（8080 端口）
// 首次运行前安装浏览器：pnpm exec playwright install chromium
// 下载慢时可以直接用本机已装的 Chrome：设置环境变量 E2E_BROWSER_CHANNEL=chrome（Edge 用 msedge）
import { defineConfig } from "@playwright/test";

const sync = process.env.E2E_SYNC === "1";
const port = 5199;

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  expect: { timeout: 60_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://127.0.0.1:${port}`, acceptDownloads: true, viewport: { width: 1440, height: 900 } },
  webServer: {
    command: `pnpm --filter @ruye/web dev --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
    // 同步测试走同源 /api（Vite 代理到 8080）；其余测试不配置后端，界面上没有登录入口
    env: { ...(process.env as Record<string, string>), VITE_RUYE_API: sync ? "/" : "" },
  },
  projects: [{ name: "chromium", use: { browserName: "chromium", channel: process.env.E2E_BROWSER_CHANNEL || undefined } }],
});

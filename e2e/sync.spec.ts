// 登录同步的端到端测试：两个互不相干的浏览器上下文模拟两台设备。
// 需要后端运行在 8080 端口，用 pnpm e2e:sync 运行；平时 pnpm e2e 会跳过。
import { expect, test, type Page } from "@playwright/test";

test.skip(process.env.E2E_SYNC !== "1", "设置 E2E_SYNC=1 并启动后端后运行");

const email = `e2e-${Date.now()}@example.com`;
const password = "e2e-password-123";

async function ready(page: Page) {
  await expect(page.locator(".board .svg svg").first()).toBeVisible();
}

async function signIn(page: Page, mode: "注册" | "登录") {
  await page.getByRole("button", { name: "登录同步" }).click();
  const dialog = page.getByRole("dialog");
  if (mode === "注册") await dialog.getByRole("tab", { name: "注册" }).click();
  await dialog.getByLabel("邮箱").fill(email);
  await dialog.getByLabel("密码").fill(password);
  await dialog.getByRole("button", { name: mode === "注册" ? "注册并登录" : "登录" }).click();
  await expect(page.locator(".account-btn.signed-in")).toBeVisible();
}

test("设备 A 修改后上传，设备 B 登录后能看到这份简历", async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  await a.goto("/");
  await ready(a);
  await signIn(a, "注册");
  await a.getByLabel("姓名", { exact: true }).fill("同步端到端");
  // 内容变化 5 秒后自动同步
  await expect(a.locator(".account-btn.signed-in")).toHaveAttribute("title", /上传 1 份/, { timeout: 30_000 });

  const b = await (await browser.newContext()).newPage();
  await b.goto("/");
  await ready(b);
  await signIn(b, "登录");
  await expect(b.locator(".account-btn.signed-in")).toHaveAttribute("title", /下载 1 份/, { timeout: 30_000 });
  await b.locator(".doc-trigger").click();
  await expect(b.getByText("同步端到端-Java 后端实习生")).toBeVisible();
});

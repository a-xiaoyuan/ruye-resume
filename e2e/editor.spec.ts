import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/** 等排版引擎加载完、预览出现 A4 纸 */
async function ready(page: Page) {
  await expect(page.locator(".board .svg svg").first()).toBeVisible();
  await expect(page.locator(".busy-flag")).toHaveCount(0);
}

const nameField = (page: Page) => page.getByLabel("姓名", { exact: true });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await ready(page);
});

test("首次打开：载入示例并排出一页 A4", async ({ page }) => {
  await expect(nameField(page)).toHaveValue("林知夏");
  // 完整示例在默认间距下略超一页，会自动收紧后装进一页；任何情况下都不能是溢出
  await expect(page.locator(".fit-pill")).toHaveText(/已装进一页|已自动收紧|放宽/);
  await expect(page.locator(".fit-pill")).not.toHaveClass(/error/);
  // 没配置后端时不显示登录入口；pnpm e2e:sync 配置了后端，应当显示
  await expect(page.getByRole("button", { name: "登录同步" })).toHaveCount(process.env.E2E_SYNC === "1" ? 1 : 0);
});

test("修改姓名：标题同步更新，刷新页面后内容仍在", async ({ page }) => {
  await nameField(page).fill("端到端测试");
  await expect(page.getByText("端到端测试-Java 后端实习生").first()).toBeVisible();
  await expect(page.locator(".save-state")).toContainText("仅保存在此浏览器");
  await page.reload();
  await ready(page);
  await expect(nameField(page)).toHaveValue("端到端测试");
});

test("切换模板：预览重新排版，摘要卡显示新模板", async ({ page }) => {
  await page.getByRole("tab", { name: "模板与样式" }).click();
  await page.getByRole("radio", { name: "时间轴" }).click();
  await ready(page);
  await page.getByRole("tab", { name: "内容" }).click();
  await expect(page.locator(".style-summary")).toContainText("时间轴");
});

test("导出 PDF：文件名正确、确实是 PDF", async ({ page }) => {
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "下载 PDF" }).click()]);
  expect(download.suggestedFilename()).toMatch(/林知夏.*\.pdf$/);
  const bytes = readFileSync(await download.path());
  expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
});

test("Markdown 导出后再导入，内容不变", async ({ page }) => {
  await nameField(page).fill("往返测试");
  await page.getByRole("button", { name: "导出", exact: true }).click();
  const [md] = await Promise.all([page.waitForEvent("download"), page.getByRole("menuitem", { name: /导出 Markdown/ }).click()]);
  const text = readFileSync(await md.path(), "utf8");
  expect(text).toContain("# 往返测试");

  await page.getByRole("button", { name: "文件", exact: true }).click();
  await page.getByRole("menuitem", { name: /Go 后端/ }).click();
  await expect(nameField(page)).toHaveValue("顾远舟");

  await page.locator('input[type="file"][accept=".json,.md,.txt"]').setInputFiles({ name: "roundtrip.md", mimeType: "text/markdown", buffer: Buffer.from(text) });
  await expect(page.getByText("已从 Markdown 导入。")).toBeVisible();
  await expect(nameField(page)).toHaveValue("往返测试");
});

test("删除模块后可以撤销", async ({ page }) => {
  await page.getByRole("button", { name: /获奖情况/ }).first().click();
  await page.getByRole("button", { name: "删除模块" }).click();
  await expect(page.getByText("已删除模块「获奖情况」。")).toBeVisible();
  await page.getByRole("button", { name: "撤销" }).click();
  await expect(page.locator(".module-nav")).toContainText("获奖情况");
});

test("空白简历显示写作建议", async ({ page }) => {
  await page.getByRole("button", { name: "文件", exact: true }).click();
  await page.getByRole("menuitem", { name: "新建空白简历" }).click();
  await expect(page.getByRole("region", { name: "写作建议" })).toContainText("没有留电话或邮箱");
});

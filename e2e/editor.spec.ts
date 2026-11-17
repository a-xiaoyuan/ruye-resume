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

test("切换模板：预览重新排版，顶栏「外观」显示新模板", async ({ page }) => {
  await page.getByRole("button", { name: /外观/ }).click();
  await page.getByRole("radio", { name: "时间轴" }).click();
  await ready(page);
  await page.keyboard.press("Escape");
  await expect(page.locator(".appearance-current")).toHaveText("时间轴");
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

  await page.getByRole("button", { name: "我的简历", exact: true }).click();
  await page.getByRole("button", { name: /Go 后端/ }).click();
  await expect(nameField(page)).toHaveValue("顾远舟");

  await page.locator('input[type="file"][accept=".json,.md,.txt"]').setInputFiles({ name: "roundtrip.md", mimeType: "text/markdown", buffer: Buffer.from(text) });
  await expect(page.getByText("已从 Markdown 导入。")).toBeVisible();
  await expect(nameField(page)).toHaveValue("往返测试");
});

test("删除模块后可以撤销", async ({ page }) => {
  await page.locator(".module-pills").getByRole("button", { name: /获奖情况/ }).first().click();
  await page.getByRole("button", { name: "删除模块「获奖情况」" }).click();
  await expect(page.getByText("已删除模块「获奖情况」。")).toBeVisible();
  await page.locator(".toast").getByRole("button", { name: "撤销" }).click();
  await expect(page.locator(".module-pills")).toContainText("获奖情况");
});

test("空白简历显示写作建议", async ({ page }) => {
  await page.getByRole("button", { name: "我的简历", exact: true }).click();
  await page.getByRole("button", { name: "新建空白简历" }).click();
  await expect(page.getByRole("region", { name: "写作建议" }).filter({ hasText: "没有留电话或邮箱" })).toHaveCount(1);
});

test("粘贴多行要点：自动拆成多条，去掉行首圆点", async ({ page }) => {
  const project = page.locator("[data-module]").filter({ has: page.getByRole("heading", { name: "项目经历" }) });
  await project.locator(".item-toggle").first().click();
  const bullets = project.locator('textarea[aria-label^="做了什么、结果如何第"]');
  const before = await bullets.count();
  await bullets.first().evaluate((el) => {
    const dt = new DataTransfer();
    dt.setData("text/plain", "• 第一条\n• 第二条\n3. 第三条");
    (el as HTMLTextAreaElement).setSelectionRange(0, (el as HTMLTextAreaElement).value.length);
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  await expect(bullets).toHaveCount(before + 2);
  await expect(bullets.nth(0)).toHaveValue("第一条");
  await expect(bullets.nth(2)).toHaveValue("第三条");
});

test("Ctrl+S 不弹浏览器保存，提示已自动保存", async ({ page }) => {
  await page.keyboard.press("Control+s");
  await expect(page.getByText("不用手动保存")).toBeVisible();
});

test("我的简历：删除进回收站，可以恢复", async ({ page }) => {
  await nameField(page).fill("回收站测试");
  await page.getByRole("button", { name: "我的简历", exact: true }).click();
  // 再新建一份，好删掉「回收站测试」那份
  await page.getByRole("button", { name: "新建空白简历" }).click();
  await page.getByRole("button", { name: "我的简历", exact: true }).click();
  const card = page.locator(".doc-card").filter({ hasText: "回收站测试" });
  await card.getByRole("button", { name: "删除" }).click();
  await expect(page.locator(".doc-card").filter({ hasText: "回收站测试" })).toHaveCount(0);
  await page.getByRole("button", { name: /回收站/ }).click();
  await page.locator(".plain-list li").filter({ hasText: "回收站测试" }).getByRole("button", { name: "恢复" }).click();
  await expect(nameField(page)).toHaveValue("回收站测试");
});

test("撤销与重做：删除条目后 Ctrl+Z 找回，Ctrl+Shift+Z 再删掉", async ({ page }) => {
  const award = page.locator("[data-module]").filter({ has: page.getByRole("heading", { name: "获奖情况" }) });
  const before = await award.locator(".item-card").count();
  await award.locator(".item-card").first().getByRole("button", { name: /^删除 / }).click();
  await expect(award.locator(".item-card")).toHaveCount(before - 1);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Control+z");
  await expect(award.locator(".item-card")).toHaveCount(before);
  await page.keyboard.press("Control+Shift+z");
  await expect(award.locator(".item-card")).toHaveCount(before - 1);
});

test("日期点选：选开始后自动打开结束，可选「至今」", async ({ page }) => {
  const project = page.locator("[data-module]").filter({ has: page.getByRole("heading", { name: "项目经历" }) });
  await project.locator(".item-toggle").first().click();
  const card = project.locator(".item-card.open");
  // 结束日期空着时，选完开始才会自动打开结束
  await card.getByRole("button", { name: "清除结束" }).click();
  await card.getByRole("button", { name: /^开始：/ }).click();
  await card.getByRole("button", { name: "选择年份" }).click();
  await card.getByRole("button", { name: "2023", exact: true }).click();
  await card.getByRole("button", { name: "2023 年 3 月" }).click();
  await expect(card.getByRole("button", { name: /^开始：/ })).toHaveAccessibleName("开始：2023 年 3 月");
  // 结束日期自动打开
  await expect(card.getByRole("dialog", { name: "选择结束" })).toBeVisible();
  await card.getByRole("dialog", { name: "选择结束" }).getByRole("button", { name: "至今" }).click();
  await expect(card.getByRole("button", { name: /^结束：/ })).toHaveAccessibleName("结束：至今");
});

test("常用选项：点一下填入学历", async ({ page }) => {
  const edu = page.locator("[data-module]").filter({ has: page.getByRole("heading", { name: "教育背景" }) });
  const toggle = edu.locator(".item-toggle").first();
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  const degree = edu.getByLabel("学历", { exact: true });
  await degree.fill("");
  await edu.getByRole("group", { name: "学历常用选项" }).getByRole("button", { name: "硕士" }).click();
  await expect(degree).toHaveValue("硕士");
});

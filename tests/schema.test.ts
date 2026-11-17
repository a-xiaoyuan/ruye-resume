import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  checkExportable,
  createEmptyDocument,
  exportBaseName,
  fromMarkdown,
  isSafeUrl,
  THEME_IDS,
  THEMES,
  normalizeDate,
  renderableModules,
  toMarkdown,
  validateDocument,
  type RuyeDocument,
} from "../packages/schema/src/index.ts";

const load = (name: string): RuyeDocument => JSON.parse(readFileSync(new URL(`../fixtures/${name}.ruye.json`, import.meta.url), "utf8"));

for (const name of ["full", "short", "medium", "long"]) {
  test(`fixture ${name} 通过校验`, () => {
    const r = validateDocument(load(name));
    assert.ok(r.ok, r.ok ? "" : JSON.stringify(r.issues, null, 2));
  });
}

test("非法文件给出带路径的错误", () => {
  const doc = load("short") as unknown as Record<string, any>;
  doc.modules[2].data.items[0].start = "2024年秋";
  doc.layout.pageMode = "a4-magic";
  const r = validateDocument(doc);
  assert.equal(r.ok, false);
  if (!r.ok) {
    const paths = r.issues.map((i) => i.path);
    assert.ok(paths.includes("$.modules[2].data.items[0].start"));
    assert.ok(paths.includes("$.layout.pageMode"));
  }
});

test("主题色：合法值通过，非法值报错，Markdown 往返保留", () => {
  const doc = load("short");
  doc.layout.theme = "teal";
  assert.ok(validateDocument(doc).ok);
  assert.equal(fromMarkdown(toMarkdown(doc)).doc.layout.theme, "teal");
  (doc.layout as any).theme = "rainbow";
  assert.equal(validateDocument(doc).ok, false);
});

test("同类模块只能有一个", () => {
  const doc = load("short");
  doc.modules.push({ ...doc.modules[0], id: "dup" });
  const r = validateDocument(doc);
  assert.equal(r.ok, false);
});

test("照片只接受 data URL", () => {
  const doc = load("short");
  const b = doc.modules[0];
  if (b.type === "basic_info") b.data.photoDataUrl = "https://evil.example/a.png";
  assert.equal(validateDocument(doc).ok, false);
});

test("空模块与隐藏模块不参与排版", () => {
  const doc = createEmptyDocument();
  assert.equal(renderableModules(doc).length, 0);
  const short = load("short");
  short.modules[1].visible = false;
  assert.ok(!renderableModules(short).some((m) => m.type === "job_intention"));
});

test("导出检查：姓名必填；文件名去掉非法字符", () => {
  const doc = createEmptyDocument();
  const r = checkExportable(doc);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.message, "未填写姓名，无法导出 PDF。");
  assert.equal(exportBaseName(doc), "简历");
  assert.equal(exportBaseName(load("short")), "林知夏-Java 后端实习生");
  const d2 = load("short");
  if (d2.modules[0].type === "basic_info") d2.modules[0].data.name = "林/知:夏";
  assert.equal(exportBaseName(d2), "林知夏-Java 后端实习生");
});

test("日期归一化", () => {
  assert.equal(normalizeDate("2024.09"), "2024-09");
  assert.equal(normalizeDate("2024/9"), "2024-09");
  assert.equal(normalizeDate("2024年9月"), "2024-09");
  assert.equal(normalizeDate("现在"), "至今");
  assert.equal(normalizeDate("2024.13"), "2024.13");
});

test("JSON 往返：语义相等", () => {
  for (const name of ["short", "long"]) {
    const doc = load(name);
    const back = JSON.parse(JSON.stringify(doc));
    assert.deepEqual(back, doc);
    assert.ok(validateDocument(back).ok);
  }
});

test("Markdown 往返：核心字段不丢失", () => {
  const doc = load("long");
  doc.modules.find((m) => m.type === "research")!.visible = false;
  const md = toMarkdown(doc);
  const { doc: back, warnings } = fromMarkdown(md);
  assert.deepEqual(warnings, []);
  const v = validateDocument(back);
  assert.ok(v.ok, v.ok ? "" : JSON.stringify(v.issues, null, 2));
  assert.equal(back.layout.templateId, doc.layout.templateId);
  assert.equal(back.layout.pageMode, doc.layout.pageMode);
  assert.deepEqual(back.modules.map((m) => [m.type, m.visible]), doc.modules.map((m) => [m.type, m.visible]));
  // 姓名、联系方式
  assert.deepEqual(back.modules[0].data, doc.modules[0].data);
  // 每个模块的条目数、要点、日期、技术栈
  for (let i = 0; i < doc.modules.length; i++) {
    const a = doc.modules[i] as any;
    const b = back.modules[i] as any;
    if (a.data.items) {
      assert.equal(b.data.items.length, a.data.items.length, a.type);
      a.data.items.forEach((it: any, j: number) => {
        const bt = b.data.items[j];
        for (const k of ["bullets", "highlights", "techStack", "start", "end", "summary", "url", "date", "description"]) {
          assert.deepEqual(bt[k], it[k], `${a.type}[${j}].${k}`);
        }
      });
    }
    if (a.data.categories) {
      assert.deepEqual(b.data.categories.map((c: any) => [c.name, c.items]), a.data.categories.map((c: any) => [c.name, c.items]));
    }
  }
});

test("Markdown 导入：设计说明书里的示例能解析", () => {
  const md = `---
title: 林知夏-Java后端实习
template: campus-serif
pageMode: fit-a4
---

# 林知夏
- 电话：13800000000
- 邮箱：example@example.com
- GitHub：https://github.com/example

## 教育背景
### 某某大学 · 网络工程 · 本科
2024.09 - 2028.06
- GPA 3.7 / 4.0（专业前 10%）

## 实习经历
### 某某科技 · 后端实习生
2025.07 - 2025.09
- 简介：电商订单服务
- 技术栈：Java、Spring Boot、Redis
- 参与订单查询接口优化，将 P99 从 320ms 降到 140ms
一段没有前缀的说明文字

## 爱好
- 跑步
`;
  const { doc, warnings } = fromMarkdown(md);
  assert.ok(validateDocument(doc).ok);
  assert.equal(warnings.length, 1); // 「爱好」不是已知模块
  const intern = doc.modules.find((m) => m.type === "internship");
  assert.ok(intern && intern.type === "internship");
  const it = intern.data.items[0];
  assert.equal(it.start, "2025-07");
  assert.deepEqual(it.techStack, ["Java", "Spring Boot", "Redis"]);
  assert.equal(it.bullets.length, 2);
  assert.equal(it.summary, "电商订单服务");
});

test("链接只接受 http、https、mailto；不写协议也可以", () => {
  for (const ok of ["", "https://a.com", "http://a.com", "mailto:a@b.com", "github.com/x", "HTTPS://A.COM"]) assert.ok(isSafeUrl(ok), ok);
  for (const bad of ["javascript:alert(1)", " JavaScript:alert(1)", "data:text/html,<b>", "vbscript:x", "file:///etc/passwd"]) assert.ok(!isSafeUrl(bad), bad);
  const doc = load("short");
  if (doc.modules[0].type === "basic_info") {
    doc.modules[0].data.github = "javascript:alert(1)";
    doc.modules[0].data.customLinks = [{ label: "x", url: "data:text/html,1" }];
  }
  const r = validateDocument(doc);
  assert.equal(r.ok, false);
  if (!r.ok) assert.deepEqual(r.issues.map((i) => i.path), ["$.modules[0].data.github", "$.modules[0].data.customLinks[0].url"]);
});

test("Markdown 往返保留照片；远程图片与放错位置的图片给出提示", () => {
  const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
  const doc = load("short");
  if (doc.modules[0].type === "basic_info") doc.modules[0].data.photoDataUrl = png;
  const md = toMarkdown(doc);
  assert.ok(md.includes(`![照片](${png})`));
  const back = fromMarkdown(md);
  assert.deepEqual(back.warnings, []);
  assert.ok(validateDocument(back.doc).ok);
  assert.deepEqual(back.doc.modules[0].data, doc.modules[0].data);

  const remote = fromMarkdown("# 林知夏\n![照片](https://example.com/me.jpg)\n- 电话：1\n\n## 项目经历\n### 某项目\n![图](data:image/png;base64,AAAA)\n- 做了一件事\n");
  assert.equal(remote.warnings.length, 2);
  assert.match(remote.warnings[0], /不会下载远程图片/);
  assert.match(remote.warnings[1], /其他位置的图片已忽略/);
  const info = remote.doc.modules[0];
  assert.ok(info.type === "basic_info" && info.data.photoDataUrl === undefined && info.data.phone === "1");
  const proj = remote.doc.modules.find((m) => m.type === "project");
  assert.ok(proj && proj.type === "project" && proj.data.items[0].bullets.length === 1);
});

test("专业技能：描述句与分类可以混用，Markdown 往返不混淆", () => {
  const doc = load("long");
  const skills = doc.modules.find((m) => m.type === "skills");
  assert.ok(skills && skills.type === "skills" && (skills.data.notes ?? []).length === 3);
  // 带冒号的描述句（「JVM：……」）导出后不能被当成分类
  const back = fromMarkdown(toMarkdown(doc));
  assert.deepEqual(back.warnings, []);
  const s2 = back.doc.modules.find((m) => m.type === "skills");
  assert.ok(s2 && s2.type === "skills");
  assert.deepEqual(s2.data.notes, skills.data.notes);
  assert.deepEqual(s2.data.categories.map((c) => [c.name, c.items]), skills.data.categories.map((c) => [c.name, c.items]));
});

test("专业技能：旧版 Markdown（分类名不加粗）仍能正确区分分类与描述句", () => {
  const { doc } = fromMarkdown("# 张三\n\n## 专业技能\n- 语言：Java、Python\n- 框架：Spring Boot、MyBatis\n- 熟悉 JVM 内存模型\n- Java 基础：熟悉集合，理解 AQS\n");
  const s = doc.modules.find((m) => m.type === "skills");
  assert.ok(s && s.type === "skills");
  assert.deepEqual(s.data.categories.map((c) => c.name), ["语言", "框架"]);
  assert.deepEqual(s.data.notes, ["熟悉 JVM 内存模型", "Java 基础：熟悉集合，理解 AQS"]);
});

test("专业技能：只有描述句也算有内容；描述句必须是字符串", () => {
  const doc = load("short");
  const s = doc.modules.find((m) => m.type === "skills")!;
  if (s.type !== "skills") return;
  s.data = { categories: [], notes: ["熟悉 Java"] };
  assert.ok(renderableModules(doc).some((m) => m.type === "skills"));
  assert.ok(validateDocument(doc).ok);
  s.data = { categories: [], notes: ["  "] };
  assert.ok(!renderableModules(doc).some((m) => m.type === "skills"));
  (s.data as any).notes = [1];
  const r = validateDocument(doc);
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.issues.some((i) => i.path.endsWith(".notes[0]")));
});

test("主题色：schema 与 Typst 色板一致（6 个主题的主色、辅色）", () => {
  const typ = readFileSync(new URL("../packages/templates/typst/common.typ", import.meta.url), "utf8");
  for (const id of THEME_IDS) {
    const m = typ.match(new RegExp(`\\b${id}: \\(primary: rgb\\("(#[0-9a-f]{6})"\\), secondary: rgb\\("(#[0-9a-f]{6})"\\)`));
    assert.ok(m, `common.typ 缺少主题 ${id}`);
    assert.equal(m[1], THEMES[id].accent, `${id} 主色`);
    assert.equal(m[2], THEMES[id].secondary, `${id} 辅色`);
  }
});

test("完整示例：小标题、句首短标题、自我评价经 Markdown 往返不丢失", () => {
  const doc = load("full");
  const back = fromMarkdown(toMarkdown(doc));
  assert.deepEqual(back.warnings, []);
  assert.equal(back.doc.layout.templateId, "classic");
  const p1 = doc.modules.find((m) => m.type === "project")!;
  const p2 = back.doc.modules.find((m) => m.type === "project")!;
  assert.ok(p1.type === "project" && p2.type === "project");
  assert.deepEqual(p2.data.items.map((i) => i.bullets), p1.data.items.map((i) => i.bullets));
  assert.deepEqual(p2.data.items.map((i) => i.summary), p1.data.items.map((i) => i.summary));
  const s1 = doc.modules.find((m) => m.type === "summary")!;
  const s2 = back.doc.modules.find((m) => m.type === "summary")!;
  assert.ok(s1.type === "summary" && s2.type === "summary");
  assert.equal(s2.data.text, s1.data.text);
});

test("自我评价：空白不算内容；text 必须是字符串；「个人评价」「项目简介」等别名可导入", () => {
  const doc = load("full");
  const s = doc.modules.find((m) => m.type === "summary")!;
  if (s.type !== "summary") return;
  s.data.text = "  \n ";
  assert.ok(!renderableModules(doc).some((m) => m.type === "summary"));
  (s.data as any).text = 3;
  assert.equal(validateDocument(doc).ok, false);
  const { doc: d, warnings } = fromMarkdown("# 张三\n\n## 项目经历\n### 某系统 | 后端\n- 项目简介：一个系统\n- 个人职责：\n- 写接口\n\n## 个人评价\n踏实\n肯干\n");
  assert.deepEqual(warnings, []);
  const p = d.modules.find((m) => m.type === "project")!;
  assert.ok(p.type === "project");
  assert.equal(p.data.items[0].summary, "一个系统");
  assert.deepEqual(p.data.items[0].bullets, ["个人职责：", "写接口"]);
  const sm = d.modules.find((m) => m.type === "summary")!;
  assert.ok(sm.type === "summary");
  assert.equal(sm.data.text, "踏实\n肯干");
});

test("出生年月可以显示成年龄：按今天算周岁", async () => {
  const { ageFrom, renderableModules } = await import("../packages/schema/src/index.ts");
  const today = new Date(2026, 10, 16);
  assert.equal(ageFrom("2006-12", today), 19);
  assert.equal(ageFrom("2006-11", today), 20);
  assert.equal(ageFrom("", today), null);
  const doc = { modules: [{ id: "b", type: "basic_info", visible: true, data: { name: "林知夏", birthday: "2006-12", birthdayAs: "age" } }] } as never;
  const [b] = renderableModules(doc, today) as { data: { birthday: string } }[];
  assert.equal(b.data.birthday, "19 岁");
});

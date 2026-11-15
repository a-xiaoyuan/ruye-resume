import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  checkExportable,
  createEmptyDocument,
  exportBaseName,
  fromMarkdown,
  normalizeDate,
  renderableModules,
  toMarkdown,
  validateDocument,
  type RuyeDocument,
} from "../packages/schema/src/index.ts";

const load = (name: string): RuyeDocument => JSON.parse(readFileSync(new URL(`../fixtures/${name}.ruye.json`, import.meta.url), "utf8"));

for (const name of ["short", "medium", "long"]) {
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

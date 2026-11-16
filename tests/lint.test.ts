import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lintDocument, type RuyeDocument } from "../packages/schema/src/index.ts";

const load = (name: string): RuyeDocument => JSON.parse(readFileSync(new URL(`../fixtures/${name}.ruye.json`, import.meta.url), "utf8"));

test("示例简历都没有写作提示（示例本身要做好榜样）", () => {
  for (const name of ["full", "role-go", "role-frontend", "role-testdev", "role-algo", "role-pm"]) {
    assert.deepEqual(lintDocument(load(name)), [], name);
  }
});

test("写作检查：联系方式、量化结果、过长、空泛开头、重复、精通过多", () => {
  const doc = load("full");
  const basic = doc.modules.find((m) => m.type === "basic_info")!;
  if (basic.type === "basic_info") {
    delete basic.data.phone;
    delete basic.data.email;
  }
  const proj = doc.modules.find((m) => m.type === "project")!;
  if (proj.type === "project") {
    proj.data.items[0].bullets = ["个人职责：", "负责后端开发", "设计了接口和数据库表结构，和前端联调完成上线", "x".repeat(95)];
    proj.data.items[1].bullets = ["设计了接口和数据库表结构，和前端联调完成上线"];
  }
  const skills = doc.modules.find((m) => m.type === "skills")!;
  if (skills.type === "skills") skills.data.notes = ["精通 Java", "精通 MySQL", "精通 Redis"];

  const msgs = lintDocument(doc).map((i) => i.message);
  assert.ok(msgs.some((m) => m.includes("没有留电话或邮箱")));
  assert.ok(msgs.some((m) => m.includes("没有任何量化结果")));
  assert.ok(msgs.some((m) => m.includes("第 4 条有 95 字")));
  assert.ok(msgs.some((m) => m.includes("第 2 条只写了「负责」")));
  assert.ok(msgs.some((m) => m.includes("完全相同")));
  assert.ok(msgs.some((m) => m.includes("3 条写了「精通」")));
});

test("写作检查：隐藏的模块不检查；只有小标题的经历提示还没写内容", () => {
  const doc = load("full");
  const proj = doc.modules.find((m) => m.type === "project")!;
  if (proj.type === "project") proj.data.items[0].bullets = ["个人职责：", "技术亮点："];
  assert.ok(lintDocument(doc).some((i) => i.message.startsWith("还没有写内容")));
  proj.visible = false;
  assert.deepEqual(lintDocument(doc), []);
});

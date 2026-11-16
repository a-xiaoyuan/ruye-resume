import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { toMarkdown, type RuyeDocument } from "../packages/schema/src/index.ts";
import { parseImport } from "../apps/web/src/import-file.ts";

const load = (name: string): RuyeDocument => JSON.parse(readFileSync(new URL(`../fixtures/${name}.ruye.json`, import.meta.url), "utf8"));

test("导入 JSON：合法、可恢复、无法恢复、不是 JSON", () => {
  const doc = load("role-go");
  const ok = parseImport("a.ruye.json", JSON.stringify(doc));
  assert.ok(ok.ok && ok.doc.meta.title === doc.meta.title && !ok.level);

  const broken = structuredClone(doc) as unknown as { layout: { templateId: string } };
  broken.layout.templateId = "nope";
  const rec = parseImport("a.JSON", JSON.stringify(broken));
  assert.ok(rec.ok && rec.level === "error" && rec.sticky);

  const bad = parseImport("a.json", JSON.stringify({ hello: 1 }));
  assert.ok(!bad.ok && bad.message.includes("没有被替换"));
  const notJson = parseImport("a.json", "{oops");
  assert.ok(!notJson.ok && notJson.message.includes("不是合法的 JSON"));
});

test("导入 Markdown：岗位示例往返", () => {
  for (const name of ["role-go", "role-frontend", "role-testdev", "role-algo", "role-pm"]) {
    const r = parseImport("a.md", toMarkdown(load(name)));
    assert.ok(r.ok, name);
    assert.equal(r.message, "已从 Markdown 导入。", name);
  }
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateDocument, type RuyeDocument } from "../packages/schema/src/index.ts";
import {
  addItem,
  addModule,
  itemTitle,
  missingTypes,
  moveItem,
  moveModule,
  moveModuleTo,
  removeItem,
  removeModule,
  syncTitle,
  toggleModule,
  updateItem,
} from "../apps/web/src/doc-ops.ts";

const load = (name: string): RuyeDocument => JSON.parse(readFileSync(new URL(`../fixtures/${name}.ruye.json`, import.meta.url), "utf8"));

test("编辑操作不修改原文档，结果仍通过校验", () => {
  const doc = load("long");
  const before = JSON.stringify(doc);
  const proj = doc.modules.find((m) => m.type === "project")!;
  let d = moveModule(doc, proj.id, -1);
  d = toggleModule(d, proj.id);
  d = moveItem(d, proj.id, "proj-1", 1);
  d = updateItem(d, proj.id, "proj-2", { name: "改名后的项目" });
  const r = addItem(d, proj.id);
  d = removeItem(r.doc, proj.id, "proj-3");
  assert.equal(JSON.stringify(doc), before);
  assert.ok(validateDocument(d).ok);
  const p2 = d.modules.find((m) => m.id === proj.id)!;
  assert.equal(p2.visible, false);
  if (p2.type === "project") {
    assert.deepEqual(
      p2.data.items.map((i) => i.id),
      ["proj-2", "proj-1", "proj-4", r.itemId],
    );
    assert.equal(p2.data.items[0].name, "改名后的项目");
  }
});

test("拖拽排序、添加与删除模块", () => {
  const doc = load("short");
  const ids = doc.modules.map((m) => m.id);
  const d = moveModuleTo(doc, ids[ids.length - 1], ids[2]);
  assert.equal(d.modules[2].id, ids[ids.length - 1]);
  assert.ok(missingTypes(doc).includes("research"));
  const added = addModule(doc, "research");
  assert.equal(added.doc.modules.at(-1)!.type, "research");
  assert.ok(validateDocument(added.doc).ok);
  assert.ok(!missingTypes(added.doc).includes("research"));
  assert.equal(removeModule(added.doc, added.id).modules.length, doc.modules.length);
});

test("新增的空条目通过校验；条目标题有兜底", () => {
  const doc = load("short");
  for (const m of doc.modules) {
    if (!("items" in m.data)) continue;
    const r = addItem(doc, m.id);
    assert.ok(validateDocument(r.doc).ok, m.type);
  }
  assert.equal(itemTitle({ id: "x", name: "" }), "（未填写）");
});

test("标题随姓名与意向同步", () => {
  const doc = load("short");
  doc.meta.title = "旧标题";
  assert.equal(syncTitle(doc).meta.title, "林知夏-Java 后端实习生");
});

// 非法日期和损坏存档不得让姓名、学校消失，也不得被示例简历覆盖。
import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeDate, recoverDocument, validateDocument, type RuyeDocument } from "../packages/schema/src/index.ts";
import { deleteDocument, listDocuments, loadDocument, loadOutcome, newDocumentId, openSession, saveCurrent, saveStatusText } from "../apps/web/src/storage.ts";
import { duplicateDocument, setAlias } from "../apps/web/src/doc-ops.ts";

class MemoryStorage {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

const memory = new MemoryStorage();
Object.assign(globalThis, { localStorage: memory });

const sample = (): RuyeDocument => JSON.parse(readFileSync(new URL("../fixtures/short.ruye.json", import.meta.url), "utf8"));

function userDoc(end: string): RuyeDocument {
  const doc = sample();
  doc.meta.title = "我的简历-不要丢";
  const basic = doc.modules[0];
  if (basic.type === "basic_info") basic.data.name = "张三";
  const edu = doc.modules.find((m) => m.type === "education");
  if (edu && edu.type === "education") {
    edu.data.items[0].school = "用户自己的学校";
    edu.data.items[0].end = end;
  }
  return doc;
}

function schoolOf(doc: RuyeDocument): string {
  const edu = doc.modules.find((m) => m.type === "education");
  return edu && edu.type === "education" ? edu.data.items[0].school : "";
}

function nameOf(doc: RuyeDocument): string {
  const basic = doc.modules[0];
  return basic.type === "basic_info" ? basic.data.name : "";
}

beforeEach(() => memory.m.clear());

for (const end of ["2024年秋", "2024", "2024.13"]) {
  test(`非法结束日期「${end}」保存后再读，姓名和学校还在，且不会换成示例`, () => {
    const doc = userDoc(end);
    assert.equal(validateDocument(doc).ok, false);
    assert.equal(saveCurrent(doc), null);

    const loaded = loadOutcome();
    assert.equal(loaded.kind, "draft");
    if (loaded.kind !== "draft") return;
    assert.equal(nameOf(loaded.doc), "张三");
    assert.equal(schoolOf(loaded.doc), "用户自己的学校");
    assert.ok(loaded.issues.some((i) => i.path.endsWith(".end")));

    const session = openSession(loaded, sample());
    assert.equal(session.isSample, false);
    assert.equal(session.persist, true);
    assert.equal(nameOf(session.doc), "张三");
    assert.notEqual(schoolOf(session.doc), "示例理工大学");

    // 模拟刷新后 App 再次自动保存
    assert.equal(saveCurrent(session.doc, session.storageId ?? undefined), null);
    const again = loadOutcome();
    assert.equal(again.kind, "draft");
    if (again.kind !== "draft") return;
    assert.equal(nameOf(again.doc), "张三");
    assert.equal(schoolOf(again.doc), "用户自己的学校");
    assert.equal(localStorage.getItem("ruye:documents")!.includes("示例理工大学"), false);
    assert.equal(localStorage.getItem("ruye:documents")!.includes("林知夏"), false);
  });
}

test("磁盘上已有的坏档按原样读回，不因校验失败变成 null", () => {
  const doc = userDoc("明年");
  localStorage.setItem("ruye:documents", JSON.stringify([{ id: "doc-9", doc }]));
  localStorage.setItem("ruye:currentId", "doc-9");
  const loaded = loadOutcome();
  assert.equal(loaded.kind, "draft");
  if (loaded.kind !== "draft") return;
  assert.equal(loaded.id, "doc-9");
  assert.equal(nameOf(loaded.doc), "张三");
  assert.equal(schoolOf(loaded.doc), "用户自己的学校");
  const session = openSession(loaded, sample());
  assert.equal(session.storageId, "doc-9");
  assert.notEqual(nameOf(session.doc), "林知夏");
});

test("合法日期归一后仍能保存并读回", () => {
  assert.equal(normalizeDate("2024.09"), "2024-09");
  assert.equal(normalizeDate("2024年9月"), "2024-09");
  assert.equal(normalizeDate("至今"), "至今");
  for (const end of ["2024-09", "至今", normalizeDate("2024.09")]) {
    memory.m.clear();
    const doc = userDoc(end);
    assert.equal(validateDocument(doc).ok, true, end);
    assert.equal(saveCurrent(doc), null);
    const loaded = loadOutcome();
    assert.equal(loaded.kind, "draft");
    if (loaded.kind !== "draft") continue;
    assert.deepEqual(loaded.issues, []);
    assert.equal(nameOf(loaded.doc), "张三");
    assert.equal(schoolOf(loaded.doc), "用户自己的学校");
    const edu = loaded.doc.modules.find((m) => m.type === "education");
    if (edu && edu.type === "education") assert.equal(edu.data.items[0].end, end === "至今" ? "至今" : "2024-09");
  }
});

test("没有存档时才使用示例", () => {
  const session = openSession(loadOutcome(), sample());
  assert.equal(session.isSample, true);
  assert.equal(session.persist, true);
  assert.equal(nameOf(session.doc), "林知夏");
});

test("存档不是合法 JSON 时不覆盖，也不换成示例", () => {
  localStorage.setItem("ruye:documents", "{这不是json");
  const loaded = loadOutcome();
  assert.equal(loaded.kind, "unreadable");
  const session = openSession(loaded, sample());
  assert.equal(session.persist, false);
  assert.equal(session.isSample, false);
  assert.equal(nameOf(session.doc), "");
  assert.equal(session.doc.meta.title, "未命名简历");
  assert.equal(localStorage.getItem("ruye:documents"), "{这不是json");
  assert.ok(session.rawBackup?.includes("这不是json"));
});

test("条目列表缺失或姓名不是字符串时不进入编辑器，原始存档保持不动", () => {
  const brokenItems = userDoc("2028-06");
  const edu = brokenItems.modules.find((m) => m.type === "education");
  if (edu && edu.type === "education") (edu.data as { items: unknown }).items = null;
  const rawItems = JSON.stringify([{ id: "doc-1", doc: brokenItems }]);
  localStorage.setItem("ruye:documents", rawItems);
  localStorage.setItem("ruye:currentId", "doc-1");
  assert.equal(recoverDocument(brokenItems), null);
  const loadedItems = loadOutcome();
  assert.equal(loadedItems.kind, "unreadable");
  const sessionItems = openSession(loadedItems, sample());
  assert.equal(sessionItems.persist, false);
  assert.equal(sessionItems.isSample, false);
  assert.equal(nameOf(sessionItems.doc), "");
  assert.equal(localStorage.getItem("ruye:documents"), rawItems);
  assert.ok(saveCurrent(sample())?.includes("未写入"));
  assert.equal(localStorage.getItem("ruye:documents"), rawItems);

  memory.m.clear();
  const brokenName = userDoc("2028-06");
  const basic = brokenName.modules[0];
  if (basic.type === "basic_info") (basic.data as { name: unknown }).name = { family: "张" };
  const rawName = JSON.stringify([{ id: "doc-1", doc: brokenName }]);
  localStorage.setItem("ruye:documents", rawName);
  assert.equal(recoverDocument(brokenName), null);
  const loadedName = loadOutcome();
  assert.equal(loadedName.kind, "unreadable");
  assert.equal(openSession(loadedName, sample()).persist, false);
  assert.equal(localStorage.getItem("ruye:documents"), rawName);
  assert.ok(String(saveCurrent(sample()))?.includes("未写入"));
  assert.equal(localStorage.getItem("ruye:documents"), rawName);
});

test("保存读失败或现有存档损坏时不写盘；明确 replace 才覆盖", () => {
  localStorage.setItem("ruye:documents", "{坏档");
  const mergeErr = saveCurrent(userDoc("2024-09"));
  assert.ok(mergeErr?.includes("未写入"));
  assert.equal(localStorage.getItem("ruye:documents"), "{坏档");
  assert.equal(saveCurrent(userDoc("2024-09"), "doc-1", "replace"), null);
  assert.ok(localStorage.getItem("ruye:documents")!.includes("张三"));

  memory.m.clear();
  const kept = JSON.stringify([{ id: "doc-1", doc: userDoc("2024年秋") }]);
  memory.m.set("ruye:documents", kept);
  const originalGet = memory.getItem.bind(memory);
  memory.getItem = () => {
    throw new Error("QuotaExceededError");
  };
  const readErr = saveCurrent(userDoc("2024-09"));
  memory.getItem = originalGet;
  assert.ok(readErr?.includes("未写入"));
  assert.equal(memory.m.get("ruye:documents"), kept);

  const originalSet = memory.setItem.bind(memory);
  memory.setItem = (k: string) => {
    if (k === "ruye:documents") throw new Error("QuotaExceededError");
    originalSet(k, "x");
  };
  const writeErr = saveCurrent(userDoc("2024-09"), "doc-1", "replace");
  memory.setItem = originalSet;
  assert.ok(writeErr?.includes("未写入"));
  assert.equal(memory.m.get("ruye:documents"), kept);
});

test("保存失败时状态文案不说草稿已保留", () => {
  assert.equal(saveStatusText("failed", 2), "保存失败，未写入本机");
  assert.equal(saveStatusText("failed", 2).includes("已保留"), false);
  assert.equal(saveStatusText("blocked", 1), "未写入，以免覆盖无法读取的存档");
  assert.equal(saveStatusText("saved", 1), "草稿已保留（1 处格式需修正）");
  assert.equal(saveStatusText("saved", 0), "仅保存在此浏览器");
  assert.equal(saveStatusText("pending", 1), "正在写入本机…");
});

test("JSON 备份里的非法日期可以再导入，姓名和学校还在", () => {
  const doc = userDoc("2024年秋");
  const text = JSON.stringify(doc);
  const recovered = recoverDocument(JSON.parse(text));
  assert.ok(recovered);
  assert.equal(nameOf(recovered!.doc), "张三");
  assert.equal(schoolOf(recovered!.doc), "用户自己的学校");
  assert.ok(recovered!.issues.length > 0);
  assert.equal(recoverDocument("不是对象"), null);
  assert.equal(recoverDocument({ version: 1 }), null);
});

// ---------------------------------------------------------------- 多份简历

test("多份简历：各存各的，列表按最近使用排序，备注名优先显示", () => {
  const a = userDoc("2028-06");
  const b = setAlias(duplicateDocument(a), "投字节-后端");
  if (b.modules[0].type === "basic_info") b.modules[0].data.name = "张三（字节版）";
  assert.equal(saveCurrent(a, "doc-a"), null);
  assert.equal(saveCurrent(b, "doc-b"), null);
  const list = listDocuments();
  assert.deepEqual(list.map((d) => d.id), ["doc-b", "doc-a"]);
  assert.equal(list[0].label, "投字节-后端");
  assert.equal(list[1].label, "我的简历-不要丢");
  assert.equal(nameOf(loadDocument("doc-a")!.doc), "张三");
  assert.equal(nameOf(loadDocument("doc-b")!.doc), "张三（字节版）");
  // 再保存 a：a 排到最前，b 不受影响
  assert.equal(saveCurrent(a, "doc-a"), null);
  assert.deepEqual(listDocuments().map((d) => d.id), ["doc-a", "doc-b"]);
  assert.equal(nameOf(loadDocument("doc-b")!.doc), "张三（字节版）");
  // 下次打开编辑器时恢复最后保存的那份
  const opened = loadOutcome();
  assert.ok(opened.kind === "draft" && opened.id === "doc-a");
});

test("复制简历：内容相同、互相独立，备注名加「副本」", () => {
  const a = userDoc("2028-06");
  const b = duplicateDocument(a);
  assert.equal(b.meta.alias, "我的简历-不要丢 副本");
  if (b.modules[0].type === "basic_info") b.modules[0].data.name = "改过";
  assert.equal(nameOf(a), "张三");
  assert.ok(validateDocument(b).ok);
  assert.equal(setAlias(b, "  ").meta.alias, undefined);
});

test("删除一份：只删这一份；存档损坏时拒绝删除且不改动原始数据", () => {
  saveCurrent(userDoc("2028-06"), "doc-a");
  saveCurrent(setAlias(userDoc("2028-06"), "第二份"), "doc-b");
  assert.equal(deleteDocument("doc-a"), null);
  assert.deepEqual(listDocuments().map((d) => d.id), ["doc-b"]);
  assert.equal(loadDocument("doc-a"), null);

  memory.setItem("ruye:documents", "{坏掉的 JSON");
  assert.match(deleteDocument("doc-b") ?? "", /未写入/);
  assert.equal(memory.getItem("ruye:documents"), "{坏掉的 JSON");
  assert.deepEqual(listDocuments(), []);
});

test("列表跳过读不出的条目，但保存其他简历时不会把它们删掉", () => {
  memory.setItem("ruye:documents", JSON.stringify([{ id: "broken", doc: { 乱码: true } }]));
  saveCurrent(userDoc("2028-06"), "doc-a");
  assert.deepEqual(listDocuments().map((d) => d.id), ["doc-a"]);
  const raw = JSON.parse(memory.getItem("ruye:documents")!);
  assert.ok(raw.some((x: { id: string }) => x.id === "broken"), "读不出的条目必须原样保留");
});

test("新简历 id 不重复；备注名参与校验与草稿恢复", () => {
  const ids = new Set(Array.from({ length: 200 }, newDocumentId));
  assert.equal(ids.size, 200);
  const doc = userDoc("2028-06");
  (doc.meta as any).alias = 42;
  assert.equal(validateDocument(doc).ok, false);
  // 备注名坏了不连累正文：恢复时丢掉备注名，其余原样保留
  const rec = recoverDocument(doc);
  assert.ok(rec);
  assert.equal(rec.doc.meta.alias, undefined);
  assert.equal(nameOf(rec.doc), "张三");
});

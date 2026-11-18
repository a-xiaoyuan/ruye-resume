import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { strFromU8, unzipSync } from "../apps/web/node_modules/fflate/esm/browser.js";
import type { RuyeDocument } from "../packages/schema/src/index.ts";
import { exportDocx, importDocxBytes } from "../apps/web/src/docx.ts";
import { importFileBytes } from "../apps/web/src/import-file.ts";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

function sample(): RuyeDocument {
  const doc = JSON.parse(readFileSync(new URL("../fixtures/short.ruye.json", import.meta.url), "utf8")) as RuyeDocument;
  const basic = doc.modules.find((m) => m.type === "basic_info");
  if (basic && basic.type === "basic_info") basic.data.photoDataUrl = PNG;
  const project = doc.modules.find((m) => m.type === "project");
  if (project && project.type === "project") project.data.items[0].url = "https://example.com/demo";
  return doc;
}

test("Word 导出是可编辑的段落，再导入后中文姓名、要点、链接和照片还在", async () => {
  const doc = sample();
  const out = exportDocx(doc);
  const files = unzipSync(out.bytes);
  const xml = strFromU8(files["word/document.xml"]);
  assert.match(xml, /<w:t[^>]*>林知夏<\/w:t>/);
  assert.match(xml, /示例理工大学/);
  assert.match(xml, /<w:hyperlink /);
  assert.ok(files["word/media/photo.png"], "照片是独立图片部件，不是整页截图");
  assert.equal(Object.keys(files).some((k) => k.toLowerCase().includes("vba")), false);

  const back = await importDocxBytes(out.bytes);
  assert.equal(back.ok, true);
  if (!back.ok) return;
  const basic = back.doc.modules.find((m) => m.type === "basic_info");
  assert.ok(basic && basic.type === "basic_info");
  assert.equal(basic.data.name, "林知夏");
  assert.equal(basic.data.phone, "13800000000");
  assert.equal(basic.data.github, "https://github.com/example");
  assert.ok(basic.data.photoDataUrl?.startsWith("data:image/png;base64,"));
  const edu = back.doc.modules.find((m) => m.type === "education");
  assert.ok(edu && edu.type === "education");
  assert.equal(edu.data.items[0].school, "示例理工大学");
  assert.match(edu.data.items[0].highlights.join("\n"), /GPA 3\.7/);
  const project = back.doc.modules.find((m) => m.type === "project");
  assert.ok(project && project.type === "project");
  assert.equal(project.data.items[0].url, "https://example.com/demo");
  assert.match(out.notes.join(""), /颜色、分栏/);
});

test("损坏的 Word、旧版 doc、以及冒充文本的二进制都不会给出文档", async () => {
  const bad = await importDocxBytes(new Uint8Array([1, 2, 3, 4]));
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.match(bad.message, /没有被替换/);

  const legacy = await importFileBytes("resume.doc", "application/msword", new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]));
  assert.equal(legacy.ok, false);
  if (!legacy.ok) assert.match(legacy.message, /\.docx/);

  const disguised = await importFileBytes("notes.txt", "text/plain", new TextEncoder().encode("%PDF-1.4\nbinary"));
  assert.equal(disguised.ok, false);
  if (!disguised.ok) assert.match(disguised.message, /二进制/);
});

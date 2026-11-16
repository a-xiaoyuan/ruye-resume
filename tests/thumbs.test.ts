// 模板缩略图是用真实排版生成的静态图片。改了模板、色板、token 或完整示例后，
// 需要运行 `python3 scripts/thumbs.py` 重新生成，否则模板选择器里看到的和实际排出来的不一致。
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { TEMPLATE_IDS } from "../packages/schema/src/index.ts";

const root = new URL("../", import.meta.url);
const INPUTS = ["packages/templates/typst/common.typ", "packages/templates/src/index.ts", "fixtures/full.ruye.json"];

function digest(paths: string[]): string {
  const h = createHash("sha256");
  for (const p of paths) {
    // 统一换行符：Windows 上 Git 可能把 LF 转成 CRLF
    const bytes = Buffer.from(readFileSync(new URL(p, root)).toString("latin1").replace(/\r\n/g, "\n"), "latin1");
    h.update(p).update("\0").update(bytes).update("\0");
  }
  return h.digest("hex");
}

test("模板缩略图与模板源文件一致（不一致时运行 python3 scripts/thumbs.py）", () => {
  const manifest = JSON.parse(readFileSync(new URL("apps/web/src/assets/templates/manifest.json", root), "utf8")) as Record<string, string>;
  for (const id of TEMPLATE_IDS) {
    assert.equal(manifest[id], digest([...INPUTS, `packages/templates/typst/${id}.typ`]), `${id} 的缩略图已过期：请运行 python3 scripts/thumbs.py`);
  }
});

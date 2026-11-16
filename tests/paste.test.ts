import { test } from "node:test";
import assert from "node:assert/strict";
import { splitPastedLines } from "../apps/web/src/paste.ts";

test("粘贴多行：一行一条，去掉圆点和序号，保留数字开头的正文", () => {
  assert.deepEqual(splitPastedLines("• 负责 A\r\n\n- 主导 B\n1. 做了 C\n(2) D\n① E\n3.7/4.0 专业前 10%\n·F\n10、G"), [
    "负责 A",
    "主导 B",
    "做了 C",
    "D",
    "E",
    "3.7/4.0 专业前 10%",
    "F",
    "G",
  ]);
});

test("粘贴单行：原样返回一条", () => {
  assert.deepEqual(splitPastedLines("  只有一行  "), ["只有一行"]);
});

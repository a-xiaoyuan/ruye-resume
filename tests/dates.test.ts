import { test } from "node:test";
import assert from "node:assert/strict";
import { displayDate, endBeforeStart, formatYM, initialYear, parseYM } from "../apps/web/src/dates.ts";

test("日期解析与显示", () => {
  assert.deepEqual(parseYM("2024-09"), { y: 2024, m: 9 });
  assert.deepEqual(parseYM("2024-09-15"), { y: 2024, m: 9 });
  assert.equal(parseYM("至今"), null);
  assert.equal(parseYM("2024-13"), null);
  assert.equal(formatYM({ y: 2025, m: 3 }), "2025-03");
  assert.equal(displayDate("2024-09"), "2024 年 9 月");
  assert.equal(displayDate("2024-09-05"), "2024 年 9 月 5 日");
  assert.equal(displayDate("至今"), "至今");
  assert.equal(displayDate(""), "");
});

test("结束早于开始才提示；至今、空值不比较", () => {
  assert.equal(endBeforeStart("2024-09", "2024-06"), true);
  assert.equal(endBeforeStart("2024-09", "2024-09"), false);
  assert.equal(endBeforeStart("2024-09", "至今"), false);
  assert.equal(endBeforeStart("", "2024-01"), false);
});

test("打开时翻到的年份：自己的值 > 关联日期 > 当前年份", () => {
  const now = new Date(2026, 10, 16);
  assert.equal(initialYear("2023-02", "2025-01", "start", now), 2023);
  assert.equal(initialYear("", "2025-01", "end", now), 2025);
  assert.equal(initialYear("", "", "start", now), 2025);
  assert.equal(initialYear(undefined, undefined, "end", now), 2026);
});

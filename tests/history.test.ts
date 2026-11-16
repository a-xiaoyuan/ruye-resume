import { test } from "node:test";
import assert from "node:assert/strict";
import { expiredTrash, MAX_SNAPSHOTS, pruneSnapshots, shouldSnapshot, SNAPSHOT_GAP_MS } from "../apps/web/src/history.ts";

test("快照：第一次一定留；内容没变不留；连续修改间隔不够不留", () => {
  const now = 1_800_000_000_000;
  assert.equal(shouldSnapshot(undefined, "a", now), true);
  assert.equal(shouldSnapshot({ at: now - 2 * SNAPSHOT_GAP_MS, hash: "a" }, "a", now), false);
  assert.equal(shouldSnapshot({ at: now - 1000, hash: "a" }, "b", now), false);
  assert.equal(shouldSnapshot({ at: now - SNAPSHOT_GAP_MS, hash: "a" }, "b", now), true);
});

test("快照：超过上限删最旧的", () => {
  const list = Array.from({ length: MAX_SNAPSHOTS + 3 }, (_, i) => ({ at: i }));
  const { keep, drop } = pruneSnapshots(list);
  assert.equal(keep.length, MAX_SNAPSHOTS);
  assert.deepEqual(drop.map((x) => x.at), [2, 1, 0]);
  assert.equal(keep[0].at, MAX_SNAPSHOTS + 2);
});

test("回收站：超过 30 天的过期", () => {
  const now = 1_800_000_000_000;
  const day = 86400_000;
  const list = [{ deletedAt: now - 29 * day }, { deletedAt: now - 31 * day }];
  assert.deepEqual(expiredTrash(list, now), [list[1]]);
});

test("时间显示：刚刚、分钟、今天、昨天、今年、往年", async () => {
  const { formatWhen } = await import("../apps/web/src/history.ts");
  const now = new Date(2026, 10, 16, 15, 0).getTime();
  assert.equal(formatWhen(now - 10_000, now), "刚刚");
  assert.equal(formatWhen(now - 5 * 60_000, now), "5 分钟前");
  assert.equal(formatWhen(new Date(2026, 10, 16, 9, 5).getTime(), now), "今天 09:05");
  assert.equal(formatWhen(new Date(2026, 10, 15, 21, 30).getTime(), now), "昨天 21:30");
  assert.equal(formatWhen(new Date(2026, 2, 2, 8, 0).getTime(), now), "3 月 2 日 08:00");
  assert.equal(formatWhen(new Date(2025, 2, 2, 8, 0).getTime(), now), "2025 年 3 月 2 日");
});

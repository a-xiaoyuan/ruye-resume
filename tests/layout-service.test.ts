// 排版服务（Worker 和主线程退路共用）与调度器
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { RuyeDocument } from "../packages/schema/src/index.ts";
import { A4_HEIGHT_MM, countPdfPages, LayoutEngine } from "../packages/engine/src/index.ts";
import { loadNodeTemplates } from "../packages/templates/src/node.ts";
import { Scheduler, SUPERSEDED } from "../apps/web/src/scheduler.ts";
import { LayoutService } from "../apps/web/src/layout-service.ts";
import { loadNodeTypst } from "../scripts/typst-node.ts";

const load = (name: string): RuyeDocument => JSON.parse(readFileSync(new URL(`../fixtures/${name}.ruye.json`, import.meta.url), "utf8"));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("调度器：连续预览只排最新一版，排队中的旧预览作废", async () => {
  const s = new Scheduler();
  const ran: number[] = [];
  const job = (n: number) => async () => {
    ran.push(n);
    await sleep(20);
    return n;
  };
  const results = await Promise.all([1, 2, 3, 4].map((n) => s.schedulePreview(job(n))));
  // 1 已经开始跑，2、3 在排队时被 4 取代
  assert.deepEqual(results, [1, SUPERSEDED, SUPERSEDED, 4]);
  assert.deepEqual(ran, [1, 4]);
});

test("调度器：导出一定执行且优先于排队中的预览；同一时间只跑一个任务", async () => {
  const s = new Scheduler();
  const order: string[] = [];
  let running = 0;
  let maxRunning = 0;
  const job = (name: string) => async () => {
    running++;
    maxRunning = Math.max(maxRunning, running);
    order.push(name);
    await sleep(10);
    running--;
    return name;
  };
  const p1 = s.schedulePreview(job("预览1"));
  const p2 = s.schedulePreview(job("预览2"));
  const e1 = s.scheduleExport(job("导出1"));
  const e2 = s.scheduleExport(job("导出2"));
  assert.deepEqual(await Promise.all([p1, p2, e1, e2]), ["预览1", "预览2", "导出1", "导出2"]);
  assert.deepEqual(order, ["预览1", "导出1", "导出2", "预览2"]);
  assert.equal(maxRunning, 1);
});

test("调度器：任务出错只影响它自己", async () => {
  const s = new Scheduler();
  const bad = s.scheduleExport(async () => {
    throw new Error("坏了");
  });
  const good = s.scheduleExport(async () => "好的");
  await assert.rejects(bad, /坏了/);
  assert.equal(await good, "好的");
});

const loaded = await loadNodeTypst();
const skip = "skip" in loaded ? loaded.skip : false;

describe("排版服务（真实 Typst）", { skip }, () => {
  const service = () => {
    if (!("backend" in loaded)) throw new Error("unreachable");
    return new LayoutService(new LayoutEngine(loaded.backend), loadNodeTemplates());
  };

  test("预览：画板高度与模式一致", async () => {
    const svc = service();
    const fit = await svc.preview(load("short"), "fit-a4");
    assert.equal(fit.boardMm, A4_HEIGHT_MM);
    assert.ok(fit.svg.includes("typst-doc"));
    const std = await svc.preview(load("long"), "standard");
    assert.equal(std.boardMm, std.result.metrics.pageCount * A4_HEIGHT_MM);
    const over = await svc.preview(load("long"), "fit-a4");
    if (over.result.status === "overflow") assert.ok(over.boardMm > A4_HEIGHT_MM, "溢出时画板要画出页外部分");
  });

  test("导出：成功给出核对过页数的 PDF；装不下时不给文件", async () => {
    const svc = service();
    const ok = await svc.exportPdf(load("short"), "fit-a4");
    assert.equal(ok.kind, "pdf");
    if (ok.kind === "pdf") assert.equal(countPdfPages(ok.pdf), 1);
    const doc = load("long");
    const r = await svc.exportPdf(doc, "fit-a4");
    const preview = await svc.preview(doc, "fit-a4");
    assert.equal(r.kind === "overflow", preview.result.status === "overflow");
    const cont = await svc.exportPdf(doc, "continuous");
    assert.ok(cont.kind === "pdf" && cont.pageCount === 1);
  });
});

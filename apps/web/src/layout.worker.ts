/// <reference lib="webworker" />
// 排版 Worker：Typst 编译（包括 A4 智能一页的多次试排）都在这里跑，输入时主线程不卡。
import { loadRuntime } from "./runtime.ts";
import { LayoutService } from "./layout-service.ts";
import { Scheduler, SUPERSEDED } from "./scheduler.ts";
import type { FromWorker, ToWorker } from "./layout-protocol.ts";

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const scheduler = new Scheduler();
let service: Promise<LayoutService> | null = null;

const post = (msg: FromWorker, transfer: Transferable[] = []) => ctx.postMessage(msg, transfer);
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

ctx.onmessage = async (event: MessageEvent<ToWorker>) => {
  const msg = event.data;
  if (msg.type === "init") {
    service ??= loadRuntime(msg.base).then((rt) => {
      post({ type: "ready", charset: rt.charset });
      return new LayoutService(rt.engine, rt.templates);
    });
    service.catch((e) => post({ type: "init-error", message: message(e) }));
    return;
  }
  if (!service) return post({ type: "error", id: msg.id, message: "排版引擎还没有初始化" });

  try {
    const svc = await service;
    if (msg.type === "preview") {
      const data = await scheduler.schedulePreview(() => svc.preview(msg.doc, msg.mode));
      if (data === SUPERSEDED) post({ type: "superseded", id: msg.id });
      else post({ type: "preview", id: msg.id, data });
    } else {
      const outcome = await scheduler.scheduleExport(() => svc.exportPdf(msg.doc, msg.mode));
      // PDF 字节直接转移给主线程，不复制
      post({ type: "export", id: msg.id, outcome }, outcome.kind === "pdf" ? [outcome.pdf.buffer] : []);
    }
  } catch (e) {
    post({ type: "error", id: msg.id, message: message(e) });
  }
};

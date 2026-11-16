// 主线程这一侧的排版客户端。优先把排版放进 Web Worker；
// Worker 创建或初始化失败时，自动退回主线程（功能不变，只是长文档收紧时界面会短暂卡顿）。

import type { PageMode, RuyeDocument } from "../../../packages/schema/src/index.ts";
import type { ExportOutcome, PreviewData } from "./layout-service.ts";
import type { FromWorker, ToWorker } from "./layout-protocol.ts";
import { Scheduler, SUPERSEDED } from "./scheduler.ts";

export interface LayoutClient {
  /** 引擎就绪；charset 是字体子集包含的字符（空串表示完整字体，不做缺字检查） */
  ready: Promise<{ charset: string; inWorker: boolean }>;
  /** 返回 null 表示这次预览被更新的请求取代了，直接忽略即可 */
  preview(doc: RuyeDocument, mode: PageMode): Promise<PreviewData | null>;
  exportPdf(doc: RuyeDocument, mode: PageMode): Promise<ExportOutcome>;
}

function siteBase(): string {
  return new URL(import.meta.env.BASE_URL, document.baseURI).href;
}

/** 主线程退路：和 Worker 用同一套服务与调度 */
function createInlineClient(): LayoutClient {
  const scheduler = new Scheduler();
  const loaded = Promise.all([import("./runtime.ts"), import("./layout-service.ts")]).then(async ([rt, svc]) => {
    const runtime = await rt.loadRuntime(siteBase());
    return { runtime, service: new svc.LayoutService(runtime.engine, runtime.templates) };
  });
  return {
    ready: loaded.then(({ runtime }) => ({ charset: runtime.charset, inWorker: false })),
    async preview(doc, mode) {
      const { service } = await loaded;
      const r = await scheduler.schedulePreview(() => service.preview(doc, mode));
      return r === SUPERSEDED ? null : r;
    },
    async exportPdf(doc, mode) {
      const { service } = await loaded;
      return scheduler.scheduleExport(() => service.exportPdf(doc, mode));
    },
  };
}

function createWorkerClient(): { client: LayoutClient; failed: Promise<string> } {
  const worker = new Worker(new URL("./layout.worker.ts", import.meta.url), { type: "module", name: "ruye-layout" });
  let nextId = 1;
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  let readyResolve!: (v: { charset: string; inWorker: boolean }) => void;
  let failResolve!: (message: string) => void;
  const ready = new Promise<{ charset: string; inWorker: boolean }>((r) => (readyResolve = r));
  const failed = new Promise<string>((r) => (failResolve = r));

  const failAll = (message: string) => {
    failResolve(message);
    for (const p of pending.values()) p.reject(new Error(message));
    pending.clear();
  };

  worker.onmessage = (event: MessageEvent<FromWorker>) => {
    const msg = event.data;
    if (msg.type === "ready") return readyResolve({ charset: msg.charset, inWorker: true });
    if (msg.type === "init-error") return failAll(msg.message);
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    if (msg.type === "preview") p.resolve(msg.data);
    else if (msg.type === "superseded") p.resolve(null);
    else if (msg.type === "export") p.resolve(msg.outcome);
    else p.reject(new Error(msg.message));
  };
  worker.onerror = (e) => {
    e.preventDefault();
    failAll(e.message || "排版 Worker 启动失败");
  };

  const send = <R>(msg: Omit<Extract<ToWorker, { id: number }>, "id">): Promise<R> =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      worker.postMessage({ ...msg, id } as ToWorker);
    });

  worker.postMessage({ type: "init", base: siteBase() } satisfies ToWorker);
  return {
    client: {
      ready,
      preview: (doc, mode) => send<PreviewData | null>({ type: "preview", doc, mode }),
      exportPdf: (doc, mode) => send<ExportOutcome>({ type: "export", doc, mode }),
    },
    failed,
  };
}

/**
 * 创建排版客户端。Worker 在就绪前失败（浏览器不支持模块 Worker、加载出错等）时，
 * 无缝切到主线程实现；就绪之后的单次失败照常作为错误返回。
 */
export function createLayoutClient(): LayoutClient {
  if (typeof Worker === "undefined") return createInlineClient();
  let active: LayoutClient;
  let worker: ReturnType<typeof createWorkerClient>;
  try {
    worker = createWorkerClient();
  } catch {
    return createInlineClient();
  }
  active = worker.client;
  let switched = false;
  const fallback = worker.failed.then((reason) => {
    if (switched) return active;
    switched = true;
    console.warn(`[如页] 排版 Worker 不可用，改在主线程排版：${reason}`);
    active = createInlineClient();
    return active;
  });
  const ready = Promise.race([worker.client.ready, fallback.then((c) => c.ready)]).then((r) => {
    switched = true; // 已就绪：之后不再切换
    return r;
  });
  return {
    ready,
    preview: (doc, mode) => ready.then(() => active.preview(doc, mode)),
    exportPdf: (doc, mode) => ready.then(() => active.exportPdf(doc, mode)),
  };
}

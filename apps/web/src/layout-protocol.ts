// 主线程 ↔ 排版 Worker 的消息格式
import type { PageMode, RuyeDocument } from "../../../packages/schema/src/index.ts";
import type { ExportOutcome, PreviewData } from "./layout-service.ts";

export type ToWorker =
  | { type: "init"; base: string }
  | { type: "preview"; id: number; doc: RuyeDocument; mode: PageMode }
  | { type: "export"; id: number; doc: RuyeDocument; mode: PageMode };

export type FromWorker =
  | { type: "ready"; charset: string }
  | { type: "init-error"; message: string }
  | { type: "preview"; id: number; data: PreviewData }
  | { type: "superseded"; id: number }
  | { type: "export"; id: number; outcome: ExportOutcome }
  | { type: "error"; id: number; message: string };

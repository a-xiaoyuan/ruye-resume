// 排版任务调度：同一时间只跑一个任务（typst.ts 的影子文件系统是全局状态）。
// - 导出任务按顺序全部执行，优先于预览
// - 预览任务只保留最新的一个：连续打字时，排队中的旧预览直接作废（返回 SUPERSEDED），不排长队
// 不依赖浏览器，Worker 和主线程退路共用，也能在 Node 里测试。

export const SUPERSEDED = Symbol("superseded");
export type Superseded = typeof SUPERSEDED;

interface Job<R> {
  run: () => Promise<R>;
  resolve: (v: R | Superseded) => void;
  reject: (e: unknown) => void;
}

export class Scheduler {
  private running = false;
  private exports: Job<unknown>[] = [];
  private preview: Job<unknown> | null = null;

  /** 预览：若在排队期间来了更新的预览，本次返回 SUPERSEDED */
  schedulePreview<R>(run: () => Promise<R>): Promise<R | Superseded> {
    return new Promise((resolve, reject) => {
      this.preview?.resolve(SUPERSEDED);
      this.preview = { run, resolve: resolve as Job<unknown>["resolve"], reject };
      this.pump();
    });
  }

  /** 导出：一定会执行 */
  scheduleExport<R>(run: () => Promise<R>): Promise<R> {
    return new Promise((resolve, reject) => {
      this.exports.push({ run, resolve: resolve as Job<unknown>["resolve"], reject });
      this.pump();
    });
  }

  private async pump(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      for (;;) {
        const job = this.exports.shift() ?? this.takePreview();
        if (!job) break;
        try {
          job.resolve(await job.run());
        } catch (e) {
          job.reject(e);
        }
      }
    } finally {
      this.running = false;
    }
  }

  private takePreview(): Job<unknown> | null {
    const job = this.preview;
    this.preview = null;
    return job;
  }
}

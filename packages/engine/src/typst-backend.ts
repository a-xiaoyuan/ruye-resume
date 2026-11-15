// 基于 @myriaddreamin/typst.ts（v0.7，内置 Typst 0.14）的排版后端。
// 浏览器和 Node 共用：调用方负责提供 $typst 实例、wasm 和字体字节。
//
// 用到的 API（以 typst.ts 官方文档 / contrib/snippet.mts 为准）：
//   $typst.setCompilerInitOptions({ getModule })   $typst.setRendererInitOptions({ getModule })
//   $typst.use(TypstSnippet.disableDefaultFontAssets(), TypstSnippet.preloadFontData(bytes))
//   $typst.addSource(path, text)   $typst.mapShadow(path, bytes)   $typst.resetShadow()
//   $typst.svg({ mainFilePath })   $typst.pdf({ mainFilePath })

import type { RenderBackend, TypstInput } from "./types.ts";

/** $typst 实例里我们用到的那部分（结构化类型，避免直接依赖 typst.ts 的类型导出路径） */
export interface TypstSnippetLike {
  setCompilerInitOptions(o: { getModule: () => unknown }): void;
  setRendererInitOptions(o: { getModule: () => unknown }): void;
  use(...providers: unknown[]): void;
  addSource(path: string, content: string): unknown;
  mapShadow(path: string, content: Uint8Array): unknown;
  resetShadow(): unknown;
  svg(o: { mainFilePath: string; inputs?: Record<string, string> }): Promise<string>;
  pdf(o: { mainFilePath: string; inputs?: Record<string, string> }): Promise<Uint8Array | undefined>;
}

export interface TypstSnippetStatics {
  disableDefaultFontAssets(): unknown;
  preloadFontData(data: Uint8Array): unknown;
}

export interface TypstInitOptions {
  /** 编译器 wasm：URL 字符串（浏览器）或字节（Node） */
  compilerWasm: string | Uint8Array | ArrayBuffer;
  rendererWasm: string | Uint8Array | ArrayBuffer;
  /** 字体文件字节（OTF/TTF；Typst 不支持 woff2） */
  fonts: Uint8Array[];
}

/** 初始化 $typst：本地 wasm、本地字体、不从 CDN 拉默认字体（简历内容和字体请求都不出浏览器） */
export function initTypst(snippet: TypstSnippetLike, statics: TypstSnippetStatics, opts: TypstInitOptions): void {
  snippet.setCompilerInitOptions({ getModule: () => opts.compilerWasm });
  snippet.setRendererInitOptions({ getModule: () => opts.rendererWasm });
  snippet.use(statics.disableDefaultFontAssets(), ...opts.fonts.map((f) => statics.preloadFontData(f)));
}

export class TypstSnippetBackend implements RenderBackend {
  private snippet: TypstSnippetLike;
  // $typst 的影子文件系统是全局状态：所有编译串行执行，避免并发时互相覆盖输入文件
  private queue: Promise<unknown> = Promise.resolve();

  constructor(snippet: TypstSnippetLike) {
    this.snippet = snippet;
  }

  private run<T>(input: TypstInput, f: () => Promise<T>): Promise<T> {
    const job = this.queue.then(async () => {
      await this.snippet.resetShadow();
      for (const [path, content] of Object.entries(input.files)) {
        if (typeof content === "string") await this.snippet.addSource(path, content);
        else await this.snippet.mapShadow(path, content);
      }
      return f();
    });
    this.queue = job.catch(() => undefined);
    return job;
  }

  svg(input: TypstInput): Promise<string> {
    // 显式传 inputs: {}，避免沿用上一次编译的 sys.inputs
    return this.run(input, () => this.snippet.svg({ mainFilePath: input.main, inputs: {} }));
  }

  pdf(input: TypstInput): Promise<Uint8Array> {
    return this.run(input, async () => {
      const out = await this.snippet.pdf({ mainFilePath: input.main, inputs: {} });
      if (!out) throw new Error("Typst 没有返回 PDF（可能是编译错误）");
      return out;
    });
  }
}

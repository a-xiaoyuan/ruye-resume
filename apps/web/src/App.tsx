import { useEffect, useMemo, useRef, useState } from "react";
import {
  checkExportable,
  exportBaseName,
  fromMarkdown,
  toMarkdown,
  validateDocument,
  type PageMode,
  type RuyeDocument,
  type ValidationIssue,
} from "../../../packages/schema/src/index.ts";
import { A4_HEIGHT_MM, describeFit, findMissingChars, type FitResult, type PageHeight } from "../../../packages/engine/src/index.ts";
import { loadRuntime, type Runtime } from "./runtime.ts";
import { download, loadCurrent, saveCurrent } from "./storage.ts";
import shortSample from "../../../fixtures/short.ruye.json";
import mediumSample from "../../../fixtures/medium.ruye.json";
import longSample from "../../../fixtures/long.ruye.json";

const SAMPLES: Record<string, RuyeDocument> = {
  short: shortSample as RuyeDocument,
  medium: mediumSample as RuyeDocument,
  long: longSample as RuyeDocument,
};

const MODE_LABELS: Record<PageMode, string> = {
  standard: "标准分页",
  "fit-a4": "A4 智能一页",
  continuous: "无损长一页",
};

interface Preview {
  svg: string;
  result: FitResult;
  /** 预览画板的总高度（mm）：溢出时比 297 高，用来画出页外部分 */
  boardMm: number;
}

function setPageMode(md: string, mode: PageMode): string {
  if (/^pageMode:.*$/m.test(md)) return md.replace(/^pageMode:.*$/m, `pageMode: ${mode}`);
  if (md.startsWith("---\n")) return md.replace(/^---\n/, `---\npageMode: ${mode}\n`);
  return `---\npageMode: ${mode}\n---\n\n${md}`;
}

export function App() {
  const initial = useMemo(() => loadCurrent() ?? structuredClone(SAMPLES.short), []);
  const [md, setMd] = useState(() => toMarkdown(initial));
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [overflowDialog, setOverflowDialog] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => {
    const { doc, warnings } = fromMarkdown(md);
    const v = validateDocument(doc);
    return { doc, warnings, issues: v.ok ? ([] as ValidationIssue[]) : v.issues };
  }, [md]);
  const doc = parsed.doc;
  const mode = doc.layout.pageMode;

  useEffect(() => {
    loadRuntime().then(setRuntime, (e: Error) => setFatal(e.message));
  }, []);

  // 本地自动保存
  useEffect(() => {
    if (parsed.issues.length > 0) return;
    const err = saveCurrent(doc);
    if (err) setNotice(err);
  }, [doc, parsed.issues.length]);

  // 300ms 防抖后重新排版。预览和导出用同一个引擎、同一套 token 与页高
  useEffect(() => {
    if (!runtime || parsed.issues.length > 0) return;
    const template = runtime.templates.get(doc.layout.templateId) ?? runtime.templates.get("campus-serif")!;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const result = await runtime.engine.layout(doc, template, mode);
        // 溢出时按内容实际高度渲染，让用户看见页外的部分，而不是假装没有
        const showAuto = result.status === "overflow";
        const height: PageHeight = showAuto ? "auto" : result.pageHeight;
        const svg = await runtime.engine.svg(doc, template, result.tokens, height);
        const boardMm =
          result.status === "paginated" ? result.metrics.pageCount * A4_HEIGHT_MM : showAuto ? result.metrics.contentHeightMm : result.metrics.pageHeightMm;
        if (!cancelled) setPreview({ svg, result, boardMm });
      } catch (e) {
        if (!cancelled) setNotice(`排版失败：${(e as Error).message}`);
      } finally {
        if (!cancelled) setBusy(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [runtime, doc, mode, parsed.issues.length]);

  async function exportPdf(as: PageMode = mode) {
    setOverflowDialog(false);
    if (!runtime) return;
    const ok = checkExportable(doc);
    if (!ok.ok) return setNotice(ok.message);
    const missing = findMissingChars(doc, runtime.charset);
    if (missing.length > 0) {
      return setNotice(`内置字体缺少这些字：${missing.slice(0, 20).join(" ")}。导出后会显示为方块，请改字或使用完整字体（见 docs/fonts.md）。`);
    }
    const template = runtime.templates.get(doc.layout.templateId) ?? runtime.templates.get("campus-serif")!;
    setBusy(true);
    try {
      const r = await runtime.engine.layout(doc, template, as);
      if (r.status === "overflow") return setOverflowDialog(true);
      if (r.status === "too-long") return setNotice(r.suggestions?.[0] ?? "内容过长");
      const pdf = await runtime.engine.pdf(doc, template, r.tokens, r.pageHeight);
      download(`${exportBaseName(doc)}.pdf`, pdf, "application/pdf");
      if (as === "continuous") setNotice("无损长一页适合屏幕投递；若需要打印在 A4 纸上，请改用标准分页或 A4 智能一页。");
    } catch (e) {
      setNotice(`导出失败：${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function importFile(file: File) {
    const text = await file.text();
    if (file.name.endsWith(".json")) {
      try {
        const v = validateDocument(JSON.parse(text));
        if (!v.ok) return setNotice(`导入失败：${v.issues.slice(0, 3).map((i) => `${i.path} ${i.message}`).join("；")}`);
        setMd(toMarkdown(v.doc));
      } catch (e) {
        setNotice(`导入失败：不是合法的 JSON（${(e as Error).message}）`);
      }
    } else {
      setMd(text);
    }
  }

  const status = preview && describeFit(preview.result);
  const r = preview?.result;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          如页 <span>Ruye</span>
        </div>
        <label className="field">
          模板
          <select value="campus-serif" disabled title="社招单栏、双栏紧凑模板在下一阶段加入">
            <option value="campus-serif">校招单栏</option>
          </select>
        </label>
        <div className="modes" role="radiogroup" aria-label="页面模式">
          {(Object.keys(MODE_LABELS) as PageMode[]).map((m) => (
            <button key={m} role="radio" aria-checked={mode === m} className={mode === m ? "on" : ""} onClick={() => setMd(setPageMode(md, m))}>
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
        <div className={`status ${status?.level ?? ""}`} aria-live="polite">
          {fatal ? "排版引擎加载失败" : !runtime ? "正在加载排版引擎…" : busy ? "排版中…" : status?.text}
        </div>
        <div className="actions">
          <select
            aria-label="载入示例"
            value=""
            onChange={(e) => {
              const s = SAMPLES[e.target.value];
              if (s && confirm("载入示例会替换当前内容（可先导出备份）。继续？")) setMd(toMarkdown(s));
            }}
          >
            <option value="">载入示例…</option>
            <option value="short">短样本</option>
            <option value="medium">中等样本</option>
            <option value="long">长样本</option>
          </select>
          <button onClick={() => fileInput.current?.click()}>导入</button>
          <input ref={fileInput} type="file" accept=".json,.md,.txt" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
          <button onClick={() => download(`${exportBaseName(doc)}.ruye.json`, JSON.stringify(doc, null, 2), "application/json")}>导出 JSON</button>
          <button onClick={() => download(`${exportBaseName(doc)}.md`, md, "text/markdown")}>导出 Markdown</button>
          <button className="primary" disabled={!runtime || busy || parsed.issues.length > 0} onClick={() => exportPdf()}>
            下载 PDF
          </button>
        </div>
      </header>

      {notice && (
        <div className="notice" role="alert">
          {notice}
          <button aria-label="关闭提示" onClick={() => setNotice(null)}>
            ×
          </button>
        </div>
      )}

      <main className="panes">
        <section className="editor" aria-label="简历内容（Markdown）">
          <div className="pane-title">内容（Markdown）</div>
          <textarea value={md} onChange={(e) => setMd(e.target.value)} spellCheck={false} />
          {(parsed.warnings.length > 0 || parsed.issues.length > 0) && (
            <ul className="problems">
              {parsed.issues.map((i) => (
                <li key={i.path + i.message} className="error">
                  {i.path}：{i.message}
                </li>
              ))}
              {parsed.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="preview" aria-label="A4 预览">
          {fatal && <div className="fatal">{fatal}</div>}
          {preview && r && (
            <>
              {r.status === "overflow" && r.suggestions && (
                <div className="report">
                  <strong>当前内容无法在可读性底线内放入一页 A4。</strong>你可以：精简标出的模块、改用无损长一页，或改为标准分页。
                  <ul>
                    {r.suggestions.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="board" style={{ aspectRatio: `210 / ${preview.boardMm}` }}>
                <div className="svg" dangerouslySetInnerHTML={{ __html: preview.svg }} />
                {r.status === "overflow" && (
                  <div className="overflow-zone" style={{ top: `${(A4_HEIGHT_MM / preview.boardMm) * 100}%` }}>
                    <span>A4 底边 · 以下超出约 {Math.round(r.metrics.overflowMm)}mm</span>
                  </div>
                )}
                {r.status === "paginated" &&
                  Array.from({ length: r.metrics.pageCount }, (_, i) => (
                    <div key={i} className="page-break" style={{ top: `${((i + 1) * A4_HEIGHT_MM * 100) / preview.boardMm}%` }}>
                      <span>
                        {i + 1} / {r.metrics.pageCount}
                      </span>
                    </div>
                  ))}
              </div>
              {r.status === "continuous" && <div className="caption">长画板，总高度约 {(r.metrics.pageHeightMm / A4_HEIGHT_MM).toFixed(2)} 页 A4（不是标准打印纸）</div>}
            </>
          )}
        </section>
      </main>

      {overflowDialog && (
        <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="ovf-title">
          <div className="dialog">
            <h2 id="ovf-title">装不进一页 A4</h2>
            <p>当前内容无法在可读性底线内放入一页 A4，所以不会导出一份「号称一页」却溢出的文件。你可以：</p>
            <div className="dialog-actions">
              <button className="primary" onClick={() => exportPdf("continuous")}>
                改为无损长一页导出
              </button>
              <button onClick={() => exportPdf("standard")}>改为标准分页导出</button>
              <button onClick={() => setOverflowDialog(false)}>回去精简内容</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import {
  checkExportable,
  createEmptyDocument,
  exportBaseName,
  fromMarkdown,
  MODULE_LABELS,
  THEMES,
  THEME_IDS,
  toMarkdown,
  validateDocument,
  type ModuleType,
  type PageMode,
  type RuyeDocument,
  type TemplateId,
} from "../../../packages/schema/src/index.ts";
import { A4_HEIGHT_MM, describeFit, findMissingChars, type PageHeight } from "../../../packages/engine/src/index.ts";
import { sortByRecommended, TEMPLATE_META } from "../../../packages/templates/src/index.ts";
import { loadRuntime, type Runtime } from "./runtime.ts";
import { download, loadCurrent, saveCurrent } from "./storage.ts";
import { addModule, removeModule, syncTitle } from "./doc-ops.ts";
import { ModuleNav } from "./components/ModuleNav.tsx";
import { ModuleEditor } from "./components/ModuleEditor.tsx";
import { Preview, type PreviewData } from "./components/Preview.tsx";
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

interface Notice {
  text: string;
  level?: "info" | "error";
  /** 删除类操作的撤销点 */
  undo?: RuyeDocument;
}

export function App() {
  const stored = useMemo(() => loadCurrent(), []);
  const [doc, setDoc] = useState<RuyeDocument>(() => stored ?? structuredClone(SAMPLES.short));
  const [isSample, setIsSample] = useState(!stored);
  const [activeId, setActiveId] = useState<string | null>(() => (stored ?? SAMPLES.short).modules[0]?.id ?? null);
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [overflowDialog, setOverflowDialog] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const issues = useMemo(() => {
    const v = validateDocument(doc);
    return v.ok ? [] : v.issues;
  }, [doc]);
  const mode = doc.layout.pageMode;
  const active = doc.modules.find((m) => m.id === activeId) ?? null;

  const update = (next: RuyeDocument) => setDoc(syncTitle(next));
  const remove = (next: RuyeDocument, what: string) => {
    setNotice({ text: `已删除${what}。`, undo: doc });
    update(next);
  };
  const replaceAll = (next: RuyeDocument) => {
    setDoc(next);
    setActiveId(next.modules[0]?.id ?? null);
    setIsSample(false);
  };

  useEffect(() => {
    loadRuntime().then(setRuntime, (e: Error) => setFatal(e.message));
  }, []);

  // 本地自动保存
  useEffect(() => {
    const err = saveCurrent(doc);
    if (err) setNotice({ text: err, level: "error" });
  }, [doc]);

  // 300ms 防抖后重新排版。预览和导出用同一个引擎、同一套 token 与页高
  useEffect(() => {
    if (!runtime) return;
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
        if (!cancelled) setNotice({ text: `排版失败：${(e as Error).message}`, level: "error" });
      } finally {
        if (!cancelled) setBusy(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [runtime, doc, mode]);

  async function exportPdf(as: PageMode = mode) {
    setOverflowDialog(false);
    if (!runtime) return;
    const ok = checkExportable(doc);
    if (!ok.ok) return setNotice({ text: ok.message, level: "error" });
    const missing = findMissingChars(doc, runtime.charset);
    if (missing.length > 0) {
      return setNotice({ text: `内置字体缺少这些字：${missing.slice(0, 20).join(" ")}。导出后会显示为方块，请改字或使用完整字体（见 docs/fonts.md）。`, level: "error" });
    }
    const template = runtime.templates.get(doc.layout.templateId) ?? runtime.templates.get("campus-serif")!;
    setBusy(true);
    try {
      const r = await runtime.engine.layout(doc, template, as);
      if (r.status === "overflow") return setOverflowDialog(true);
      if (r.status === "too-long") return setNotice({ text: r.suggestions?.[0] ?? "内容过长", level: "error" });
      const pdf = await runtime.engine.pdf(doc, template, r.tokens, r.pageHeight);
      download(`${exportBaseName(doc)}.pdf`, pdf as Uint8Array<ArrayBuffer>, "application/pdf");
      if (as === "continuous") setNotice({ text: "无损长一页适合屏幕投递；若需要打印在 A4 纸上，请改用标准分页或 A4 智能一页。" });
    } catch (e) {
      setNotice({ text: `导出失败：${(e as Error).message}`, level: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function importFile(file: File) {
    const text = await file.text();
    if (file.name.endsWith(".json")) {
      try {
        const v = validateDocument(JSON.parse(text));
        if (!v.ok) return setNotice({ text: `导入失败：${v.issues.slice(0, 3).map((i) => `${i.path} ${i.message}`).join("；")}`, level: "error" });
        replaceAll(v.doc);
        setNotice({ text: `已导入「${v.doc.meta.title}」。` });
      } catch (e) {
        setNotice({ text: `导入失败：不是合法的 JSON（${(e as Error).message}）`, level: "error" });
      }
    } else {
      const { doc: parsed, warnings } = fromMarkdown(text);
      const v = validateDocument(parsed);
      if (!v.ok) return setNotice({ text: `导入失败：${v.issues.slice(0, 3).map((i) => `${i.path} ${i.message}`).join("；")}`, level: "error" });
      replaceAll(parsed);
      setNotice({ text: warnings.length ? `已导入，但有 ${warnings.length} 处没能识别：${warnings.slice(0, 3).join("；")}` : "已从 Markdown 导入。" });
    }
  }

  function addNewModule(type: ModuleType) {
    const r = addModule(doc, type);
    update(r.doc);
    setActiveId(r.id);
  }

  const status = preview && describeFit(preview.result);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          如页 <span>Ruye</span>
        </div>
        <label className="field">
          模板
          <select value={doc.layout.templateId} onChange={(e) => update({ ...doc, layout: { ...doc.layout, templateId: e.target.value as TemplateId } })}>
            {TEMPLATE_META.map((t) => (
              <option key={t.id} value={t.id} title={t.description}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <div className="swatches" role="radiogroup" aria-label="主题色">
          {THEME_IDS.map((id) => (
            <button
              key={id}
              role="radio"
              aria-checked={(doc.layout.theme ?? "ink") === id}
              aria-label={THEMES[id].label}
              title={THEMES[id].label}
              style={{ background: THEMES[id].accent }}
              onClick={() => update({ ...doc, layout: { ...doc.layout, theme: id } })}
            />
          ))}
        </div>
        <div className="modes" role="radiogroup" aria-label="页面模式">
          {(Object.keys(MODE_LABELS) as PageMode[]).map((m) => (
            <button key={m} role="radio" aria-checked={mode === m} className={mode === m ? "on" : ""} onClick={() => update({ ...doc, layout: { ...doc.layout, pageMode: m } })}>
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
        <div className={`status ${status?.level ?? ""}`} aria-live="polite">
          {fatal ? "排版引擎加载失败" : !runtime ? "正在加载排版引擎…" : busy && !preview ? "排版中…" : status?.text}
        </div>
        <div className="actions">
          <select
            aria-label="文件"
            value=""
            onChange={(e) => {
              const v = e.target.value;
              e.target.value = "";
              if (v === "import") fileInput.current?.click();
              else if (v === "json") download(`${exportBaseName(doc)}.ruye.json`, JSON.stringify(doc, null, 2), "application/json");
              else if (v === "md") download(`${exportBaseName(doc)}.md`, toMarkdown(doc), "text/markdown");
              else if (v === "new" && confirm("新建空白简历会替换当前内容（可先导出备份）。继续？")) replaceAll(createEmptyDocument());
              else if (v.startsWith("sample:") && confirm("载入示例会替换当前内容（可先导出备份）。继续？")) {
                replaceAll(structuredClone(SAMPLES[v.slice(7)]));
                setIsSample(true);
              }
            }}
          >
            <option value="">文件…</option>
            <option value="import">导入 .ruye.json / .md</option>
            <option value="json">导出 .ruye.json</option>
            <option value="md">导出 Markdown</option>
            <option value="new">新建空白简历</option>
            <option value="sample:short">载入示例：短</option>
            <option value="sample:medium">载入示例：中</option>
            <option value="sample:long">载入示例：长</option>
          </select>
          <input ref={fileInput} type="file" accept=".json,.md,.txt" hidden onChange={(e) => (e.target.files?.[0] && importFile(e.target.files[0]), (e.target.value = ""))} />
          <button className="primary" disabled={!runtime || busy} onClick={() => exportPdf()}>
            下载 PDF
          </button>
        </div>
      </header>

      {isSample && (
        <div className="notice info">
          这是虚构的示例简历，请替换成你自己的内容。
          <span className="notice-actions">
            <button onClick={() => replaceAll(createEmptyDocument())}>从空白开始</button>
            <button onClick={() => fileInput.current?.click()}>导入文件</button>
            <button aria-label="关闭提示" onClick={() => setIsSample(false)}>
              ×
            </button>
          </span>
        </div>
      )}
      {notice && (
        <div className={`notice ${notice.level ?? "info"}`} role={notice.level === "error" ? "alert" : "status"}>
          {notice.text}
          <span className="notice-actions">
            {notice.undo && (
              <button
                onClick={() => {
                  setDoc(notice.undo!);
                  setNotice(null);
                }}
              >
                撤销
              </button>
            )}
            <button aria-label="关闭提示" onClick={() => setNotice(null)}>
              ×
            </button>
          </span>
        </div>
      )}

      <main className="panes">
        <ModuleNav
          doc={doc}
          activeId={activeId}
          onSelect={setActiveId}
          onChange={update}
          onAdd={addNewModule}
          onSortRecommended={() => update(sortByRecommended(doc, doc.layout.templateId))}
        />

        <section className="editor" aria-label="编辑">
          {active ? (
            <ModuleEditor
              doc={doc}
              module={active}
              onChange={update}
              onRemove={remove}
              onError={(text) => setNotice({ text, level: "error" })}
              onRemoveModule={() => {
                remove(removeModule(doc, active.id), `模块「${MODULE_LABELS[active.type]}」`);
                setActiveId(doc.modules.find((m) => m.id !== active.id)?.id ?? null);
              }}
            />
          ) : (
            <div className="empty">从左侧选择一个模块开始编辑。</div>
          )}
          {issues.length > 0 && (
            <ul className="problems" aria-label="需要修正的内容">
              {issues.slice(0, 6).map((i) => (
                <li key={i.path + i.message}>
                  {i.path}：{i.message}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="preview" aria-label="A4 预览">
          <Preview data={preview} error={fatal} />
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

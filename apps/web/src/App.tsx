import { useEffect, useMemo, useRef, useState } from "react";
import {
  checkExportable,
  createEmptyDocument,
  exportBaseName,
  fromMarkdown,
  MODULE_LABELS,
  toMarkdown,
  validateDocument,
  type ModuleType,
  type PageMode,
  type RuyeDocument,
} from "../../../packages/schema/src/index.ts";
import { A4_HEIGHT_MM, findMissingChars, type PageHeight } from "../../../packages/engine/src/index.ts";
import { sortByRecommended } from "../../../packages/templates/src/index.ts";
import { loadRuntime, type Runtime } from "./runtime.ts";
import { download, loadCurrent, saveCurrent } from "./storage.ts";
import { addModule, removeModule, syncTitle } from "./doc-ops.ts";
import { ModuleNav } from "./components/ModuleNav.tsx";
import { ModuleEditor } from "./components/ModuleEditor.tsx";
import { Preview, type PreviewData } from "./components/Preview.tsx";
import { StylePanel } from "./components/StylePanel.tsx";
import shortSample from "../../../fixtures/short.ruye.json";
import mediumSample from "../../../fixtures/medium.ruye.json";
import longSample from "../../../fixtures/long.ruye.json";

const SAMPLES: Record<string, RuyeDocument> = {
  short: shortSample as RuyeDocument,
  medium: mediumSample as RuyeDocument,
  long: longSample as RuyeDocument,
};

interface Notice {
  text: string;
  level?: "info" | "error";
  /** 删除类操作的撤销点 */
  undo?: RuyeDocument;
}

interface MenuItem {
  key: string;
  label: string;
  hint?: string;
}

function Logo() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="5" y="3" width="22" height="26" rx="4" fill="#3b5bdb" />
      <path d="M19 3h8v8z" fill="#93a5f2" />
      <rect x="10" y="12" width="12" height="2" rx="1" fill="#fff" />
      <rect x="10" y="17" width="9" height="2" rx="1" fill="#fff" opacity=".8" />
      <rect x="10" y="22" width="11" height="2" rx="1" fill="#fff" opacity=".55" />
    </svg>
  );
}

function Menu({ label, items, onPick, right }: { label: string; items: MenuItem[]; onPick: (key: string) => void; right?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div className="menu" ref={ref}>
      <button type="button" className="menu-trigger" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((v) => !v)}>
        {label}
        <span className="caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <div className={`menu-list${right ? " right" : ""}`} role="menu">
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onPick(it.key);
              }}
            >
              <span>{it.label}</span>
              {it.hint && <em>{it.hint}</em>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
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
  const [zoom, setZoom] = useState(1);
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

  // 提示自动消退：示例引导 9 秒，普通通知 6 秒；错误与可撤销通知常驻，由用户关闭
  useEffect(() => {
    if (!isSample) return;
    const t = setTimeout(() => setIsSample(false), 9000);
    return () => clearTimeout(t);
  }, [isSample]);
  useEffect(() => {
    if (!notice || notice.level === "error" || notice.undo) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

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

  function onFileMenu(key: string) {
    if (key === "import") fileInput.current?.click();
    else if (key === "new" && confirm("新建空白简历会替换当前内容（可先导出备份）。继续？")) replaceAll(createEmptyDocument());
    else if (key.startsWith("sample:") && confirm("载入示例会替换当前内容（可先导出备份）。继续？")) {
      replaceAll(structuredClone(SAMPLES[key.slice(7)]));
      setIsSample(true);
    }
  }

  function onExportMenu(key: string) {
    if (key === "json") download(`${exportBaseName(doc)}.ruye.json`, JSON.stringify(doc, null, 2), "application/json");
    else if (key === "md") download(`${exportBaseName(doc)}.md`, toMarkdown(doc), "text/markdown");
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Logo />
          <span className="brand-name">
            如页<em>Ruye</em>
          </span>
          <span className="version">v0.1</span>
        </div>

        <div className="doc-meta" title="标题由姓名与求职意向自动生成">
          <span className="doc-title">{doc.meta.title}</span>
          <span className="save-state">
            <i aria-hidden="true" />
            仅保存在此浏览器
          </span>
        </div>

        <div className="actions">
          <Menu
            label="文件"
            onPick={onFileMenu}
            items={[
              { key: "import", label: "导入简历", hint: ".ruye.json / .md" },
              { key: "new", label: "新建空白简历" },
              { key: "sample:short", label: "载入示例", hint: "短" },
              { key: "sample:medium", label: "载入示例", hint: "中" },
              { key: "sample:long", label: "载入示例", hint: "长" },
            ]}
          />
          <Menu
            label="导出"
            onPick={onExportMenu}
            items={[
              { key: "json", label: "导出 .ruye.json", hint: "可再次导入" },
              { key: "md", label: "导出 Markdown", hint: "可版本管理" },
            ]}
          />
          <input ref={fileInput} type="file" accept=".json,.md,.txt" hidden onChange={(e) => (e.target.files?.[0] && importFile(e.target.files[0]), (e.target.value = ""))} />
          <button className="primary" disabled={!runtime || busy} onClick={() => exportPdf()}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 2v8m0 0L5 7m3 3 3-3M3 12.5h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            下载 PDF
          </button>
        </div>
      </header>

      <div className="toasts">
        {isSample && (
          <div className="toast info">
            <span>这是虚构的示例简历，换成你自己的内容就能直接导出。</span>
            <span className="toast-actions">
              <button onClick={() => replaceAll(createEmptyDocument())}>从空白开始</button>
              <button onClick={() => fileInput.current?.click()}>导入文件</button>
              <button aria-label="关闭提示" onClick={() => setIsSample(false)}>
                ×
              </button>
            </span>
          </div>
        )}
        {notice && (
          <div className={`toast ${notice.level ?? "info"}`} role={notice.level === "error" ? "alert" : "status"}>
            <span>{notice.text}</span>
            <span className="toast-actions">
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
      </div>

      <main className="panes">
        <aside className="sidebar">
          <StylePanel doc={doc} onChange={update} />
          <ModuleNav
            doc={doc}
            activeId={activeId}
            onSelect={setActiveId}
            onChange={update}
            onAdd={addNewModule}
            onSortRecommended={() => update(sortByRecommended(doc, doc.layout.templateId))}
          />
        </aside>

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
            <div className="empty">
              <div className="empty-icon" aria-hidden="true">
                ✎
              </div>
              <p>从左侧挑一个模块开始写。</p>
              <span>模块可拖拽排序，开关控制是否出现在简历里。</span>
            </div>
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
          <Preview data={preview} error={fatal} busy={busy} zoom={zoom} onZoom={setZoom} />
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

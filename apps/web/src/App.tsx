import { useEffect, useMemo, useRef, useState } from "react";
import {
  checkExportable,
  createEmptyDocument,
  exportBaseName,
  fromMarkdown,
  MODULE_LABELS,
  recoverDocument,
  toMarkdown,
  validateDocument,
  type ModuleType,
  type PageMode,
  type RuyeDocument,
} from "../../../packages/schema/src/index.ts";
import { findMissingChars } from "../../../packages/engine/src/index.ts";
import { sortByRecommended } from "../../../packages/templates/src/index.ts";
import { createLayoutClient } from "./layout-client.ts";
import { deleteDocument, download, listDocuments, loadDocument, loadOutcome, newDocumentId, openSession, saveCurrent, saveStatusText, setCurrentId, type SaveMode, putDocument } from "./storage.ts";
import { DocSwitcher } from "./components/DocSwitcher.tsx";
import { addModule, duplicateDocument, removeModule, setAlias, syncTitle } from "./doc-ops.ts";
import { ModuleNav } from "./components/ModuleNav.tsx";
import { ModuleEditor } from "./components/ModuleEditor.tsx";
import { Preview, type PreviewData } from "./components/Preview.tsx";
import { StylePanel, StyleSummary } from "./components/StylePanel.tsx";
import { Icon } from "./components/icons.tsx";
import { AccountMenu, useCloudSync } from "./components/AccountMenu.tsx";
import fullSample from "../../../fixtures/full.ruye.json";
import shortSample from "../../../fixtures/short.ruye.json";
import mediumSample from "../../../fixtures/medium.ruye.json";
import longSample from "../../../fixtures/long.ruye.json";

const SAMPLES: Record<string, RuyeDocument> = {
  full: fullSample as RuyeDocument,
  short: shortSample as RuyeDocument,
  medium: mediumSample as RuyeDocument,
  long: longSample as RuyeDocument,
};

interface Notice {
  text: string;
  level?: "info" | "error";
  /** 删除类操作的撤销点 */
  undo?: RuyeDocument;
  /** 不自动消失：恢复说明和存档损坏必须留在屏幕上 */
  sticky?: boolean;
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
  const opened = useMemo(() => openSession(loadOutcome(), structuredClone(SAMPLES.full)), []);
  const [doc, setDoc] = useState<RuyeDocument>(opened.doc);
  const [sideTab, setSideTab] = useState<"content" | "style">("content");
  const [isSample, setIsSample] = useState(opened.isSample);
  const [persist, setPersist] = useState(opened.persist);
  const [writeMode, setWriteMode] = useState<SaveMode>("merge");
  const [savePhase, setSavePhase] = useState<"blocked" | "pending" | "saved" | "failed">(opened.persist ? "pending" : "blocked");
  // 当前简历的存档 id。切换、新建、复制时改变
  const [docId, setDocId] = useState<string>(() => opened.storageId ?? newDocumentId());
  // 首次打开时自动载入、还没被改过的示例：新建或导入时直接复用它的存档位置，免得列表里堆示例
  const pristineSample = useRef<string | null>(opened.isSample ? docId : null);
  const [rawBackup, setRawBackup] = useState<string | null>(opened.rawBackup);
  const [activeId, setActiveId] = useState<string | null>(() => opened.doc.modules[0]?.id ?? null);
  // 排版在 Web Worker 里跑（不支持时自动退回主线程）；ready 之后才有字符表
  const layout = useMemo(() => createLayoutClient(), []);
  const [engineReady, setEngineReady] = useState<{ charset: string } | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(opened.notice ? { text: opened.notice, level: "error", sticky: true } : null);
  const [overflowDialog, setOverflowDialog] = useState(false);
  const [zoom, setZoom] = useState(1);
  const fileInput = useRef<HTMLInputElement>(null);

  const issues = useMemo(() => {
    const v = validateDocument(doc);
    return v.ok ? [] : v.issues;
  }, [doc]);
  const mode = doc.layout.pageMode;
  const active = doc.modules.find((m) => m.id === activeId) ?? null;

  // 撤销只保存「删除前」的整份文档；删除之后又有新编辑时，撤销会连新编辑一起丢掉，所以此时让撤销失效
  const update = (next: RuyeDocument) => {
    pristineSample.current = null;
    if (persist) setSavePhase("pending");
    setNotice((n) => (n?.undo ? null : n));
    setDoc(syncTitle(next));
  };
  const remove = (next: RuyeDocument, what: string) => {
    setDoc(syncTitle(next));
    setNotice({ text: `已删除${what}。`, undo: doc });
  };
  /**
   * 新建 / 载入示例 / 导入 / 复制：都另存为一份新简历，不覆盖当前这份。
   * 只有本地存档读不出来（persist 为 false）时才用 replace 写入——那是用户明确要重新开始。
   */
  const startNew = (next: RuyeDocument) => {
    if (!persist && !confirm("本地存档无法读取。继续会用这份新简历覆盖它（可以先点「下载原始存档」备份）。继续？")) return;
    const reuse = pristineSample.current === docId;
    const id = reuse ? docId : newDocumentId();
    pristineSample.current = null;
    if (persist) {
      setWriteMode("merge");
    } else {
      setPersist(true);
      setWriteMode("replace");
    }
    setSavePhase("pending");
    setDocId(id);
    setDoc(next);
    setActiveId(next.modules[0]?.id ?? null);
    setIsSample(false);
    setNotice(null);
  };
  const replaceAll = startNew;

  function openDocument(id: string) {
    const r = loadDocument(id);
    if (!r) return setNotice({ text: "这份简历无法打开（存档可能已被其他标签页修改）。", level: "error" });
    pristineSample.current = null;
    setCurrentId(id);
    setDocId(id);
    setDoc(r.doc);
    setActiveId(r.doc.modules[0]?.id ?? null);
    setIsSample(false);
    setNotice(r.issues.length ? { text: `已打开。有 ${r.issues.length} 处格式问题需要修正。`, level: "error", sticky: true } : null);
  }

  function deleteDoc(id: string, label: string) {
    if (!confirm(`删除「${label}」？删除后不能恢复，需要的话先导出备份。`)) return;
    const err = deleteDocument(id);
    if (err) return setNotice({ text: err, level: "error", sticky: true });
    if (id !== docId) return;
    // 删的是当前这份：打开剩下最近的一份；一份都不剩就新建空白
    const next = listDocuments().find((d) => d.id !== id);
    if (next) openDocument(next.id);
    else startNew(createEmptyDocument());
  }

  // 可选云同步：只有配置了后端地址才启用。本机仍是主副本
  const cloud = useCloudSync({
    revision: doc,
    store: {
      list: () =>
        listDocuments()
          // 首次打开时自动载入、还没改过的示例不上传
          .filter((d) => d.id !== pristineSample.current)
          .flatMap((d) => {
            const r = loadDocument(d.id);
            return r ? [{ id: d.id, doc: r.doc }] : [];
          }),
      put: putDocument,
      newId: newDocumentId,
      // 当前这份只有在已经写入本机后才允许被云端版本替换
      canReplace: (id) => id !== docId || savePhase === "saved",
    },
    onReplaced: (ids) => {
      if (!ids.includes(docId)) return;
      const r = loadDocument(docId);
      if (r) {
        setDoc(r.doc);
        setNotice({ text: "这份简历在其他设备上更新过，已载入最新版本。" });
      }
    },
    onNotice: (text, level) => setNotice({ text, level, sticky: level === "error" }),
  });

  useEffect(() => {
    layout.ready.then(setEngineReady, (e: Error) => setFatal(e.message));
  }, []);

  // 提示自动消退：示例引导 9 秒，普通通知 6 秒；错误与可撤销通知常驻，由用户关闭
  useEffect(() => {
    if (!isSample) return;
    const t = setTimeout(() => setIsSample(false), 9000);
    return () => clearTimeout(t);
  }, [isSample]);
  useEffect(() => {
    if (!notice || notice.level === "error" || notice.undo || notice.sticky) return;
    const t = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  // 本地自动保存。读档失败时 persist 为 false。merge 写失败不会覆盖原档。
  useEffect(() => {
    if (!persist) {
      setSavePhase("blocked");
      return;
    }
    const err = saveCurrent(doc, docId, writeMode);
    if (err) {
      setSavePhase("failed");
      setNotice({ text: `${err}屏幕上的内容还在。`, level: "error", sticky: true });
    } else {
      setSavePhase("saved");
      if (writeMode === "replace") setWriteMode("merge");
    }
  }, [doc, persist, docId, writeMode]);

  // 防抖后重新排版。排版在 Worker 里跑，不卡输入；连续修改时只排最新的一版
  useEffect(() => {
    if (!engineReady) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const data = await layout.preview(doc, mode);
        if (!cancelled && data) setPreview(data);
      } catch (e) {
        if (!cancelled) setNotice({ text: `排版失败：${(e as Error).message}`, level: "error" });
      } finally {
        if (!cancelled) setBusy(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [engineReady, layout, doc, mode]);

  async function exportPdf(as: PageMode = mode) {
    setOverflowDialog(false);
    if (!engineReady) return;
    const ok = checkExportable(doc);
    if (!ok.ok) return setNotice({ text: ok.message, level: "error" });
    const missing = findMissingChars(doc, engineReady.charset);
    if (missing.length > 0) {
      return setNotice({ text: `内置字体缺少这些字：${missing.slice(0, 20).join(" ")}。导出后会显示为方块，请改字或使用完整字体（见 docs/fonts.md）。`, level: "error" });
    }
    setExporting(true);
    try {
      // 排版、导出、核对 PDF 自身页数都在排版服务里完成
      const outcome = await layout.exportPdf(doc, as);
      if (outcome.kind === "overflow") return setOverflowDialog(true);
      if (outcome.kind === "too-long") return setNotice({ text: outcome.message, level: "error" });
      download(`${exportBaseName(doc)}.pdf`, outcome.pdf as Uint8Array<ArrayBuffer>, "application/pdf");
      if (as === "continuous") setNotice({ text: "无损长一页适合屏幕投递；若需要打印在 A4 纸上，请改用标准分页或 A4 智能一页。" });
    } catch (e) {
      setNotice({ text: `导出失败：${(e as Error).message}`, level: "error" });
    } finally {
      setExporting(false);
    }
  }

  async function importFile(file: File) {
    const text = await file.text();
    if (file.name.endsWith(".json")) {
      try {
        const recovered = recoverDocument(JSON.parse(text));
        if (!recovered) return setNotice({ text: "导入失败：这份 JSON 不是可恢复的如页简历，当前内容没有被替换。", level: "error", sticky: true });
        replaceAll(recovered.doc);
        setRawBackup(null);
        if (recovered.issues.length > 0) {
          const detail = recovered.issues.slice(0, 3).map((i) => `${i.path} ${i.message}`).join("；");
          setNotice({ text: `已导入，姓名和正文都保留着。有 ${recovered.issues.length} 处格式问题：${detail}`, level: "error", sticky: true });
        } else {
          setNotice({ text: `已导入「${recovered.doc.meta.title}」。` });
        }
      } catch (e) {
        setNotice({ text: `导入失败：不是合法的 JSON（${(e as Error).message}）。当前内容没有被替换。`, level: "error", sticky: true });
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
    // 新建和载入示例都另存为新的一份，当前简历留在「我的简历」里，不用再确认
    else if (key === "new") startNew(createEmptyDocument());
    else if (key.startsWith("sample:")) {
      startNew(structuredClone(SAMPLES[key.slice(7)]));
      setIsSample(true);
    }
  }

  function onExportMenu(key: string) {
    if (key === "json") {
      download(`${exportBaseName(doc)}.ruye.json`, JSON.stringify(doc, null, 2), "application/json");
      if (issues.length > 0) {
        setNotice({
          text: `已导出 JSON。里面有 ${issues.length} 处格式问题，用「导入」可以原样打开并继续改，不会因为格式问题整份拒绝。`,
          sticky: true,
        });
      }
    } else if (key === "md") download(`${exportBaseName(doc)}.md`, toMarkdown(doc), "text/markdown");
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

        <DocSwitcher
          currentId={docId}
          currentLabel={doc.meta.alias?.trim() || doc.meta.title}
          currentAlias={doc.meta.alias ?? ""}
          listDocuments={listDocuments}
          onOpen={openDocument}
          onNew={() => startNew(createEmptyDocument())}
          onDuplicate={() => {
            startNew(duplicateDocument(doc));
            setNotice({ text: "已复制为一份新简历，可以改成投另一个岗位的版本。原来那份还在「我的简历」里。" });
          }}
          onDelete={deleteDoc}
          onAlias={(alias) => update(setAlias(doc, alias))}
        >
          <span className={`save-state${savePhase === "failed" || savePhase === "blocked" ? " blocked" : savePhase === "pending" ? " pending" : issues.length > 0 ? " warn" : ""}`}>
            <i aria-hidden="true" />
            {saveStatusText(savePhase, issues.length)}
          </span>
        </DocSwitcher>

        <div className="actions">
          <AccountMenu cloud={cloud} />
          <Menu
            label="文件"
            onPick={onFileMenu}
            items={[
              { key: "import", label: "导入简历", hint: ".ruye.json / .md" },
              { key: "new", label: "新建空白简历" },
              { key: "sample:full", label: "载入示例", hint: "完整" },
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
          <button className="primary" disabled={!engineReady || exporting} onClick={() => exportPdf()}>
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
              {rawBackup && (
                <button type="button" onClick={() => download("ruye-storage-raw.txt", rawBackup, "text/plain")}>
                  下载原始存档
                </button>
              )}
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
          <div className="side-tabs" role="tablist" aria-label="左栏">
            <button type="button" role="tab" aria-selected={sideTab === "content"} className={sideTab === "content" ? "on" : ""} onClick={() => setSideTab("content")}>
              <Icon name="layers" size={15} />
              内容
            </button>
            <button type="button" role="tab" aria-selected={sideTab === "style"} className={sideTab === "style" ? "on" : ""} onClick={() => setSideTab("style")}>
              <Icon name="palette" size={15} />
              模板与样式
            </button>
          </div>
          {sideTab === "content" ? (
            <>
              <StyleSummary doc={doc} onOpen={() => setSideTab("style")} />
              <ModuleNav
                doc={doc}
                activeId={activeId}
                onSelect={setActiveId}
                onChange={update}
                onAdd={addNewModule}
                onSortRecommended={() => update(sortByRecommended(doc, doc.layout.templateId))}
              />
            </>
          ) : (
            <StylePanel doc={doc} onChange={update} />
          )}
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

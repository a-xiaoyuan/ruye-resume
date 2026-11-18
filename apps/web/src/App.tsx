import { useEffect, useMemo, useRef, useState } from "react";
import {
  checkExportable,
  createEmptyDocument,
  exportBaseName,
  MODULE_LABELS,
  toMarkdown,
  validateDocument,
  type ModuleType,
  type PageMode,
  type RuyeDocument,
} from "../../../packages/schema/src/index.ts";
import { describeFit, findMissingChars } from "../../../packages/engine/src/index.ts";
import { createLayoutClient } from "./layout-client.ts";
import { deleteDocument, download, listDocuments, loadDocument, loadOutcome, newDocumentId, openSession, saveCurrent, saveStatusText, setCurrentId, type SaveMode, putDocument } from "./storage.ts";
import { addModule, duplicateDocument, removeModule, setAlias, syncTitle } from "./doc-ops.ts";
import { ModuleEditor } from "./components/ModuleEditor.tsx";
import { Preview, type PreviewData } from "./components/Preview.tsx";
import { AccountMenu, useCloudSync } from "./components/AccountMenu.tsx";
import { SAMPLES } from "./samples.ts";
import { parseImport } from "./import-file.ts";
import { importPdfBytes } from "./pdf-import.ts";
import { Logo, Menu } from "./components/Menu.tsx";
import { ModulePills, Sidebar } from "./components/Sidebar.tsx";
import { Icon } from "./components/icons.tsx";
import { AppearanceMenu } from "./components/AppearanceMenu.tsx";
import { OverflowDialog } from "./components/OverflowDialog.tsx";
import { loadSkin, saveSkin, type Skin } from "./skin.ts";
import { Library } from "./components/Library.tsx";
import { Backdrop } from "./components/Backdrop.tsx";
import { HistoryDialog } from "./components/HistoryDialog.tsx";
import { moveToTrash, recordSnapshot } from "./history.ts";
import { contentHash } from "./sync.ts";

interface Notice {
  text: string;
  level?: "info" | "error";
  /** 删除类操作的撤销点 */
  undo?: RuyeDocument;
  /** 不自动消失：恢复说明和存档损坏必须留在屏幕上 */
  sticky?: boolean;
  /** 附带的一个操作按钮，例如「去看看」 */
  action?: { label: string; run: () => void };
}

/** 撤销记录最多留多少步；连续输入时 800ms 内的修改合成一步 */
const UNDO_LIMIT = 100;
const UNDO_MERGE_MS = 800;

export function App() {
  const opened = useMemo(() => openSession(loadOutcome(), structuredClone(SAMPLES.full)), []);
  const [doc, setDoc] = useState<RuyeDocument>(opened.doc);
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
  // 主界面：编辑器 / 我的简历
  const [view, setView] = useState<"editor" | "library">("editor");
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [loginSignal, setLoginSignal] = useState(0);
  // 「调整结构」弹层：排序、显隐、添加模块
  const [managing, setManaging] = useState(false);
  const [zoom, setZoom] = useState(1);
  const fileInput = useRef<HTMLInputElement>(null);
  const [skin, setSkinState] = useState<Skin>(loadSkin);
  // 收起预览：屏幕窄的时候把地方让给编辑区
  const [previewOpen, setPreviewOpen] = useState(() => {
    try {
      return localStorage.getItem("ruye.preview") !== "closed";
    } catch {
      return true;
    }
  });
  const togglePreview = (open: boolean) => {
    setPreviewOpen(open);
    try {
      localStorage.setItem("ruye.preview", open ? "open" : "closed");
    } catch {
      /* 存不了就只在这次生效 */
    }
  };
  const setSkin = (s: Skin) => {
    setSkinState(s);
    saveSkin(s);
  };
  const editorRef = useRef<HTMLElement>(null);
  // 点大纲时正在平滑滚动：这段时间不让滚动监听改写高亮
  const jumping = useRef(0);

  const issues = useMemo(() => {
    const v = validateDocument(doc);
    return v.ok ? [] : v.issues;
  }, [doc]);
  const mode = doc.layout.pageMode;

  // 撤销 / 重做：整份文档的快照栈。只在这一份简历里有效，切换简历时清空
  const past = useRef<RuyeDocument[]>([]);
  const future = useRef<RuyeDocument[]>([]);
  const lastEdit = useRef(0);
  const [, setUndoTick] = useState(0);
  const remember = (prev: RuyeDocument, merge: boolean) => {
    const now = Date.now();
    if (!merge || now - lastEdit.current > UNDO_MERGE_MS) {
      past.current = [...past.current.slice(-(UNDO_LIMIT - 1)), prev];
    }
    lastEdit.current = now;
    future.current = [];
    setUndoTick((x) => x + 1);
  };
  const resetUndo = () => {
    past.current = [];
    future.current = [];
    lastEdit.current = 0;
    setUndoTick((x) => x + 1);
  };
  const applyDoc = (next: RuyeDocument) => {
    pristineSample.current = null;
    if (persist) setSavePhase("pending");
    setDoc(syncTitle(next));
  };
  function undo() {
    const prev = past.current.at(-1);
    if (!prev) return;
    past.current = past.current.slice(0, -1);
    future.current = [...future.current, doc];
    lastEdit.current = 0;
    applyDoc(prev);
    setNotice((n) => (n?.undo ? null : n));
    setUndoTick((x) => x + 1);
  }
  function redo() {
    const next = future.current.at(-1);
    if (!next) return;
    future.current = future.current.slice(0, -1);
    past.current = [...past.current, doc];
    lastEdit.current = 0;
    applyDoc(next);
    setUndoTick((x) => x + 1);
  }

  // 删除之后又有新编辑时，删除提示里的「撤销」会连新编辑一起丢掉，所以此时收起那条提示（Ctrl+Z 仍可逐步撤销）
  const update = (next: RuyeDocument) => {
    remember(doc, true);
    setNotice((n) => (n?.undo ? null : n));
    applyDoc(next);
  };
  const remove = (next: RuyeDocument, what: string) => {
    remember(doc, false);
    applyDoc(next);
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
    resetUndo();
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
    resetUndo();
    setDocId(id);
    setDoc(r.doc);
    setActiveId(r.doc.modules[0]?.id ?? null);
    setIsSample(false);
    setNotice(r.issues.length ? { text: `已打开。有 ${r.issues.length} 处格式问题需要修正。`, level: "error", sticky: true } : null);
  }

  async function deleteDoc(id: string, label: string) {
    const target = id === docId ? doc : loadDocument(id)?.doc;
    // 先放进回收站；回收站不可用（例如浏览器禁用了 IndexedDB）时才是真删除，要明确告诉用户
    const trashed = target ? await moveToTrash(id, target) : false;
    if (!trashed && !confirm(`删除「${label}」？这个浏览器的回收站不可用，删除后不能恢复，需要的话先导出备份。`)) return;
    const err = deleteDocument(id);
    if (err) return setNotice({ text: err, level: "error", sticky: true });
    if (trashed) setNotice({ text: `「${label}」已放进回收站，30 天内可以在「我的简历」里恢复。` });
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
    onPulled: (n) =>
      setNotice({ text: `从云端下载了 ${n} 份简历。`, action: { label: "去看看", run: () => setView("library") } }),
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

  // 本机历史：停止编辑 3 秒后，按规则（间隔 10 分钟、内容有变化）留一份快照。没改过的示例不留
  useEffect(() => {
    if (!persist || pristineSample.current === docId) return;
    const t = setTimeout(() => void recordSnapshot(docId, doc, contentHash(doc)), 3000);
    return () => clearTimeout(t);
  }, [doc, docId, persist]);

  // 保存失败或存档读不出来时，关闭页面前提醒一句：屏幕上的内容还没存下来
  useEffect(() => {
    if (savePhase !== "failed" && savePhase !== "blocked") return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [savePhase]);

  // 把 .ruye.json / .md / .pdf 直接拖进窗口就能导入（另存为一份新简历）
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    const hasFile = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes("Files");
    const over = (e: DragEvent) => {
      if (!hasFile(e)) return;
      e.preventDefault();
      setDragging(true);
    };
    const leave = (e: DragEvent) => {
      if (e.relatedTarget === null) setDragging(false);
    };
    const drop = (e: DragEvent) => {
      if (!hasFile(e)) return;
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer?.files[0];
      if (f) void importRef.current(f);
    };
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, []);

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

  const importRef = useRef<(f: File) => Promise<void>>(async () => undefined);
  importRef.current = async (f: File) => {
    await importFile(f);
    setView("editor");
  };
  async function importFile(file: File) {
    try {
      const pdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
      const r = pdf ? await importPdfBytes(new Uint8Array(await file.arrayBuffer())) : parseImport(file.name, await file.text());
      if (!r.ok) return setNotice({ text: r.message, level: "error", sticky: r.sticky });
      replaceAll(r.doc);
      setRawBackup(null);
      setNotice({ text: r.message, level: r.level, sticky: r.sticky });
    } catch (e) {
      setNotice({ text: `导入失败：${(e as Error).message}。当前简历没有被替换。`, level: "error", sticky: true });
    }
  }

  function addNewModule(type: ModuleType) {
    const r = addModule(doc, type);
    update(r.doc);
    jumpTo(r.id);
  }

  /** 大纲点一项：滚到中间对应的模块 */
  function jumpTo(id: string) {
    setActiveId(id);
    jumping.current = Date.now();
    requestAnimationFrame(() => document.getElementById(`module-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  // 快捷键：Ctrl+S 不弹浏览器的「另存网页」，告诉用户已经自动保存；Ctrl+P 直接导出 PDF（打印编辑器本身没有意义）
  const shortcut = useRef<(e: KeyboardEvent) => void>(() => undefined);
  shortcut.current = (e: KeyboardEvent) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const k = e.key.toLowerCase();
    // 输入框里的 Ctrl+Z 交给浏览器（撤销刚打的字）；在输入框外才撤销整步操作
    const el = document.activeElement as HTMLElement | null;
    const typing = !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
    if ((k === "z" || k === "y") && !typing && view === "editor") {
      e.preventDefault();
      if (k === "y" || e.shiftKey) redo();
      else undo();
      return;
    }
    if (k === "s") {
      e.preventDefault();
      setNotice({ text: persist ? "不用手动保存：每次修改都会自动存在这个浏览器里。" : "本地存档读不出来，现在的修改不会保存。先用「导出」备份。", level: persist ? "info" : "error" });
    } else if (k === "p") {
      e.preventDefault();
      if (engineReady && !exporting) exportPdf();
    }
  };
  useEffect(() => {
    const on = (e: KeyboardEvent) => shortcut.current(e);
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  // 「调整结构」弹层：点外面或按 Esc 关闭
  useEffect(() => {
    if (!managing) return;
    const close = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest(".structure-pop") && !t.closest(".module-pills .manage")) setManaging(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setManaging(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [managing]);

  // 滚动时高亮大纲里当前所在的模块：取顶部越过编辑区上沿（留 96px）的最后一个模块
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const onScroll = () => {
      if (Date.now() - jumping.current < 700) return;
      const top = el.getBoundingClientRect().top + 96;
      let current: string | null = null;
      for (const s of el.querySelectorAll<HTMLElement>("[data-module]")) {
        if (s.getBoundingClientRect().top <= top) current = s.dataset.module ?? null;
        else break;
      }
      const first = el.querySelector<HTMLElement>("[data-module]")?.dataset.module ?? null;
      setActiveId(current ?? first);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // 新建、示例、导入都另存为新的一份，当前简历留在「我的简历」里，不用再确认
  function newBlank() {
    startNew(createEmptyDocument());
    setView("editor");
  }
  function newFromSample(key: string) {
    startNew(structuredClone(SAMPLES[key.slice(7)]));
    setIsSample(true);
    setView("editor");
  }
  function duplicateById(id: string) {
    const src = id === docId ? doc : loadDocument(id)?.doc;
    if (!src) return setNotice({ text: "这份简历无法打开，没有复制。", level: "error" });
    startNew(duplicateDocument(src));
    setView("editor");
    setNotice({ text: "已复制为一份新简历，可以改成投另一个岗位的版本。原来那份还在「我的简历」里。" });
  }
  function renameById(id: string, alias: string) {
    if (id === docId) return update(setAlias(doc, alias));
    const r = loadDocument(id);
    if (!r) return;
    const err = putDocument(id, setAlias(r.doc, alias));
    if (err) setNotice({ text: err, level: "error" });
  }
  /** 历史版本恢复：恢复到当前这份就整份替换（可撤销）；恢复别的简历就写入后打开它 */
  function restoreVersion(id: string, restored: RuyeDocument, when: string) {
    const next = { ...restored, meta: { ...restored.meta, updatedAt: new Date().toISOString() } };
    setHistoryFor(null);
    if (id === docId) {
      remember(doc, false);
      applyDoc(next);
    } else {
      const err = putDocument(id, next);
      if (err) return setNotice({ text: err, level: "error" });
      openDocument(id);
    }
    setView("editor");
    setNotice(id === docId ? { text: `已恢复到「${when}」的版本。`, undo: doc } : { text: `已恢复到「${when}」的版本并打开。` });
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
    <div className={`app${previewOpen ? "" : " preview-collapsed"}`} data-skin={skin}>
      {view === "editor" && (
        <a className="skip-link" href="#editor-main">
          跳到编辑区
        </a>
      )}
      <Backdrop />
      <header className="topbar">
        <div className="brand">
          <Logo />
          <span className="brand-name">
            如页<em>Ruye</em>
          </span>
        </div>

        <button type="button" className={`library-btn${view === "library" ? " on" : ""}`} aria-pressed={view === "library"} onClick={() => setView(view === "library" ? "editor" : "library")}>
          <Icon name="layers" size={15} />
          我的简历
        </button>

        <div className="doc-meta">
          <button type="button" className="doc-title" title="在「我的简历」里切换、改名" onClick={() => setView("library")}>
            {doc.meta.alias?.trim() || doc.meta.title}
          </button>
          <span className={`save-state${savePhase === "failed" || savePhase === "blocked" ? " blocked" : savePhase === "pending" ? " pending" : issues.length > 0 ? " warn" : ""}`}>
            <i aria-hidden="true" />
            {saveStatusText(savePhase, issues.length)}
          </span>
        </div>

        <div className="actions">
          {view === "editor" && (
            <span className="undo-group">
              <button type="button" className="icon-btn" aria-label="撤销" title="撤销（Ctrl+Z）" disabled={past.current.length === 0} onClick={undo}>
                <Icon name="undo" size={16} />
              </button>
              <button type="button" className="icon-btn" aria-label="重做" title="重做（Ctrl+Shift+Z）" disabled={future.current.length === 0} onClick={redo}>
                <Icon name="redo" size={16} />
              </button>
            </span>
          )}
          <button type="button" className="icon-btn" aria-label="历史版本" title="历史版本" onClick={() => setHistoryFor(docId)}>
            <Icon name="history" size={16} />
          </button>
          {view === "editor" && <AppearanceMenu doc={doc} onChange={update} skin={skin} onSkin={setSkin} />}
          <AccountMenu cloud={cloud} loginSignal={loginSignal} />
          <Menu
            label="导出"
            right
            onPick={onExportMenu}
            items={[
              { key: "json", label: "导出 .ruye.json", hint: "备份，可再次导入" },
              { key: "md", label: "导出 Markdown", hint: "可版本管理" },
            ]}
          />
          <input ref={fileInput} type="file" accept=".json,.md,.txt,.pdf,application/pdf" hidden onChange={(e) => (e.target.files?.[0] && importFile(e.target.files[0]), (e.target.value = ""))} />
          <button className="primary" aria-label="下载 PDF" disabled={!engineReady || exporting} onClick={() => exportPdf()}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 2v8m0 0L5 7m3 3 3-3M3 12.5h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="btn-text">下载</span> PDF
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
                    undo();
                    setNotice(null);
                  }}
                >
                  撤销
                </button>
              )}
              {notice.action && (
                <button
                  onClick={() => {
                    notice.action!.run();
                    setNotice(null);
                  }}
                >
                  {notice.action.label}
                </button>
              )}
              <button aria-label="关闭提示" onClick={() => setNotice(null)}>
                ×
              </button>
            </span>
          </div>
        )}
      </div>

      {view === "library" ? (
        <Library
          currentId={docId}
          currentDoc={doc}
          listDocuments={listDocuments}
          cloud={{
            enabled: cloud.enabled,
            email: cloud.session?.user.email ?? null,
            userId: cloud.session?.user.id ?? null,
            api: cloud.api,
            statusText: cloud.status.text,
            syncing: cloud.status.phase === "syncing",
            syncNow: cloud.syncNow,
            onLogin: () => setLoginSignal((x) => x + 1),
          }}
          onOpen={(id) => {
            if (id !== docId) openDocument(id);
            setView("editor");
          }}
          onNew={newBlank}
          onSample={newFromSample}
          onImport={() => fileInput.current?.click()}
          onDuplicate={duplicateById}
          onDelete={deleteDoc}
          onRename={renameById}
          onHistory={setHistoryFor}
          onRestored={(id, note) => {
            openDocument(id);
            setView("editor");
            setNotice({ text: note });
          }}
          onError={(text) => setNotice({ text, level: "error" })}
          onClose={() => setView("editor")}
        />
      ) : (
      <main className="stage">
        {/* 写作面板：浮在画布左侧。顶部是模块标签，下面整篇连着写 */}
        <aside
          className="studio"
          aria-label="编辑"
          onPointerMove={(e) => {
            // 写作面板里跟着鼠标的一团柔光
            const r = e.currentTarget.getBoundingClientRect();
            e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
            e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
          }}
        >
          <ModulePills doc={doc} activeId={activeId} onSelect={(id) => (setManaging(false), jumpTo(id))} managing={managing} onManage={() => setManaging((x) => !x)} />
          {managing && (
            <div className="structure-pop" role="dialog" aria-label="调整简历结构">
              <Sidebar doc={doc} activeId={activeId} onSelect={(id) => (setManaging(false), jumpTo(id))} onChange={update} onAdd={(t) => (setManaging(false), addNewModule(t))} />
            </div>
          )}
        <section className="editor" id="editor-main" tabIndex={-1} aria-label="编辑区" ref={editorRef}>
          <div className="doc-editor">
            {issues.length > 0 && (
              <ul className="problems" aria-label="需要修正的内容">
                {issues.slice(0, 6).map((i) => (
                  <li key={i.path + i.message}>
                    {i.path}：{i.message}
                  </li>
                ))}
              </ul>
            )}
            {doc.modules.map((m) => (
              <ModuleEditor
                key={m.id}
                doc={doc}
                module={m}
                onChange={update}
                onRemove={remove}
                onError={(text) => setNotice({ text, level: "error" })}
                onRemoveModule={() => remove(removeModule(doc, m.id), `模块「${MODULE_LABELS[m.type]}」`)}
              />
            ))}
            {doc.modules.length === 0 && (
              <div className="empty">
                <p>这份简历还没有任何模块。</p>
                <span>从左侧「添加模块」开始，先加基本信息。</span>
              </div>
            )}
          </div>
        </section>
        </aside>

        {previewOpen ? (
        <section className="preview" aria-label="A4 预览">
          <Preview data={preview} error={fatal} busy={busy} zoom={zoom} onZoom={setZoom} onCollapse={() => togglePreview(false)} onJump={jumpTo} order={doc.modules.map((m) => m.id)} />
        </section>
        ) : (
          <button type="button" className="preview-rail" onClick={() => togglePreview(true)} aria-label="展开 A4 预览">
            <Icon name="panelRight" size={16} />
            <span>展开预览</span>
            {preview?.result && <em className={describeFit(preview.result).level}>{describeFit(preview.result).short}</em>}
          </button>
        )}
      </main>
      )}

      {dragging && (
        <div className="drop-hint" aria-hidden="true">
          <span>松开即可导入：.ruye.json、Markdown 或可复制文字的 PDF，会另存为一份新简历</span>
        </div>
      )}
      {historyFor && (
        <HistoryDialog
          docId={historyFor}
          label={(() => {
            const d = historyFor === docId ? doc : loadDocument(historyFor)?.doc;
            return d ? d.meta.alias?.trim() || d.meta.title : historyFor;
          })()}
          current={historyFor === docId ? doc : (loadDocument(historyFor)?.doc ?? doc)}
          api={cloud.api}
          onRestore={(d, when) => restoreVersion(historyFor, d, when)}
          onClose={() => setHistoryFor(null)}
        />
      )}
      {overflowDialog && <OverflowDialog onExport={(m) => exportPdf(m)} onClose={() => setOverflowDialog(false)} />}
    </div>
  );
}

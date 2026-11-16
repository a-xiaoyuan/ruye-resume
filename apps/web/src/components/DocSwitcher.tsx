// 顶栏「我的简历」：多份简历的列表与切换。数据都在本机 localStorage。
import { useEffect, useRef, useState } from "react";
import { TEMPLATE_META } from "../../../../packages/templates/src/index.ts";
import type { DocSummary } from "../storage.ts";

interface Props {
  currentId: string;
  /** 当前简历显示的名字（备注名或「姓名-求职意向」） */
  currentLabel: string;
  currentAlias: string;
  /** 打开面板时调用，读取最新列表 */
  listDocuments: () => DocSummary[];
  onOpen: (id: string) => void;
  onNew: () => void;
  onDuplicate: () => void;
  onDelete: (id: string, label: string) => void;
  onAlias: (alias: string) => void;
  /** 顶栏里紧跟标题的保存状态 */
  children?: React.ReactNode;
}

const templateName = (id: string) => TEMPLATE_META.find((t) => t.id === id)?.name ?? id;

function when(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  const d = new Date(t);
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

export function DocSwitcher(p: Props) {
  const [open, setOpen] = useState(false);
  const [docs, setDocs] = useState<DocSummary[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setDocs(p.listDocuments());
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
    // 每次打开时读一次列表
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 当前简历的条目用实时数据（列表读的是上一次保存）
  const rows = docs.some((d) => d.id === p.currentId) ? docs : [{ id: p.currentId, label: p.currentLabel, title: p.currentLabel, templateId: "", updatedAt: "", issueCount: 0 }, ...docs];

  return (
    <div className="doc-meta doc-switcher" ref={ref}>
      <button type="button" className="doc-trigger" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((v) => !v)} title="我的简历：切换、新建、复制">
        <span className="doc-title">{p.currentLabel}</span>
        <span className="caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {p.children}

      {open && (
        <div className="doc-panel" role="dialog" aria-label="我的简历">
          <div className="doc-panel-head">
            <strong>我的简历</strong>
            <span>共 {rows.length} 份 · 只保存在此浏览器</span>
          </div>

          <label className="alias-field">
            <span>当前简历的备注名</span>
            <input value={p.currentAlias} placeholder="如「投字节-后端」，只在这个列表里显示" onChange={(e) => p.onAlias(e.target.value)} />
          </label>

          <ul className="doc-list">
            {rows.map((d) => {
              const current = d.id === p.currentId;
              const label = current ? p.currentLabel : d.label;
              return (
                <li key={d.id} className={current ? "current" : ""}>
                  <button
                    type="button"
                    className="doc-open"
                    aria-current={current}
                    onClick={() => {
                      setOpen(false);
                      if (!current) p.onOpen(d.id);
                    }}
                  >
                    <span className="doc-row-title">
                      {label}
                      {current && <i aria-hidden="true">当前</i>}
                    </span>
                    <span className="doc-row-sub">
                      {[d.alias && d.alias !== d.title ? d.title : "", d.templateId ? templateName(d.templateId) : "", when(d.updatedAt), d.issueCount ? `${d.issueCount} 处格式问题` : ""].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="doc-delete"
                    aria-label={`删除「${label}」`}
                    title="删除"
                    onClick={() => {
                      p.onDelete(d.id, label);
                      setDocs(p.listDocuments());
                    }}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="doc-panel-actions">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                p.onNew();
              }}
            >
              ＋ 新建空白简历
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                p.onDuplicate();
              }}
            >
              复制当前简历
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

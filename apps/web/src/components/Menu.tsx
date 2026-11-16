// 顶栏下拉菜单与品牌标志
import { useEffect, useRef, useState } from "react";

export interface MenuItem {
  key: string;
  label: string;
  hint?: string;
  /** 这一项之前显示的分组标题 */
  section?: string;
}

export function Logo() {
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

export function Menu({ label, items, onPick, right }: { label: string; items: MenuItem[]; onPick: (key: string) => void; right?: boolean }) {
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
            <div key={it.key} role="none">
              {it.section && (
                <div className="menu-section" role="presentation">
                  {it.section}
                </div>
              )}
              <button
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

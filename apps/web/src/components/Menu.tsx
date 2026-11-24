// 顶栏下拉菜单与品牌标志
import { useEffect, useRef, useState } from "react";
import { menuKeys, Popover } from "./Popover.tsx";

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
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  // 关闭时把焦点还给触发按钮（点了外面别的地方时不抢焦点）
  const close = (restore: boolean) => {
    setOpen(false);
    if (restore) trigger.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    // 打开后焦点落到第一项，方向键就能直接选
    requestAnimationFrame(() => list.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus());
    const outside = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !list.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  return (
    <div className="menu" ref={ref}>
      <button
        ref={trigger}
        type="button"
        className="menu-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {label}
        <span className="caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <Popover
          anchor={trigger}
          right={right}
          className={`menu-list${right ? " right" : ""}`}
          role="menu"
          label={label}
          popRef={list}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              close(true);
            } else if (e.key === "Tab") {
              close(false);
              trigger.current?.focus();
            } else menuKeys(e, list.current);
          }}
        >
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
                tabIndex={-1}
                onClick={() => {
                  close(true);
                  onPick(it.key);
                }}
              >
                <span>{it.label}</span>
                {it.hint && <em>{it.hint}</em>}
              </button>
            </div>
          ))}
        </Popover>
      )}
    </div>
  );
}

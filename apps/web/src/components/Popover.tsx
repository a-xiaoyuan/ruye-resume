// 顶栏弹层：挂到 .app 根节点下，用 fixed 定位贴着触发按钮。
// 顶栏的工具条带毛玻璃（backdrop-filter），会成为 fixed 子元素的包含块，手机上还要横向滚动，
// 弹层留在里面会被裁掉或跑到顶栏上方，所以统一渲染到外面。
import { useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

const GAP = 8;
const EDGE = 12;

interface Props {
  anchor: RefObject<HTMLElement | null>;
  /** 右对齐到触发按钮的右边缘 */
  right?: boolean;
  /** 手机上撑满屏宽（左右各留 12px） */
  wideOnNarrow?: boolean;
  className: string;
  role: string;
  label?: string;
  popRef?: RefObject<HTMLDivElement>;
  onKeyDown?: (e: KeyboardEvent<HTMLDivElement>) => void;
  children: ReactNode;
}

export function Popover({ anchor, right, wideOnNarrow, className, role, label, popRef, onKeyDown, children }: Props) {
  const own = useRef<HTMLDivElement>(null);
  const ref = popRef ?? own;
  const [style, setStyle] = useState<CSSProperties>({ position: "fixed", visibility: "hidden" });

  useLayoutEffect(() => {
    const place = () => {
      const a = anchor.current?.getBoundingClientRect();
      if (!a) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const top = Math.min(a.bottom + GAP, vh - 120);
      const s: CSSProperties = { position: "fixed", top, maxHeight: vh - top - EDGE, overflowY: "auto" };
      if (wideOnNarrow && vw <= 600) {
        Object.assign(s, { left: EDGE, right: EDGE, width: "auto" });
      } else {
        const w = Math.min(ref.current?.offsetWidth ?? 0, vw - EDGE * 2);
        let left = right ? a.right - w : a.left;
        left = Math.max(EDGE, Math.min(left, vw - EDGE - w));
        Object.assign(s, { left, right: "auto", maxWidth: vw - EDGE * 2 });
      }
      setStyle(s);
    };
    place();
    window.addEventListener("resize", place);
    // 捕获阶段：工具条自己横向滚动时也要跟着走
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor, right, wideOnNarrow, ref]);

  const host = (anchor.current?.closest(".app") as HTMLElement | null) ?? document.body;
  return createPortal(
    <div ref={ref} className={`${className} portal-pop`} role={role} aria-label={label} style={style} onKeyDown={onKeyDown}>
      {children}
    </div>,
    host,
  );
}

/** 菜单方向键：上下移动、Home/End 到头尾，焦点在菜单项之间循环 */
export function menuKeys(e: KeyboardEvent<HTMLElement>, list: HTMLElement | null) {
  if (!list) return;
  const items = [...list.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)')];
  if (items.length === 0) return;
  const i = items.indexOf(document.activeElement as HTMLElement);
  let next: number | null = null;
  if (e.key === "ArrowDown") next = i < 0 ? 0 : (i + 1) % items.length;
  else if (e.key === "ArrowUp") next = i < 0 ? items.length - 1 : (i - 1 + items.length) % items.length;
  else if (e.key === "Home") next = 0;
  else if (e.key === "End") next = items.length - 1;
  if (next === null) return;
  e.preventDefault();
  items[next].focus();
}

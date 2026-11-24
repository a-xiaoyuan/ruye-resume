// 顶栏「外观」：模板、主题色、页面模式。按钮上直接显示当前模板名，要换时才展开
import { useEffect, useRef, useState } from "react";
import type { RuyeDocument } from "../../../../packages/schema/src/index.ts";
import { templateMeta } from "../../../../packages/templates/src/index.ts";
import { Icon } from "./icons.tsx";
import { StylePanel } from "./StylePanel.tsx";
import { SKINS, type Skin } from "../skin.ts";
import { Popover } from "./Popover.tsx";
import { radioKeys, radioTabIndex } from "../a11y.ts";

export function AppearanceMenu({ doc, onChange, skin, onSkin }: { doc: RuyeDocument; onChange: (d: RuyeDocument) => void; skin: Skin; onSkin: (s: Skin) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    // 打开后焦点进弹层：落到当前选中的那一项（没有就第一个可操作的元素）
    requestAnimationFrame(() => {
      const el = pop.current;
      (el?.querySelector<HTMLElement>('[role="radio"][aria-checked="true"]') ?? el?.querySelector<HTMLElement>("button, input, select"))?.focus();
    });
    const outside = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!ref.current?.contains(t) && !pop.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  const closeAndReturn = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  return (
    <div className="menu appearance" ref={ref}>
      <button ref={trigger} type="button" className="menu-trigger appearance-trigger" aria-label={`外观：模板、主题色、页面模式（当前 ${templateMeta(doc.layout.templateId).name}）`} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((x) => !x)}>
        <Icon name="palette" size={15} />
        <span className="appearance-label">外观</span>
        <span className="appearance-current">{templateMeta(doc.layout.templateId).name}</span>
      </button>
      {open && (
        <Popover
          anchor={trigger}
          right
          wideOnNarrow
          className="appearance-pop"
          role="dialog"
          label="外观：模板、主题色、页面模式"
          popRef={pop}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              closeAndReturn();
            }
          }}
        >
          <div
            onBlur={(e) => {
              // Tab 离开弹层时关上，焦点自然去到下一个按钮
              const to = e.relatedTarget as Node | null;
              if (to && !pop.current?.contains(to)) setOpen(false);
            }}
          >
            <StylePanel doc={doc} onChange={onChange} />
            <div className="skin-row">
              <div className="panel-caption">
                编辑器界面<span>只改编辑器，不影响简历</span>
              </div>
              <div className="seg" role="radiogroup" aria-label="编辑器界面" onKeyDown={radioKeys}>
                {SKINS.map((s, i) => (
                  <button key={s.key} type="button" role="radio" aria-checked={skin === s.key} tabIndex={radioTabIndex(skin === s.key, i, SKINS.some((x) => x.key === skin))} className={skin === s.key ? "on" : ""} title={s.hint} onClick={() => onSkin(s.key)}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Popover>
      )}
    </div>
  );
}

// 顶栏「外观」：模板、主题色、页面模式。按钮上直接显示当前模板名，要换时才展开
import { useEffect, useRef, useState } from "react";
import type { RuyeDocument } from "../../../../packages/schema/src/index.ts";
import { templateMeta } from "../../../../packages/templates/src/index.ts";
import { Icon } from "./icons.tsx";
import { StylePanel } from "./StylePanel.tsx";
import { SKINS, type Skin } from "../skin.ts";

export function AppearanceMenu({ doc, onChange, skin, onSkin }: { doc: RuyeDocument; onChange: (d: RuyeDocument) => void; skin: Skin; onSkin: (s: Skin) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div className="menu appearance" ref={ref}>
      <button type="button" className="menu-trigger appearance-trigger" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((x) => !x)}>
        <Icon name="palette" size={15} />
        <span className="appearance-label">外观</span>
        <span className="appearance-current">{templateMeta(doc.layout.templateId).name}</span>
      </button>
      {open && (
        <div className="appearance-pop" role="dialog" aria-label="外观：模板、主题色、页面模式">
          <StylePanel doc={doc} onChange={onChange} />
          <div className="skin-row">
            <div className="panel-caption">
              编辑器界面<span>只改编辑器，不影响简历</span>
            </div>
            <div className="seg" role="radiogroup" aria-label="编辑器界面">
              {SKINS.map((s) => (
                <button key={s.key} type="button" role="radio" aria-checked={skin === s.key} className={skin === s.key ? "on" : ""} title={s.hint} onClick={() => onSkin(s.key)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

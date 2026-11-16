// 顶栏「外观」：模板、主题色、页面模式。按钮上直接显示当前模板名，要换时才展开
import { useEffect, useRef, useState } from "react";
import type { RuyeDocument } from "../../../../packages/schema/src/index.ts";
import { templateMeta } from "../../../../packages/templates/src/index.ts";
import { Icon } from "./icons.tsx";
import { StylePanel } from "./StylePanel.tsx";

export function AppearanceMenu({ doc, onChange }: { doc: RuyeDocument; onChange: (d: RuyeDocument) => void }) {
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
        </div>
      )}
    </div>
  );
}

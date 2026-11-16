// 左栏：「内容」「模板与样式」两个标签页
import { useState } from "react";
import type { ModuleType, RuyeDocument } from "../../../../packages/schema/src/index.ts";
import { sortByRecommended } from "../../../../packages/templates/src/index.ts";
import { Icon } from "./icons.tsx";
import { ModuleNav } from "./ModuleNav.tsx";
import { StylePanel, StyleSummary } from "./StylePanel.tsx";

interface Props {
  doc: RuyeDocument;
  activeId: string | null;
  onSelect: (id: string) => void;
  onChange: (doc: RuyeDocument) => void;
  onAdd: (type: ModuleType) => void;
}

export function Sidebar({ doc, activeId, onSelect, onChange, onAdd }: Props) {
  const [tab, setTab] = useState<"content" | "style">("content");
  return (
    <aside className="sidebar">
      <div className="side-tabs" role="tablist" aria-label="左栏">
        <button type="button" role="tab" aria-selected={tab === "content"} className={tab === "content" ? "on" : ""} onClick={() => setTab("content")}>
          <Icon name="layers" size={15} />
          内容
        </button>
        <button type="button" role="tab" aria-selected={tab === "style"} className={tab === "style" ? "on" : ""} onClick={() => setTab("style")}>
          <Icon name="palette" size={15} />
          模板与样式
        </button>
      </div>
      {tab === "content" ? (
        <>
          <StyleSummary doc={doc} onOpen={() => setTab("style")} />
          <ModuleNav
            doc={doc}
            activeId={activeId}
            onSelect={onSelect}
            onChange={onChange}
            onAdd={onAdd}
            onSortRecommended={() => onChange(sortByRecommended(doc, doc.layout.templateId))}
          />
        </>
      ) : (
        <StylePanel doc={doc} onChange={onChange} />
      )}
    </aside>
  );
}

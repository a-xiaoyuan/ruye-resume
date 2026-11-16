// 左栏：简历大纲。只管结构——顺序、显隐、添加；点一项跳到中间对应的模块
import type { ModuleType, RuyeDocument } from "../../../../packages/schema/src/index.ts";
import { sortByRecommended } from "../../../../packages/templates/src/index.ts";
import { ModuleNav } from "./ModuleNav.tsx";

interface Props {
  doc: RuyeDocument;
  activeId: string | null;
  onSelect: (id: string) => void;
  onChange: (doc: RuyeDocument) => void;
  onAdd: (type: ModuleType) => void;
}

export function Sidebar({ doc, activeId, onSelect, onChange, onAdd }: Props) {
  return (
    <aside className="sidebar" aria-label="简历大纲">
      <ModuleNav
        doc={doc}
        activeId={activeId}
        onSelect={onSelect}
        onChange={onChange}
        onAdd={onAdd}
        onSortRecommended={() => onChange(sortByRecommended(doc, doc.layout.templateId))}
      />
    </aside>
  );
}

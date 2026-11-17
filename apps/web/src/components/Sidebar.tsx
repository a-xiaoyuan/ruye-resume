// 左栏：简历大纲。只管结构——顺序、显隐、添加；点一项跳到中间对应的模块
import { MODULE_LABELS, type ModuleType, type RuyeDocument } from "../../../../packages/schema/src/index.ts";
import { Icon } from "./icons.tsx";
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

/**
 * 写作面板顶部的模块标签：一眼看到简历有哪些部分，点一下跳过去；滚动时高亮当前所在的部分。
 * 排序、显隐、添加这些结构操作放在「调整结构」里（就是上面那份大纲），不和写作抢地方。
 */
export function ModulePills({ doc, activeId, onSelect, onManage, managing }: { doc: RuyeDocument; activeId: string | null; onSelect: (id: string) => void; onManage: () => void; managing: boolean }) {
  return (
    <nav className="module-pills" aria-label="跳到简历的某个部分">
      {doc.modules.map((m) => (
        <button
          key={m.id}
          type="button"
          className={`${m.id === activeId ? "on" : ""}${m.visible ? "" : " hidden-module"}`}
          aria-current={m.id === activeId ? "true" : undefined}
          title={m.visible ? MODULE_LABELS[m.type] : `${MODULE_LABELS[m.type]}（已隐藏）`}
          onClick={() => onSelect(m.id)}
        >
          {MODULE_LABELS[m.type]}
        </button>
      ))}
      <button type="button" className={`manage${managing ? " on" : ""}`} aria-expanded={managing} onClick={onManage}>
        <Icon name="sort" size={14} />
        调整结构
      </button>
    </nav>
  );
}

// 左栏「内容」页：模块列表（显隐、上下移动、拖拽排序、添加模块）
import { useState } from "react";
import { MODULE_LABELS, type ModuleType, type RuyeDocument } from "../../../../packages/schema/src/index.ts";
import { missingTypes, moduleSummary, moveModule, moveModuleTo, toggleModule } from "../doc-ops.ts";
import { Icon } from "./icons.tsx";

interface Props {
  doc: RuyeDocument;
  activeId: string | null;
  onSelect: (id: string) => void;
  onChange: (doc: RuyeDocument) => void;
  onAdd: (type: ModuleType) => void;
  onSortRecommended: () => void;
}

export function ModuleNav({ doc, activeId, onSelect, onChange, onAdd, onSortRecommended }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const missing = missingTypes(doc);
  const shown = doc.modules.filter((m) => m.visible).length;

  return (
    <nav className="module-nav" aria-label="简历模块">
      <div className="panel-caption">
        简历结构
        <span>
          {shown} / {doc.modules.length} 项显示
        </span>
      </div>
      <ul>
        {doc.modules.map((m, i) => (
          <li
            key={m.id}
            className={[m.id === activeId ? "active" : "", !m.visible ? "hidden-module" : "", overId === m.id && dragId !== m.id ? "drop-target" : "", dragId === m.id ? "dragging" : ""].join(" ")}
            draggable
            onDragStart={(e) => {
              setDragId(m.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setOverId(m.id);
            }}
            onDragLeave={() => setOverId((x) => (x === m.id ? null : x))}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId) onChange(moveModuleTo(doc, dragId, m.id));
              setDragId(null);
              setOverId(null);
            }}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
          >
            <span className="grip" aria-hidden="true" title="拖动排序">
              <Icon name="grip" size={14} />
            </span>
            <button type="button" className="module-btn" aria-current={m.id === activeId} onClick={() => onSelect(m.id)}>
              <span className="module-name">{MODULE_LABELS[m.type]}</span>
              <span className="module-sub">{moduleSummary(m)}</span>
            </button>
            <div className="nav-actions">
              <button type="button" aria-label={`上移${MODULE_LABELS[m.type]}`} disabled={i === 0} onClick={() => onChange(moveModule(doc, m.id, -1))}>
                <Icon name="up" size={14} />
              </button>
              <button type="button" aria-label={`下移${MODULE_LABELS[m.type]}`} disabled={i === doc.modules.length - 1} onClick={() => onChange(moveModule(doc, m.id, 1))}>
                <Icon name="down" size={14} />
              </button>
            </div>
            <button
              type="button"
              className={`eye${m.visible ? "" : " off"}`}
              aria-pressed={m.visible}
              aria-label={`在简历中显示${MODULE_LABELS[m.type]}`}
              title={m.visible ? "显示中，点击隐藏（内容保留）" : "已隐藏，点击显示"}
              onClick={() => onChange(toggleModule(doc, m.id))}
            >
              <Icon name={m.visible ? "eye" : "eyeOff"} size={15} />
            </button>
          </li>
        ))}
      </ul>

      {missing.length > 0 && (
        <>
          <div className="panel-caption add-caption">还可以添加</div>
          <div className="add-chips">
            {missing.map((t) => (
              <button key={t} type="button" className="add-chip" onClick={() => onAdd(t)}>
                <Icon name="plus" size={12} strokeWidth={2.2} />
                {MODULE_LABELS[t]}
              </button>
            ))}
          </div>
        </>
      )}
      <button type="button" className="link-btn sort-btn" onClick={onSortRecommended}>
        <Icon name="sort" size={14} />
        按模板推荐顺序排列
      </button>
    </nav>
  );
}

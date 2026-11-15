// 左栏：模块列表（显隐、上下移动、拖拽排序、添加模块）
import { useState } from "react";
import { MODULE_LABELS, type ModuleType, type RuyeDocument } from "../../../../packages/schema/src/index.ts";
import { missingTypes, moduleSummary, moveModule, moveModuleTo, toggleModule } from "../doc-ops.ts";

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

  return (
    <nav className="module-nav" aria-label="简历模块">
      <div className="panel-caption">
        模块<span>{doc.modules.length} 个</span>
      </div>
      <ul>
        {doc.modules.map((m, i) => (
          <li
            key={m.id}
            className={[m.id === activeId ? "active" : "", !m.visible ? "hidden-module" : "", overId === m.id && dragId !== m.id ? "drop-target" : ""].join(" ")}
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
            <span className="grip" aria-hidden="true">
              ⋮⋮
            </span>
            <button type="button" className="module-btn" aria-current={m.id === activeId} onClick={() => onSelect(m.id)}>
              <span className="module-icon" aria-hidden="true">
                {MODULE_LABELS[m.type][0]}
              </span>
              <span className="module-text">
                <span className="module-name">{MODULE_LABELS[m.type]}</span>
                <span className="module-sub">{moduleSummary(m)}</span>
              </span>
            </button>
            <div className="nav-actions">
              <button type="button" aria-label={`上移${MODULE_LABELS[m.type]}`} disabled={i === 0} onClick={() => onChange(moveModule(doc, m.id, -1))}>
                ↑
              </button>
              <button type="button" aria-label={`下移${MODULE_LABELS[m.type]}`} disabled={i === doc.modules.length - 1} onClick={() => onChange(moveModule(doc, m.id, 1))}>
                ↓
              </button>
              <label className="switch" title={m.visible ? "显示中，点击隐藏" : "已隐藏，点击显示"}>
                <input type="checkbox" checked={m.visible} aria-label={`在简历中显示${MODULE_LABELS[m.type]}`} onChange={() => onChange(toggleModule(doc, m.id))} />
                <span />
              </label>
            </div>
          </li>
        ))}
      </ul>
      {missing.length > 0 && (
        <select
          className="add-module"
          aria-label="添加模块"
          value=""
          onChange={(e) => {
            if (e.target.value) onAdd(e.target.value as ModuleType);
          }}
        >
          <option value="">＋ 添加模块…</option>
          {missing.map((t) => (
            <option key={t} value={t}>
              {MODULE_LABELS[t]}
            </option>
          ))}
        </select>
      )}
      <button type="button" className="link-btn" onClick={onSortRecommended}>
        按模板推荐顺序排列
      </button>
      <p className="nav-hint">拖动或用 ↑↓ 调整顺序；开关控制是否出现在简历里。</p>
    </nav>
  );
}

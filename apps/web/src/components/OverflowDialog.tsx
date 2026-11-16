// 智能一页装不下时的选择：不导出「号称一页却溢出」的文件
import type { PageMode } from "../../../../packages/schema/src/index.ts";

export function OverflowDialog({ onExport, onClose }: { onExport: (mode: PageMode) => void; onClose: () => void }) {
  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="ovf-title">
      <div className="dialog">
        <h2 id="ovf-title">装不进一页 A4</h2>
        <p>当前内容无法在可读性底线内放入一页 A4，所以不会导出一份「号称一页」却溢出的文件。你可以：</p>
        <div className="dialog-actions">
          <button className="primary" onClick={() => onExport("continuous")}>
            改为无损长一页导出
          </button>
          <button onClick={() => onExport("standard")}>改为标准分页导出</button>
          <button onClick={onClose}>回去精简内容</button>
        </div>
      </div>
    </div>
  );
}

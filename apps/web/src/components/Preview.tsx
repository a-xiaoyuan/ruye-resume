// 右栏：A4 预览。SVG 来自和导出 PDF 同一个排版器、同一份输入
import { A4_HEIGHT_MM, describeFit } from "../../../../packages/engine/src/index.ts";

import { Icon } from "./icons.tsx";

export type { PreviewData } from "../layout-service.ts";
import type { PreviewData } from "../layout-service.ts";

interface Props {
  data: PreviewData | null;
  error: string | null;
  busy: boolean;
  zoom: number;
  onZoom: (z: number) => void;
  onCollapse?: () => void;
}

export function Preview({ data, error, busy, zoom, onZoom, onCollapse }: Props) {
  const r = data?.result;
  const fit = r ? describeFit(r) : null;

  return (
    <div className="preview-inner">
      <div className="preview-toolbar">
        <span className={`fit-pill ${error ? "error" : (fit?.level ?? "")}`} aria-live="polite" title={fit?.text}>
          <i aria-hidden="true" />
          {error ? "排版引擎加载失败" : fit ? fit.short : "正在加载排版引擎…"}
        </span>
        {busy && data && (
          <span className="busy-flag">
            <i aria-hidden="true" />
            排版中
          </span>
        )}
        <div className="zoom" role="group" aria-label="预览缩放">
          <button type="button" aria-label="缩小" disabled={zoom <= 0.5} onClick={() => onZoom(Math.max(0.5, Math.round((zoom - 0.1) * 10) / 10))}>
            −
          </button>
          <button type="button" className="zoom-value" title="点击恢复适应宽度" onClick={() => onZoom(1)}>
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" aria-label="放大" disabled={zoom >= 1.8} onClick={() => onZoom(Math.min(1.8, Math.round((zoom + 0.1) * 10) / 10))}>
            +
          </button>
        </div>
        {onCollapse && (
          <button type="button" className="collapse-btn" onClick={onCollapse} aria-label="收起预览" title="收起预览，把地方让给编辑区">
            <Icon name="panelRight" size={16} />
          </button>
        )}
      </div>

      {error ? (
        <div className="fatal">{error}</div>
      ) : !data || !r ? (
        <div className="preview-empty">
          <div className="empty-icon" aria-hidden="true">
            ⧉
          </div>
          正在准备纸张…
        </div>
      ) : (
        <>
          {r.status === "overflow" && r.suggestions && (
            <div className="report">
              <strong>当前内容无法在可读性底线内放入一页 A4。</strong>你可以：精简标出的模块、改用无损长一页，或改为标准分页。
              <ul>
                {r.suggestions.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="board-wrap">
            <div className="board" style={{ aspectRatio: `210 / ${data.boardMm}`, width: `${zoom * 100}%` }}>
              {/* 四角裁切标记：提醒这是一张真实尺寸的纸，导出的 PDF 与它完全一致 */}
              <span className="crop tl" aria-hidden="true" />
              <span className="crop tr" aria-hidden="true" />
              <span className="crop bl" aria-hidden="true" />
              <span className="crop br" aria-hidden="true" />
              {r.status.startsWith("fitted") && (
                <span className="a4-edge" aria-hidden="true">
                  297 mm
                </span>
              )}
              <div className="svg" dangerouslySetInnerHTML={{ __html: data.svg }} />
              {r.status === "overflow" && (
                <div className="overflow-zone" style={{ top: `${(A4_HEIGHT_MM / data.boardMm) * 100}%` }}>
                  <span>A4 底边 · 以下超出约 {Math.round(r.metrics.overflowMm)}mm</span>
                </div>
              )}
              {/* 分页线：页码由 Typst 印在每页页脚，这里只标出页与页的分界 */}
              {r.status === "paginated" &&
                Array.from({ length: r.metrics.pageCount - 1 }, (_, i) => (
                  <div key={i} className="page-break" style={{ top: `${((i + 1) * A4_HEIGHT_MM * 100) / data.boardMm}%` }} aria-hidden="true" />
                ))}
            </div>
          </div>
          <div className="caption">
            {r.status === "continuous"
              ? `长画板，总高度约 ${(r.metrics.pageHeightMm / A4_HEIGHT_MM).toFixed(2)} 页 A4（不是标准打印纸）`
              : r.status === "paginated"
                ? `共 ${r.metrics.pageCount} 页（页码印在 PDF 页脚）· 预览与导出 PDF 同源`
                : "A4 · 210 × 297 mm · 预览与导出 PDF 同源"}
          </div>
        </>
      )}
    </div>
  );
}

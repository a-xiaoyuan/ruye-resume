// 右栏：A4 预览。SVG 来自和导出 PDF 同一个排版器、同一份输入
import { A4_HEIGHT_MM, type FitResult } from "../../../../packages/engine/src/index.ts";

export interface PreviewData {
  svg: string;
  result: FitResult;
  /** 画板总高度（mm）：溢出时比 297 高，用来画出页外部分 */
  boardMm: number;
}

export function Preview({ data, error }: { data: PreviewData | null; error: string | null }) {
  if (error) return <div className="fatal">{error}</div>;
  if (!data) return <div className="preview-empty">正在排版…</div>;
  const r = data.result;
  return (
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
      <div className="board" style={{ aspectRatio: `210 / ${data.boardMm}` }}>
        <div className="svg" dangerouslySetInnerHTML={{ __html: data.svg }} />
        {r.status === "overflow" && (
          <div className="overflow-zone" style={{ top: `${(A4_HEIGHT_MM / data.boardMm) * 100}%` }}>
            <span>A4 底边 · 以下超出约 {Math.round(r.metrics.overflowMm)}mm</span>
          </div>
        )}
        {r.status === "paginated" &&
          Array.from({ length: r.metrics.pageCount }, (_, i) => (
            <div key={i} className="page-break" style={{ top: `${((i + 1) * A4_HEIGHT_MM * 100) / data.boardMm}%` }}>
              <span>
                {i + 1} / {r.metrics.pageCount}
              </span>
            </div>
          ))}
      </div>
      {r.status === "continuous" && <div className="caption">长画板，总高度约 {(r.metrics.pageHeightMm / A4_HEIGHT_MM).toFixed(2)} 页 A4（不是标准打印纸）</div>}
    </>
  );
}

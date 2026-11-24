// 右栏：A4 预览。SVG 来自和导出 PDF 同一个排版器、同一份输入
import { A4_HEIGHT_MM, describeFit } from "../../../../packages/engine/src/index.ts";
import { MODULE_LABELS, type ModuleType } from "../../../../packages/schema/src/index.ts";

import { useEffect, useRef, useState, type PointerEvent } from "react";
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
  /** 点版面标尺上的一段，跳到编辑区对应的模块 */
  onJump?: (moduleId: string) => void;
  /** 文档里模块的先后顺序 */
  order?: string[];
}

export function Preview({ data, error, busy, zoom, onZoom, onCollapse, onJump, order }: Props) {
  const r = data?.result;
  const fit = r ? describeFit(r) : null;

  // 每次重新排版，纸面上扫过一道光；从「装不下」变成「装进一页」时，状态条迸出一圈光点
  const [sweep, setSweep] = useState(0);
  const [burst, setBurst] = useState(0);
  const lastLevel = useRef<string | null>(null);
  useEffect(() => {
    if (!data) return;
    setSweep((x) => x + 1);
    const level = fit?.level ?? null;
    if (level === "ok" && lastLevel.current !== null && lastLevel.current !== "ok") setBurst((x) => x + 1);
    lastLevel.current = level;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // 版面标尺可以收起：手机上它占掉纸右边一大块，看全文时先收起来
  const [meter, setMeter] = useState(() => {
    try {
      return localStorage.getItem("ruye.meter") !== "off";
    } catch {
      return true;
    }
  });
  const toggleMeter = () => {
    setMeter(!meter);
    try {
      localStorage.setItem("ruye.meter", meter ? "off" : "on");
    } catch {
      /* 存不了就只在这次生效 */
    }
  };
  const hasMeter = !!r && (r.status.startsWith("fitted") || r.status === "overflow");

  // 纸面上的高光跟着鼠标移动（纸本身不动，不倾斜）
  const board = useRef<HTMLDivElement>(null);
  const light = (e: PointerEvent<HTMLDivElement>) => {
    const el = board.current;
    if (!el) return;
    const b = el.getBoundingClientRect();
    el.style.setProperty("--gx", `${(((e.clientX - b.left) / b.width) * 100).toFixed(1)}%`);
    el.style.setProperty("--gy", `${(((e.clientY - b.top) / b.height) * 100).toFixed(1)}%`);
  };

  return (
    <div className="preview-inner">
      <div className="preview-toolbar">
        <span className={`fit-pill ${error ? "error" : (fit?.level ?? "")}`} aria-live="polite" title={fit?.text}>
          {burst > 0 && <Sparks key={burst} />}
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
        {hasMeter && (
          <button type="button" className="meter-toggle" aria-pressed={meter} title={meter ? "收起纸右侧的版面标尺" : "显示各模块占用的版面"} onClick={toggleMeter}>
            {meter ? "收起标尺" : "显示标尺"}
          </button>
        )}
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
          <div className={`board-wrap${hasMeter && meter ? "" : " no-meter"}`} onPointerMove={light}>
            <div className="board" ref={board} style={{ aspectRatio: `210 / ${data.boardMm}`, width: `${zoom * 100}%` }}>
              <span key={sweep} className="scan" aria-hidden="true" />
              <span className="sheen" aria-hidden="true" />
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
              {hasMeter && meter && <PageMeter result={r} boardMm={data.boardMm} order={order ?? []} onJump={onJump} />}
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

type Result = NonNullable<PreviewData["result"]>;

/**
 * 版面标尺：贴在纸的右边，把 297 mm 按模块切成几段——每个模块占了多少版面一眼可见，
 * 想压到一页时先砍哪里也就清楚了。点一段跳到那个模块。
 * 位置按各模块高度从下边距往上倒推，和纸面上的位置大致对齐，不是逐像素对齐。
 */
function PageMeter({ result, boardMm, order, onJump }: { result: Result; boardMm: number; order: string[]; onJump?: (id: string) => void }) {
  // 引擎按大小排序（给精简建议用）；标尺要按纸上的先后顺序
  const mods = result.metrics.moduleHeights.filter((m) => m.heightMm > 0.5).sort((a, b) => order.indexOf(a.moduleId) - order.indexOf(b.moduleId));
  if (!mods.length) return null;
  const sum = mods.reduce((a, m) => a + m.heightMm, 0);
  // 姓名页眉不参与测量：从下边距往上倒推各模块的起点
  let y = Math.max(0, result.metrics.contentHeightMm - result.tokens.pageMarginMm.bottom - sum);
  const pct = (mm: number) => `${(mm / boardMm) * 100}%`;
  return (
    <div className="page-meter" aria-label="各模块占用的版面" style={{ ["--board-mm" as string]: boardMm }}>
      {mods.map((m, i) => {
        const top = y;
        y += m.heightMm;
        const label = MODULE_LABELS[m.type as ModuleType] ?? m.type;
        const over = top + m.heightMm > A4_HEIGHT_MM + 0.5;
        return (
          <button
            key={m.moduleId}
            type="button"
            className={`meter-seg c${i % 6}${over ? " over" : ""}`}
            style={{ top: pct(top), height: pct(m.heightMm) }}
            title={`${label}：约 ${Math.round(m.heightMm)} mm，占一页的 ${Math.round((m.heightMm / A4_HEIGHT_MM) * 100)}%`}
            aria-label={`${label}，约 ${Math.round(m.heightMm)} 毫米，跳到这里编辑`}
            onClick={() => onJump?.(m.moduleId)}
          >
            {m.heightMm >= 14 && (
              <span>
                {label}
                <em>{Math.round(m.heightMm)} mm</em>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** 一圈向外飞散的光点（纯 CSS 动画，播一次） */
function Sparks() {
  return (
    <span className="sparks" aria-hidden="true">
      {Array.from({ length: 14 }, (_, i) => (
        <i key={i} style={{ ["--a" as string]: `${(360 / 14) * i}deg`, ["--d" as string]: `${26 + (i % 3) * 12}px`, ["--h" as string]: `${[214, 196, 172, 150, 42][i % 5]}` }} />
      ))}
    </span>
  );
}

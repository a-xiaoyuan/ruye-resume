// 月份选择器：点开选年、选月，不用打字。结束日期可以选「至今」；
// 起止日期成对使用时，选完开始会自动打开结束，并在结束早于开始时提示。
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { PRESENT } from "../../../../packages/schema/src/index.ts";
import { displayDate, endBeforeStart, formatYM, initialYear, parseYM } from "../dates.ts";
import { Icon } from "./icons.tsx";

interface PickerProps {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  /** 结束日期：可以选「至今」 */
  allowPresent?: boolean;
  kind?: "start" | "end" | "single";
  /** 另一端的日期：决定打开时翻到哪一年 */
  related?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** 选好一个值之后 */
  onPicked?: (v: string) => void;
  invalid?: boolean;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export function MonthPicker({ label, value, onChange, allowPresent, kind = "single", related, open: openProp, onOpenChange, onPicked, invalid }: PickerProps) {
  const id = useId();
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (v: boolean) => (onOpenChange ? onOpenChange(v) : setOpenState(v));
  const [year, setYear] = useState(() => initialYear(value, related, kind));
  const [yearMode, setYearMode] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const v = value ?? "";
  const sel = parseYM(v);
  const now = new Date();

  // 每次打开都翻到合适的年份，并把焦点放到选中的月份（没有就放到第一个）
  useEffect(() => {
    if (!open) return;
    setYear(initialYear(value, related, kind));
    setYearMode(false);
    requestAnimationFrame(() => (grid.current?.querySelector<HTMLButtonElement>("[aria-pressed='true']") ?? grid.current?.querySelector<HTMLButtonElement>("button"))?.focus());
    const close = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
    trigger.current?.focus();
    onPicked?.(next);
  };

  // 方向键在格子里移动：左右一格，上下一行（4 列）
  const onGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const btns = [...(grid.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    const i = btns.indexOf(document.activeElement as HTMLButtonElement);
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -4, ArrowDown: 4 }[e.key];
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    } else if (step !== undefined && i >= 0) {
      e.preventDefault();
      btns[Math.max(0, Math.min(btns.length - 1, i + step))]?.focus();
    } else if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      setYear((y) => y + (e.key === "PageUp" ? -1 : 1) * (yearMode ? 12 : 1));
    }
  };

  const shown = displayDate(v);
  const yearStart = year - 7;

  return (
    <div className={`field-block date-field${open ? " open" : ""}`} ref={root}>
      <label id={`${id}-l`} htmlFor={id}>
        {label}
      </label>
      <div className="date-trigger-row">
        <button
          id={id}
          ref={trigger}
          type="button"
          className={`date-trigger${shown ? "" : " empty"}${invalid ? " invalid" : ""}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`${label}：${shown || "未选择"}`}
          onClick={() => setOpen(!open)}
        >
          <Icon name="calendar" size={15} />
          <span>{shown || "选择月份"}</span>
        </button>
        {v && (
          <button type="button" className="date-clear" aria-label={`清除${label}`} title="清除" onClick={() => onChange("")}>
            <Icon name="close" size={12} />
          </button>
        )}
      </div>
      {open && (
        <div className="date-pop" role="dialog" aria-label={`选择${label}`} onKeyDown={onGridKey}>
          <div className="date-pop-head">
            <button type="button" className="icon-btn" aria-label={yearMode ? "往前 12 年" : "上一年"} onClick={() => setYear((y) => y - (yearMode ? 12 : 1))}>
              <Icon name="left" size={16} />
            </button>
            <button type="button" className="date-year" aria-label={yearMode ? "回到选月份" : "选择年份"} onClick={() => setYearMode((x) => !x)}>
              {yearMode ? `${yearStart} – ${yearStart + 11}` : `${year} 年`}
            </button>
            <button type="button" className="icon-btn" aria-label={yearMode ? "往后 12 年" : "下一年"} onClick={() => setYear((y) => y + (yearMode ? 12 : 1))}>
              <Icon name="right" size={16} />
            </button>
          </div>
          <div className="date-grid" ref={grid}>
            {yearMode
              ? Array.from({ length: 12 }, (_, i) => yearStart + i).map((y) => (
                  <button
                    key={y}
                    type="button"
                    aria-pressed={y === year}
                    className={y === now.getFullYear() ? "today" : ""}
                    onClick={() => {
                      setYear(y);
                      setYearMode(false);
                      requestAnimationFrame(() => grid.current?.querySelector<HTMLButtonElement>("button")?.focus());
                    }}
                  >
                    {y}
                  </button>
                ))
              : MONTHS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={!!sel && sel.y === year && sel.m === m}
                    className={year === now.getFullYear() && m === now.getMonth() + 1 ? "today" : ""}
                    aria-label={`${year} 年 ${m} 月`}
                    onClick={() => pick(formatYM({ y: year, m }))}
                  >
                    {m} 月
                  </button>
                ))}
          </div>
          <div className="date-pop-foot">
            {allowPresent && (
              <button type="button" aria-pressed={v === PRESENT} className="present" onClick={() => pick(PRESENT)}>
                至今
              </button>
            )}
            <button type="button" className="this-month" onClick={() => pick(formatYM({ y: now.getFullYear(), m: now.getMonth() + 1 }))}>
              本月
            </button>
            <span className="date-hint">← → ↑ ↓ 选择，PageUp / PageDown 换年</span>
          </div>
        </div>
      )}
    </div>
  );
}

/** 起止日期：选完开始自动打开结束；结束早于开始时提示 */
export function DateRange({ start, end, onStart, onEnd, presentOk = true }: { start?: string; end?: string; onStart: (v: string) => void; onEnd: (v: string) => void; presentOk?: boolean }) {
  const [endOpen, setEndOpen] = useState(false);
  const wrong = endBeforeStart(start, end);
  return (
    <>
      <MonthPicker label="开始" kind="start" value={start} related={end} onChange={onStart} onPicked={() => !end && setEndOpen(true)} />
      <MonthPicker label="结束" kind="end" value={end} related={start} onChange={onEnd} allowPresent={presentOk} open={endOpen} onOpenChange={setEndOpen} invalid={wrong} />
      {wrong && <p className="hint error wide-hint">结束时间早于开始时间，检查一下是不是选反了。</p>}
    </>
  );
}

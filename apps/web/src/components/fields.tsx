// 表单基础控件：文本、多行、日期、标签输入、要点列表、照片
import { useEffect, useId, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";
import { isValidDate, normalizeDate, PRESENT } from "../../../../packages/schema/src/index.ts";
import { splitPastedLines } from "../paste.ts";

interface FieldProps {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
  wide?: boolean;
  type?: string;
}

export function TextField({ label, value, onChange, placeholder, wide, type = "text" }: FieldProps) {
  const id = useId();
  return (
    <div className={`field-block${wide ? " wide" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <input id={id} type={type} value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/** 自动增高的多行输入框 */
function AutoTextarea(props: { value: string; onChange: (v: string) => void; onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void; onPaste?: (e: ClipboardEvent<HTMLTextAreaElement>) => void; placeholder?: string; id?: string; inputRef?: (el: HTMLTextAreaElement | null) => void; ariaLabel?: string }) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [props.value]);
  return (
    <textarea
      id={props.id}
      aria-label={props.ariaLabel}
      ref={(el) => {
        ref.current = el;
        props.inputRef?.(el);
      }}
      rows={1}
      value={props.value}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
      onKeyDown={props.onKeyDown}
      onPaste={props.onPaste}
    />
  );
}

export function TextArea({ label, value, onChange, placeholder }: FieldProps) {
  const id = useId();
  return (
    <div className="field-block wide">
      <label htmlFor={id}>{label}</label>
      <AutoTextarea id={id} value={value ?? ""} onChange={onChange} placeholder={placeholder} />
    </div>
  );
}

/** 日期：输入 2024-09、2024.09、2024年9月 都行，离开输入框时归一化；可勾选「至今」 */
export function DateField({ label, value, onChange, allowPresent }: { label: string; value: string | undefined; onChange: (v: string) => void; allowPresent?: boolean }) {
  const id = useId();
  const v = value ?? "";
  const [draft, setDraft] = useState(v);
  useEffect(() => setDraft(v), [v]);
  const present = v === PRESENT;
  const invalid = draft !== "" && !isValidDate(normalizeDate(draft));
  return (
    <div className="field-block">
      <label htmlFor={id}>{label}</label>
      <div className="date-row">
        <input
          id={id}
          value={present ? "" : draft}
          disabled={present}
          placeholder={present ? "至今" : "2024-09"}
          aria-invalid={invalid}
          className={invalid ? "invalid" : ""}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => {
            const next = normalizeDate(e.currentTarget.value);
            setDraft(next);
            onChange(next);
          }}
        />
        {allowPresent && (
          <label className="check">
            <input type="checkbox" checked={present} onChange={(e) => onChange(e.target.checked ? PRESENT : "")} />
            至今
          </label>
        )}
      </div>
      {invalid && <div className="hint error">格式应为 2024-09</div>}
    </div>
  );
}

/** 标签输入：回车或逗号完成一个；退格删除最后一个；粘贴「Java、Spring Boot、MySQL」直接拆成多个 */
export function TagInput({ label, value, onChange, placeholder }: { label: string; value: string[] | undefined; onChange: (v: string[]) => void; placeholder?: string }) {
  const id = useId();
  const tags = value ?? [];
  const [draft, setDraft] = useState("");
  const commit = (raw: string) => {
    const parts = raw.split(/[,，、;；]/).map((s) => s.trim()).filter(Boolean);
    if (parts.length) onChange([...tags, ...parts.filter((p) => !tags.includes(p))]);
    setDraft("");
  };
  return (
    <div className="field-block wide">
      <label htmlFor={id}>{label}</label>
      <div className="tag-input" onClick={() => document.getElementById(id)?.focus()}>
        {tags.map((t, i) => (
          <span key={t + i} className="tag">
            {t}
            <button type="button" aria-label={`删除 ${t}`} onClick={() => onChange(tags.filter((_, j) => j !== i))}>
              ×
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          placeholder={tags.length ? "" : placeholder ?? "输入后按回车"}
          onChange={(e) => {
            const v = e.target.value;
            if (/[,，、;；]$/.test(v)) commit(v);
            else setDraft(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit(draft);
            } else if (e.key === "Backspace" && draft === "" && tags.length) {
              onChange(tags.slice(0, -1));
            }
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text/plain");
            if (!/[,，、;；\n]/.test(text)) return;
            e.preventDefault();
            commit(draft + text.replace(/\r?\n/g, "、"));
          }}
          onBlur={() => draft.trim() && commit(draft)}
        />
      </div>
    </div>
  );
}

/** 要点列表：每条一行；回车在下方新增一条，空行按退格删除 */
/** 单独一行、以冒号结尾的短句是分块小标题（与排版模板的规则一致） */
const SUBHEAD = /^[^：:，,。；;]{1,12}[：:]\s*$/;
const LONG_BULLET = 60;

export function BulletList({ label, value, onChange, placeholder }: { label: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const refs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const [focus, setFocus] = useState<number | null>(null);
  useEffect(() => {
    if (focus !== null) {
      refs.current[focus]?.focus();
      setFocus(null);
    }
  }, [focus, value.length]);
  const list = value.length ? value : [""];
  const set = (i: number, v: string) => onChange(list.map((x, j) => (j === i ? v : x)));
  return (
    <div className="field-block wide">
      <label>{label}</label>
      <ol className="bullets">
        {list.map((b, i) => {
          const sub = SUBHEAD.test(b.trim());
          const n = [...b.trim()].length;
          return (
            <li key={i} className={sub ? "subhead" : ""}>
              <span className="bullet-mark" aria-hidden="true" />
              <AutoTextarea
                ariaLabel={`${label}第 ${i + 1} 条`}
                value={b}
                placeholder={i === 0 ? placeholder : ""}
                inputRef={(el) => (refs.current[i] = el)}
                onChange={(v) => set(i, v.replace(/\n/g, ""))}
                onPaste={(e) => {
                  // 从旧简历、Word、网页粘过来的多行文字：一行拆成一条，去掉行首的圆点和序号
                  const text = e.clipboardData.getData("text/plain");
                  const lines = splitPastedLines(text);
                  if (lines.length < 2) return;
                  e.preventDefault();
                  const el = e.currentTarget;
                  const before = b.slice(0, el.selectionStart);
                  const after = b.slice(el.selectionEnd);
                  lines[0] = before + lines[0];
                  lines[lines.length - 1] += after;
                  const next = [...list];
                  next.splice(i, 1, ...lines);
                  onChange(next);
                  setFocus(i + lines.length - 1);
                }}
                onKeyDown={(e) => {
                  const el = e.currentTarget;
                  if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
                    // Alt+↑/↓：整条上下移动
                    const j = e.key === "ArrowUp" ? i - 1 : i + 1;
                    if (j < 0 || j >= list.length) return;
                    e.preventDefault();
                    onChange(swap(list, i, j));
                    setFocus(j);
                    return;
                  }
                  if (e.key === "ArrowUp" && el.selectionStart === 0 && el.selectionEnd === 0 && i > 0) {
                    e.preventDefault();
                    setFocus(i - 1);
                    return;
                  }
                  if (e.key === "ArrowDown" && el.selectionStart === b.length && i < list.length - 1) {
                    e.preventDefault();
                    setFocus(i + 1);
                    return;
                  }
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    const next = [...list];
                    next.splice(i + 1, 0, "");
                    onChange(next);
                    setFocus(i + 1);
                  } else if (e.key === "Backspace" && b === "" && list.length > 1) {
                    e.preventDefault();
                    onChange(list.filter((_, j) => j !== i));
                    setFocus(Math.max(0, i - 1));
                  }
                }}
              />
              {!sub && n > LONG_BULLET && (
                <span className="bullet-count" title="超过 60 字，建议拆成两条">
                  {n} 字
                </span>
              )}
              <div className="row-actions">
                <button type="button" aria-label="上移这条" disabled={i === 0} onClick={() => onChange(swap(list, i, i - 1))}>
                  ↑
                </button>
                <button type="button" aria-label="下移这条" disabled={i === list.length - 1} onClick={() => onChange(swap(list, i, i + 1))}>
                  ↓
                </button>
                <button type="button" aria-label="删除这条" onClick={() => onChange(list.filter((_, j) => j !== i))}>
                  ×
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="bullets-foot">
        <button type="button" className="link-btn add-line" onClick={() => (onChange([...list, ""]), setFocus(list.length))}>
          ＋ 添加一条
        </button>
        <span className="key-hint">
          <kbd>回车</kbd> 新起一条 · <kbd>Alt</kbd>+<kbd>↑↓</kbd> 调顺序 · 多行文字可以直接粘贴
        </span>
      </div>
    </div>
  );
}

function swap<T>(arr: T[], i: number, j: number): T[] {
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

const MAX_PHOTO_BYTES = 1024 * 1024;

/** 照片：本地选择，按 3:4 居中裁切并缩放到 360×480，转成 JPEG data URL。不上传 */
export function PhotoField({ value, onChange, onError }: { value: string | undefined; onChange: (v: string | undefined) => void; onError: (msg: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  async function pick(file: File) {
    if (file.size > MAX_PHOTO_BYTES) return onError("图片超过 1MB，请压缩后再选。");
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise<void>((ok, fail) => {
        img.onload = () => ok();
        img.onerror = () => fail(new Error("无法读取这张图片"));
        img.src = url;
      });
      const W = 360;
      const H = 480;
      const scale = Math.max(W / img.width, H / img.height);
      const sw = W / scale;
      const sh = H / scale;
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      canvas.getContext("2d")!.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, W, H);
      onChange(canvas.toDataURL("image/jpeg", 0.88));
    } catch (e) {
      onError((e as Error).message);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return (
    <div className="field-block photo-field">
      <label>照片（可选）</label>
      <div className="photo-row">
        {value ? <img src={value} alt="照片预览" /> : <div className="photo-empty">无</div>}
        <div className="photo-actions">
          <button type="button" onClick={() => input.current?.click()}>
            {value ? "更换" : "选择图片"}
          </button>
          {value && (
            <button type="button" onClick={() => onChange(undefined)}>
              移除
            </button>
          )}
          <span className="hint">按 3:4 自动居中裁切，只保存在本机</span>
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) pick(f);
        }}
      />
    </div>
  );
}

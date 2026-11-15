// 左栏上半部分：模板、主题色、页面模式。只改 doc.layout，不碰内容。
import { THEMES, THEME_IDS, type PageMode, type RuyeDocument } from "../../../../packages/schema/src/index.ts";
import { TEMPLATE_META } from "../../../../packages/templates/src/index.ts";

const MODES: { id: PageMode; short: string; name: string; hint: string }[] = [
  { id: "fit-a4", short: "智能一页", name: "A4 智能一页", hint: "在可读性底线内自动收紧；装不下会明确告诉你超出多少，而不是悄悄打出第 2 页。" },
  { id: "continuous", short: "长一页", name: "无损长一页", hint: "A4 宽、高度随内容变化的单页 PDF，不缩字号。适合邮件与网申附件。" },
  { id: "standard", short: "标准分页", name: "标准分页", hint: "普通 A4 分页，页码如实显示，适合打印。" },
];

export function StylePanel({ doc, onChange }: { doc: RuyeDocument; onChange: (doc: RuyeDocument) => void }) {
  const layout = doc.layout;
  const theme = layout.theme ?? "ink";
  const mode = MODES.find((m) => m.id === layout.pageMode) ?? MODES[0];

  return (
    <section className="style-panel" aria-label="版式">
      <div className="panel-caption">
        版式<span>同一份内容，随时换</span>
      </div>

      <div className="template-list" role="radiogroup" aria-label="模板">
        {TEMPLATE_META.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={layout.templateId === t.id}
            className={`template-card${layout.templateId === t.id ? " on" : ""}`}
            onClick={() => onChange({ ...doc, layout: { ...layout, templateId: t.id } })}
          >
            <span className="template-name">
              {t.name}
              {layout.templateId === t.id && <i aria-hidden="true">✓</i>}
            </span>
            <span className="template-desc">{t.description}</span>
          </button>
        ))}
      </div>

      <div className="style-row">
        <span className="style-label">主题色</span>
        <div className="swatches" role="radiogroup" aria-label="主题色">
          {THEME_IDS.map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={theme === id}
              aria-label={THEMES[id].label}
              title={THEMES[id].label}
              style={{ background: THEMES[id].accent }}
              onClick={() => onChange({ ...doc, layout: { ...layout, theme: id } })}
            />
          ))}
        </div>
        <span className="style-value">{THEMES[theme].label}</span>
      </div>

      <div className="seg" role="radiogroup" aria-label="页面模式">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={layout.pageMode === m.id}
            className={layout.pageMode === m.id ? "on" : ""}
            title={m.name}
            onClick={() => onChange({ ...doc, layout: { ...layout, pageMode: m.id } })}
          >
            {m.short}
          </button>
        ))}
      </div>
      <p className="style-note">{mode.hint}</p>
    </section>
  );
}

// 左栏「模板」页：模板缩略图、主题色、页面模式。只改 doc.layout，不碰内容。
import { THEMES, THEME_IDS, type PageMode, type RuyeDocument } from "../../../../packages/schema/src/index.ts";
import { TEMPLATE_META, templateMeta } from "../../../../packages/templates/src/index.ts";
import { Icon } from "./icons.tsx";

// 缩略图由 scripts/thumbs.py 用真实排版生成（同一份完整示例），看到的就是排出来的样子
const THUMBS = import.meta.glob("../assets/templates/*.png", { eager: true, import: "default" }) as Record<string, string>;
const thumb = (id: string) => THUMBS[`../assets/templates/${id}.png`];

export const MODES: { id: PageMode; short: string; name: string; hint: string }[] = [
  { id: "fit-a4", short: "智能一页", name: "A4 智能一页", hint: "在可读性底线内自动收紧；装不下会明确告诉你超出多少，而不是悄悄打出第 2 页。" },
  { id: "continuous", short: "长一页", name: "无损长一页", hint: "A4 宽、高度随内容变化的单页 PDF，不缩字号。适合邮件与网申附件。" },
  { id: "standard", short: "标准分页", name: "标准分页", hint: "普通 A4 分页，页码如实显示，适合打印。" },
];

const GROUPS = [
  { id: "classic", label: "稳妥", hint: "适合大多数投递" },
  { id: "colorful", label: "设计感", hint: "有色块与图标" },
] as const;

export function StylePanel({ doc, onChange }: { doc: RuyeDocument; onChange: (doc: RuyeDocument) => void }) {
  const layout = doc.layout;
  const theme = layout.theme ?? "ink";
  const mode = MODES.find((m) => m.id === layout.pageMode) ?? MODES[0];
  const current = templateMeta(layout.templateId);
  const fixed = Boolean(current.fixedTheme);

  return (
    <section className="style-panel" aria-label="模板与样式">
      {GROUPS.map((g) => (
        <div key={g.id} className="tpl-group">
          <div className="panel-caption">
            {g.label}
            <span>{g.hint}</span>
          </div>
          <div className="tpl-grid" role="radiogroup" aria-label={`${g.label}模板`}>
            {TEMPLATE_META.filter((t) => t.group === g.id).map((t) => {
              const on = layout.templateId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  title={t.description}
                  className={`tpl-card${on ? " on" : ""}`}
                  onClick={() => onChange({ ...doc, layout: { ...layout, templateId: t.id } })}
                >
                  <span className="tpl-thumb">
                    {thumb(t.id) ? <img src={thumb(t.id)} alt="" loading="lazy" /> : null}
                    {on && (
                      <i className="tpl-check">
                        <Icon name="check" size={12} strokeWidth={3} />
                      </i>
                    )}
                  </span>
                  <span className="tpl-name">{t.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p className="tpl-desc">{current.description}</p>

      <div className="panel-caption">
        主题色<span>{fixed ? "这套模板固定黑白" : THEMES[theme].label}</span>
      </div>
      <div className={`swatches${fixed ? " disabled" : ""}`} role="radiogroup" aria-label="主题色">
        {THEME_IDS.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={theme === id}
            aria-label={THEMES[id].label}
            title={fixed ? "极简模板不使用主题色" : THEMES[id].label}
            disabled={fixed}
            style={{ background: `linear-gradient(135deg, ${THEMES[id].accent}, ${THEMES[id].secondary})` }}
            onClick={() => onChange({ ...doc, layout: { ...layout, theme: id } })}
          />
        ))}
      </div>

      <div className="panel-caption">页面模式</div>
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

/** 「内容」页顶部的当前样式摘要，点一下切到「模板」页 */
export function StyleSummary({ doc, onOpen }: { doc: RuyeDocument; onOpen: () => void }) {
  const meta = templateMeta(doc.layout.templateId);
  const theme = doc.layout.theme ?? "ink";
  const mode = MODES.find((m) => m.id === doc.layout.pageMode) ?? MODES[0];
  return (
    <button type="button" className="style-summary" onClick={onOpen}>
      <span className="style-summary-thumb">{thumb(meta.id) ? <img src={thumb(meta.id)} alt="" /> : null}</span>
      <span className="style-summary-text">
        <b>{meta.name}</b>
        <span>
          {meta.fixedTheme ? "黑白" : THEMES[theme].label} · {mode.short}
        </span>
      </span>
      <span className="style-summary-go">更换</span>
    </button>
  );
}

// 中栏：当前模块的表单
import { useEffect, useState } from "react";
import { ageFrom, lintDocument, MODULE_LABELS, newId, type LintIssue, type Module, type RuyeDocument, type SkillCategory } from "../../../../packages/schema/src/index.ts";
import { addItem, itemTitle, moveItem, removeItem, replaceModule, updateItem, type ListItem, type ListModule } from "../doc-ops.ts";
import { Icon } from "./icons.tsx";
import { BulletList, ChoiceField, PhotoField, TagInput, TextArea, TextField } from "./fields.tsx";
import { DateRange, MonthPicker } from "./DatePicker.tsx";
import { radioKeys, radioTabIndex } from "../a11y.ts";

/** 经历类模块的写法提示，收在「写法提示」里，需要时展开 */
const BULLET_GUIDE = [
  "每条要点尽量是「动作 + 技术 + 可量化结果」，例如：引入二级缓存，将 P99 从 320ms 降到 140ms。",
  "单独一行写「个人职责：」「技术亮点：」，会变成分块小标题。",
  "句首写「缓存优化：……」，冒号前的短语会加粗，方便招聘方先扫标题。",
  "一条控制在两行以内（约 60 字），太长就拆成两条。",
];

const MODULE_HINTS: Record<string, string> = {
  basic_info: "姓名 + 求职意向会拼成文档标题。照片只在本机处理，不会上传。",
  job_intention: "岗位与城市写具体；期望薪资一般不建议写。",
  skills: "两种写法：分类列表适合列技术栈，描述句适合写掌握深度。可以只用一种，也可以混用。",
  education: "校招建议把教育放在前面；亮点写 GPA、专业排名、奖学金。",
  work: "按时间倒序，写清你负责什么、做成了什么。",
  internship: "按时间倒序；技术栈回车添加。",
  project: "突出你负责的部分和结果；链接放可以打开的仓库或演示地址。",
  research: "写清课题、你的分工与产出。",
  paper: "期刊 / 会议与日期尽量写全。",
  award: "只放与目标岗位相关、有区分度的奖项。",
  summary: "1～3 句，写和岗位相关、有事实支撑的特质，例如「坚持写技术博客，累计 40 篇」。换行分段。",
};

interface Props {
  doc: RuyeDocument;
  module: Module;
  onChange: (doc: RuyeDocument) => void;
  /** 删除类操作：交给上层记录撤销 */
  onRemove: (doc: RuyeDocument, what: string) => void;
  onError: (msg: string) => void;
  onRemoveModule: () => void;
}

export function ModuleEditor({ doc, module: m, onChange, onRemove, onError, onRemoveModule }: Props) {
  // 展开的是哪个条目：写作建议里点一条，会直接展开对应条目
  const firstItem = "items" in m.data && m.data.items.length === 1 ? (m.data.items[0] as { id: string }).id : null;
  const [openItem, setOpenItem] = useState<string | null>(firstItem);
  useEffect(() => setOpenItem(firstItem), [m.id]);
  const focusItem = (id: string) => {
    setOpenItem(id);
    requestAnimationFrame(() => document.getElementById(`item-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  // 写作建议：跟条目有关的标在条目卡片上，其余（联系方式、「精通」过多等）放在标题下方一行
  const issues = lintDocument(doc).filter((i) => i.moduleId === m.id);
  const patchData = (patch: Record<string, unknown>) => onChange(replaceModule(doc, m.id, (x) => ({ ...x, data: { ...x.data, ...patch } }) as Module));

  return (
    <section className={`module-editor${m.visible ? "" : " is-hidden"}`} id={`module-${m.id}`} data-module={m.id} tabIndex={-1} aria-labelledby={`module-title-${m.id}`}>
      <div className="editor-head">
        <h2 id={`module-title-${m.id}`}>{MODULE_LABELS[m.type]}</h2>
        {!m.visible && <span className="badge">已隐藏，不会出现在简历里</span>}
        <button type="button" className="danger-link" onClick={onRemoveModule} aria-label={`删除模块「${MODULE_LABELS[m.type]}」`}>
          删除模块
        </button>
      </div>
      {MODULE_HINTS[m.type] && <p className="editor-sub">{MODULE_HINTS[m.type]}</p>}
      {(m.type === "work" || m.type === "internship" || m.type === "project" || m.type === "research") && (
        <details className="guide">
          <summary>写法提示</summary>
          <ul>
            {BULLET_GUIDE.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </details>
      )}
      <WritingTips issues={issues} onFocusItem={focusItem} />

      {m.type === "basic_info" && (
        <div className="form-grid">
          <TextField label="姓名" value={m.data.name} onChange={(v) => patchData({ name: v })} placeholder="必填" />
          <TextField label="电话" value={m.data.phone} onChange={(v) => patchData({ phone: v })} type="tel" />
          <TextField label="邮箱" value={m.data.email} onChange={(v) => patchData({ email: v })} type="email" />
          <TextField label="所在城市" value={m.data.location} onChange={(v) => patchData({ location: v })} placeholder="如 天津" />
          <PhotoField value={m.data.photoDataUrl} onChange={(v) => patchData({ photoDataUrl: v })} onError={onError} />
          {/* 不是每份简历都要的资料收在这里；填过的话默认展开 */}
          <details className="guide more-fields" open={!!(m.data.github || m.data.website || m.data.blog || m.data.gender || m.data.birthday) || undefined}>
            <summary>更多资料（GitHub、个人网站、性别、出生年月）</summary>
            <div className="form-grid">
              <TextField label="GitHub" value={m.data.github} onChange={(v) => patchData({ github: v })} placeholder="https://github.com/…" />
              <TextField label="个人网站" value={m.data.website} onChange={(v) => patchData({ website: v })} />
              <TextField label="博客" value={m.data.blog} onChange={(v) => patchData({ blog: v })} />
              <ChoiceField label="性别（可选）" value={m.data.gender} onChange={(v) => patchData({ gender: v })} options={["男", "女"]} />
              <MonthPicker label="出生年月（可选）" value={m.data.birthday} onChange={(v) => patchData({ birthday: v })} related={`${new Date().getFullYear() - 21}-01`} />
              {m.data.birthday && (
                <div className="field-block">
                  <span className="field-label">简历上显示为</span>
                  <div className="seg" role="radiogroup" aria-label="出生年月在简历上显示为" onKeyDown={radioKeys}>
                    {(
                      [
                        ["date", "出生年月"],
                        ["age", ageFrom(m.data.birthday) !== null ? `年龄（${ageFrom(m.data.birthday)} 岁）` : "年龄"],
                      ] as const
                    ).map(([k, label], i) => (
                      <button key={k} type="button" role="radio" aria-checked={(m.data.birthdayAs ?? "date") === k} tabIndex={radioTabIndex((m.data.birthdayAs ?? "date") === k, i, true)} className={(m.data.birthdayAs ?? "date") === k ? "on" : ""} onClick={() => patchData({ birthdayAs: k })}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </details>
        </div>
      )}

      {m.type === "job_intention" && (
        <div className="form-grid">
          <TextField label="岗位" value={m.data.role} onChange={(v) => patchData({ role: v })} placeholder="如 Java 后端实习生" />
          <ChoiceField label="城市" value={m.data.city} onChange={(v) => patchData({ city: v })} placeholder="如 天津 / 北京" options={["北京", "上海", "深圳", "杭州", "广州", "成都", "天津", "不限"]} />
          <ChoiceField
            label="到岗时间"
            value={m.data.availability}
            onChange={(v) => patchData({ availability: v })}
            placeholder="如 2027 年暑期，可实习 6 个月"
            options={["随时到岗", "一周内到岗", "一个月内到岗", `${new Date().getFullYear() + 1} 年暑期`, "可实习 6 个月以上"]}
          />
          <TextField label="期望薪资（一般不建议写）" value={m.data.salary} onChange={(v) => patchData({ salary: v })} />
        </div>
      )}

      {m.type === "summary" && (
        <TextArea
          label="自我评价"
          value={m.data.text}
          onChange={(v) => patchData({ text: v })}
          placeholder="对高并发场景有持续兴趣，实习中独立排查过两次线上慢查询，习惯把排查过程整理成文档。"
        />
      )}

      {m.type === "skills" && <SkillsEditor doc={doc} module={m} onChange={onChange} onRemove={onRemove} />}

      {"items" in m.data && <ItemsEditor doc={doc} module={m as ListModule} issues={issues} onChange={onChange} onRemove={onRemove} open={openItem} setOpen={setOpenItem} />}
    </section>
  );
}

/** 收起时在标题下露出第一条要点，不用展开也知道这段写了什么 */
function excerpt(it: ListItem): string {
  const r = it as unknown as { bullets?: string[]; highlights?: string[]; summary?: string; description?: string };
  const first = [...(r.bullets ?? []), ...(r.highlights ?? [])].find((b) => b.trim() && !/[：:]\s*$/.test(b.trim()));
  return (first ?? r.summary ?? r.description ?? "").trim();
}

/** 写作建议：只显示当前模块的；点一条会展开对应条目 */
/**
 * 模块级写作建议：不属于某个条目的（缺联系方式、「精通」过多……）直接列出；
 * 属于条目的只给一句汇总，点一下展开第一个有建议的条目——建议本身显示在条目卡片里
 */
function WritingTips({ issues, onFocusItem }: { issues: LintIssue[]; onFocusItem: (id: string) => void }) {
  if (issues.length === 0) return null;
  const general = issues.filter((i) => !i.itemId);
  const onItems = issues.filter((i) => i.itemId);
  const firstItem = onItems[0]?.itemId;
  return (
    <section className="writing-tips" aria-label="写作建议">
      {general.map((i, k) => (
        <p key={k} className={`tip ${i.level}`}>
          <i aria-hidden="true" />
          {i.message}
        </p>
      ))}
      {onItems.length > 0 && (
        <p className="tip">
          <i aria-hidden="true" />
          有 {onItems.length} 条写作建议，标在下面对应的条目上。
          {firstItem && (
            <button type="button" className="link-btn" onClick={() => onFocusItem(firstItem)}>
              查看
            </button>
          )}
        </p>
      )}
    </section>
  );
}

function SkillsEditor({ doc, module: m, onChange, onRemove }: { doc: RuyeDocument; module: Extract<Module, { type: "skills" }>; onChange: (d: RuyeDocument) => void; onRemove: (d: RuyeDocument, what: string) => void }) {
  const cats = m.data.categories;
  const notes = m.data.notes ?? [];
  // 两种写法互不影响：改分类时保留描述句，改描述句时保留分类
  const write = (patch: { categories?: SkillCategory[]; notes?: string[] }) =>
    replaceModule(doc, m.id, (x) => ({ ...x, data: { ...(x.data as typeof m.data), ...patch } }) as Module);
  const set = (categories: SkillCategory[]) => write({ categories });
  return (
    <div className="items">
      <section className="skill-section">
        <h3>分类列表</h3>
        <p className="hint">适合列技术栈：「语言」「框架」「中间件」各一行，每类回车添加一项。</p>
        {cats.map((c, i) => (
          <div key={c.id} className="skill-row">
            <input aria-label="类别名" className="skill-name" value={c.name} placeholder="类别" onChange={(e) => onChange(set(cats.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x))))} />
            <TagInput label="" value={c.items} onChange={(items) => onChange(set(cats.map((x) => (x.id === c.id ? { ...x, items } : x))))} />
            <div className="row-actions">
              <button type="button" aria-label="上移类别" disabled={i === 0} onClick={() => onChange(set(swap(cats, i, i - 1)))}>
                ↑
              </button>
              <button type="button" aria-label="下移类别" disabled={i === cats.length - 1} onClick={() => onChange(set(swap(cats, i, i + 1)))}>
                ↓
              </button>
              <button type="button" aria-label={`删除类别 ${c.name}`} onClick={() => onRemove(set(cats.filter((x) => x.id !== c.id)), `技能类别「${c.name || "未命名"}」`)}>
                ×
              </button>
            </div>
          </div>
        ))}
        <button type="button" className="add-btn" onClick={() => onChange(set([...cats, { id: newId("skill"), name: "", items: [] }]))}>
          ＋ 添加技能类别
        </button>
      </section>

      <section className="skill-section">
        <h3>描述句</h3>
        <p className="hint">
          每行一句，写清楚掌握到什么程度。句首的「精通 / 熟悉 / 了解」会自动加粗；写成「JVM：……」会加粗冒号前的关键词。排在分类列表之后。
        </p>
        <BulletList
          label="描述句"
          value={notes}
          onChange={(v) => onChange(write({ notes: v }))}
          placeholder="熟悉 Java 集合与并发编程，理解 AQS、线程池的工作原理"
        />
      </section>
    </div>
  );
}

/** 条目卡片标题旁的时间，与简历上的写法一致：2026.04 – 2026.07 */
function itemWhen(it: Record<string, unknown>): string {
  const f = (v: unknown) => (typeof v === "string" ? v.replace("-", ".") : "");
  if (typeof it.date === "string") return f(it.date);
  const a = f(it.start);
  const b = f(it.end);
  return a || b ? `${a}${a && b ? " – " : ""}${b}` : "";
}

function swap<T>(arr: T[], i: number, j: number): T[] {
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function ItemsEditor({
  doc,
  module: m,
  issues,
  onChange,
  onRemove,
  open,
  setOpen,
}: {
  doc: RuyeDocument;
  module: ListModule;
  issues: LintIssue[];
  onChange: (d: RuyeDocument) => void;
  onRemove: (d: RuyeDocument, what: string) => void;
  open: string | null;
  setOpen: (id: string | null) => void;
}) {
  const items = m.data.items as ListItem[];
  const patch = (itemId: string, p: Record<string, unknown>) => onChange(updateItem(doc, m.id, itemId, p));
  // 技术栈建议：这份简历里各段经历写过的技术，按出现次数排
  const techSuggest = (() => {
    const count = new Map<string, number>();
    for (const mod of doc.modules)
      if ("items" in mod.data)
        for (const x of mod.data.items as { techStack?: string[] }[]) for (const t of x.techStack ?? []) count.set(t, (count.get(t) ?? 0) + 1);
    return [...count].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  })();

  return (
    <div className="items item-list">
      {items.length === 0 && <p className="hint">还没有条目。</p>}
      {items.map((it, i) => {
        const expanded = open === it.id;
        const tips = issues.filter((x) => x.itemId === it.id);
        const when = itemWhen(it as unknown as Record<string, unknown>);
        return (
          <section key={it.id} id={`item-${it.id}`} className={`item-card${expanded ? " open" : ""}`}>
            <header>
              <button type="button" className="item-toggle" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : it.id)}>
                <span className="chev" aria-hidden="true" />
                <span className="item-head-text">
                  <span className="item-title">{itemTitle(it)}</span>
                  {!expanded && excerpt(it) && <span className="item-excerpt">{excerpt(it)}</span>}
                  {(when || tips.length > 0) && (
                    <span className="item-meta">
                      {when && <span className="item-when">{when}</span>}
                      {tips.length > 0 && (
                        <span className={`item-tip-count${tips.some((t) => t.level === "warn") ? " warn" : ""}`}>{tips.length} 条写作建议</span>
                      )}
                    </span>
                  )}
                </span>
              </button>
              <div className="row-actions">
                <button type="button" aria-label="上移条目" disabled={i === 0} onClick={() => onChange(moveItem(doc, m.id, it.id, -1))}>
                  <Icon name="up" size={14} />
                </button>
                <button type="button" aria-label="下移条目" disabled={i === items.length - 1} onClick={() => onChange(moveItem(doc, m.id, it.id, 1))}>
                  <Icon name="down" size={14} />
                </button>
                <button
                  type="button"
                  aria-label={`复制 ${itemTitle(it)}`}
                  title="复制一份，改成另一段经历"
                  onClick={() => {
                    const copy = { ...structuredClone(it), id: newId() } as ListItem;
                    onChange(replaceModule(doc, m.id, (x) => {
                      const list = [...((x.data as { items: ListItem[] }).items)];
                      list.splice(i + 1, 0, copy);
                      return { ...x, data: { ...x.data, items: list } } as Module;
                    }));
                    setOpen(copy.id);
                  }}
                >
                  <Icon name="copy" size={14} />
                </button>
                <button type="button" aria-label={`删除 ${itemTitle(it)}`} onClick={() => onRemove(removeItem(doc, m.id, it.id), `「${itemTitle(it)}」`)}>
                  <Icon name="close" size={14} />
                </button>
              </div>
            </header>
            {expanded && tips.length > 0 && (
              <ul className="item-tips" aria-label="这一条的写作建议">
                {tips.map((t, k) => (
                  <li key={k} className={t.level}>
                    {t.message}
                  </li>
                ))}
              </ul>
            )}
            {expanded && <div className="form-grid">{itemFields(m.type, it as unknown as Record<string, any>, (p) => patch(it.id, p), techSuggest)}</div>}
          </section>
        );
      })}
      <button
        type="button"
        className="add-btn"
        onClick={() => {
          const r = addItem(doc, m.id);
          onChange(r.doc);
          setOpen(r.itemId);
        }}
      >
        ＋ 添加{MODULE_LABELS[m.type].replace(/经历|情况|发表|背景/, "")}
      </button>
    </div>
  );
}

const BULLET_HINT = "动作 + 技术 + 结果，例如：引入二级缓存，将 P99 从 320ms 降到 140ms";

function itemFields(type: ListModule["type"], it: Record<string, any>, set: (p: Record<string, unknown>) => void, techSuggest: string[] = []) {
  const dates = (presentOk = true) => <DateRange start={it.start} end={it.end} onStart={(v) => set({ start: v })} onEnd={(v) => set({ end: v })} presentOk={presentOk} />;
  switch (type) {
    case "education":
      return (
        <>
          <TextField label="学校" value={it.school} onChange={(v) => set({ school: v })} />
          <TextField label="专业" value={it.major} onChange={(v) => set({ major: v })} />
          <ChoiceField label="学历" value={it.degree} onChange={(v) => set({ degree: v })} options={["专科", "本科", "硕士", "博士"]} />
          {dates()}
          <BulletList label="亮点（成绩、课程、奖学金）" value={it.highlights ?? []} onChange={(v) => set({ highlights: v })} placeholder="GPA 3.7 / 4.0（专业前 10%）" />
        </>
      );
    case "work":
    case "internship":
      return (
        <>
          <TextField label="公司 / 组织" value={it.org} onChange={(v) => set({ org: v })} />
          <TextField label="岗位" value={it.title} onChange={(v) => set({ title: v })} />
          {dates()}
          <TextArea label="一句话背景（可选）" value={it.summary} onChange={(v) => set({ summary: v })} placeholder="如 电商订单与优惠券服务" />
          <TagInput label="技术栈" value={it.techStack} onChange={(v) => set({ techStack: v })} suggest={techSuggest} />
          <BulletList label="职责与成果" value={it.bullets ?? []} onChange={(v) => set({ bullets: v })} placeholder={BULLET_HINT} />
        </>
      );
    case "project":
      return (
        <>
          <TextField label="项目名" value={it.name} onChange={(v) => set({ name: v })} />
          <ChoiceField label="角色" value={it.role} onChange={(v) => set({ role: v })} options={["独立开发", "后端负责人", "核心开发", "团队成员"]} />
          {dates()}
          <TextField label="链接（可选）" value={it.url} onChange={(v) => set({ url: v })} placeholder="https://…" wide />
          <TextArea label="一句话简介（可选）" value={it.summary} onChange={(v) => set({ summary: v })} />
          <TagInput label="技术栈" value={it.techStack} onChange={(v) => set({ techStack: v })} suggest={techSuggest} />
          <BulletList label="做了什么、结果如何" value={it.bullets ?? []} onChange={(v) => set({ bullets: v })} placeholder={BULLET_HINT} />
        </>
      );
    case "research":
      return (
        <>
          <TextField label="课题" value={it.name} onChange={(v) => set({ name: v })} />
          <TextField label="实验室 / 单位" value={it.org} onChange={(v) => set({ org: v })} />
          {dates()}
          <BulletList label="工作与成果" value={it.bullets ?? []} onChange={(v) => set({ bullets: v })} />
        </>
      );
    case "paper":
      return (
        <>
          <TextField label="论文题目" value={it.title} onChange={(v) => set({ title: v })} wide />
          <TextField label="作者" value={it.authors} onChange={(v) => set({ authors: v })} />
          <TextField label="期刊 / 会议" value={it.venue} onChange={(v) => set({ venue: v })} />
          <MonthPicker label="日期" value={it.date} onChange={(v) => set({ date: v })} />
          <TextField label="链接（可选）" value={it.url} onChange={(v) => set({ url: v })} />
        </>
      );
    case "award":
      return (
        <>
          <TextField label="奖项" value={it.name} onChange={(v) => set({ name: v })} wide />
          <TextField label="颁发方（可选）" value={it.issuer} onChange={(v) => set({ issuer: v })} />
          <MonthPicker label="日期" value={it.date} onChange={(v) => set({ date: v })} />
          <TextField label="说明（可选）" value={it.description} onChange={(v) => set({ description: v })} wide />
        </>
      );
  }
}

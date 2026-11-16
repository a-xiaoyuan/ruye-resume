// 中栏：当前模块的表单
import { useState } from "react";
import { lintDocument, MODULE_LABELS, newId, type Module, type RuyeDocument, type SkillCategory } from "../../../../packages/schema/src/index.ts";
import { addItem, itemTitle, moveItem, removeItem, replaceModule, updateItem, type ListItem, type ListModule } from "../doc-ops.ts";
import { BulletList, DateField, PhotoField, TagInput, TextArea, TextField } from "./fields.tsx";

const MODULE_HINTS: Record<string, string> = {
  basic_info: "姓名 + 求职意向会拼成文档标题。照片只在本机处理，不会上传。",
  job_intention: "岗位与城市写具体；期望薪资一般不建议写。",
  skills: "两种写法：分类列表适合列技术栈，描述句适合写掌握深度。可以只用一种，也可以混用。",
  education: "校招建议把教育放在前面；亮点写 GPA、专业排名、奖学金。",
  work: "每条要点尽量是「动作 + 技术 + 可量化结果」。要点里单独一行写「个人职责：」「技术亮点：」会成为分块小标题；「缓存优化：……」会加粗冒号前的短标题。",
  internship: "实习经历按时间倒序；技术栈用标签，回车添加。要点里单独一行写「个人职责：」「技术亮点：」会成为分块小标题；「缓存优化：……」会加粗冒号前的短标题。",
  project: "突出你负责的部分和结果，链接放可访问的仓库或演示地址。要点里单独一行写「个人职责：」「技术亮点：」会成为分块小标题；「缓存优化：……」会加粗冒号前的短标题。",
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
  const patchData = (patch: Record<string, unknown>) => onChange(replaceModule(doc, m.id, (x) => ({ ...x, data: { ...x.data, ...patch } }) as Module));

  return (
    <div className="module-editor">
      <div className="editor-head">
        <h2>{MODULE_LABELS[m.type]}</h2>
        {!m.visible && <span className="badge">已隐藏，不会出现在简历里</span>}
        <button type="button" className="danger-link" onClick={onRemoveModule}>
          删除模块
        </button>
      </div>
      {MODULE_HINTS[m.type] && <p className="editor-sub">{MODULE_HINTS[m.type]}</p>}
      <WritingTips doc={doc} module={m} />

      {m.type === "basic_info" && (
        <div className="form-grid">
          <TextField label="姓名" value={m.data.name} onChange={(v) => patchData({ name: v })} placeholder="必填" />
          <TextField label="电话" value={m.data.phone} onChange={(v) => patchData({ phone: v })} />
          <TextField label="邮箱" value={m.data.email} onChange={(v) => patchData({ email: v })} type="email" />
          <TextField label="所在城市" value={m.data.location} onChange={(v) => patchData({ location: v })} placeholder="如 天津" />
          <TextField label="GitHub" value={m.data.github} onChange={(v) => patchData({ github: v })} placeholder="https://github.com/…" />
          <TextField label="个人网站" value={m.data.website} onChange={(v) => patchData({ website: v })} />
          <TextField label="博客" value={m.data.blog} onChange={(v) => patchData({ blog: v })} />
          <TextField label="性别（可选）" value={m.data.gender} onChange={(v) => patchData({ gender: v })} />
          <TextField label="出生年月（可选）" value={m.data.birthday} onChange={(v) => patchData({ birthday: v })} placeholder="2005-06" />
          <PhotoField value={m.data.photoDataUrl} onChange={(v) => patchData({ photoDataUrl: v })} onError={onError} />
        </div>
      )}

      {m.type === "job_intention" && (
        <div className="form-grid">
          <TextField label="岗位" value={m.data.role} onChange={(v) => patchData({ role: v })} placeholder="如 Java 后端实习生" />
          <TextField label="城市" value={m.data.city} onChange={(v) => patchData({ city: v })} placeholder="如 天津 / 北京" />
          <TextField label="到岗时间" value={m.data.availability} onChange={(v) => patchData({ availability: v })} placeholder="如 2027 年暑期，可实习 6 个月" />
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

      {"items" in m.data && <ItemsEditor doc={doc} module={m as ListModule} onChange={onChange} onRemove={onRemove} />}
    </div>
  );
}

/** 写作建议：只显示当前模块的；可以收起 */
function WritingTips({ doc, module: m }: { doc: RuyeDocument; module: Module }) {
  const [open, setOpen] = useState(true);
  const issues = lintDocument(doc).filter((i) => i.moduleId === m.id);
  if (issues.length === 0) return null;
  const items = "items" in m.data ? (m.data.items as ListItem[]) : [];
  return (
    <section className={`writing-tips${issues.some((i) => i.level === "warn") ? " warn" : ""}`} aria-label="写作建议">
      <button type="button" className="writing-tips-head" aria-expanded={open} onClick={() => setOpen((x) => !x)}>
        写作建议 · {issues.length} 条<span>{open ? "收起" : "展开"}</span>
      </button>
      {open && (
        <ul>
          {issues.map((i, k) => {
            const it = i.itemId ? items.find((x) => x.id === i.itemId) : undefined;
            return (
              <li key={k}>
                {it && <b>{itemTitle(it)}：</b>}
                {i.message}
              </li>
            );
          })}
        </ul>
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

function swap<T>(arr: T[], i: number, j: number): T[] {
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function ItemsEditor({ doc, module: m, onChange, onRemove }: { doc: RuyeDocument; module: ListModule; onChange: (d: RuyeDocument) => void; onRemove: (d: RuyeDocument, what: string) => void }) {
  const items = m.data.items as ListItem[];
  const [open, setOpen] = useState<string | null>(items.length === 1 ? items[0].id : null);
  const patch = (itemId: string, p: Record<string, unknown>) => onChange(updateItem(doc, m.id, itemId, p));

  return (
    <div className="items">
      {items.length === 0 && <p className="hint">还没有条目。</p>}
      {items.map((it, i) => {
        const expanded = open === it.id;
        return (
          <section key={it.id} className={`item-card${expanded ? " open" : ""}`}>
            <header>
              <button type="button" className="item-toggle" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : it.id)}>
                <span className="chev">{expanded ? "▾" : "▸"}</span>
                {itemTitle(it)}
              </button>
              <div className="row-actions">
                <button type="button" aria-label="上移条目" disabled={i === 0} onClick={() => onChange(moveItem(doc, m.id, it.id, -1))}>
                  ↑
                </button>
                <button type="button" aria-label="下移条目" disabled={i === items.length - 1} onClick={() => onChange(moveItem(doc, m.id, it.id, 1))}>
                  ↓
                </button>
                <button type="button" aria-label={`删除 ${itemTitle(it)}`} onClick={() => onRemove(removeItem(doc, m.id, it.id), `「${itemTitle(it)}」`)}>
                  ×
                </button>
              </div>
            </header>
            {expanded && <div className="form-grid">{itemFields(m.type, it as unknown as Record<string, any>, (p) => patch(it.id, p))}</div>}
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

function itemFields(type: ListModule["type"], it: Record<string, any>, set: (p: Record<string, unknown>) => void) {
  const dates = (presentOk = true) => (
    <>
      <DateField label="开始" value={it.start} onChange={(v) => set({ start: v })} />
      <DateField label="结束" value={it.end} onChange={(v) => set({ end: v })} allowPresent={presentOk} />
    </>
  );
  switch (type) {
    case "education":
      return (
        <>
          <TextField label="学校" value={it.school} onChange={(v) => set({ school: v })} />
          <TextField label="专业" value={it.major} onChange={(v) => set({ major: v })} />
          <TextField label="学历" value={it.degree} onChange={(v) => set({ degree: v })} placeholder="本科 / 硕士" />
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
          <TagInput label="技术栈" value={it.techStack} onChange={(v) => set({ techStack: v })} />
          <BulletList label="职责与成果" value={it.bullets ?? []} onChange={(v) => set({ bullets: v })} placeholder={BULLET_HINT} />
        </>
      );
    case "project":
      return (
        <>
          <TextField label="项目名" value={it.name} onChange={(v) => set({ name: v })} />
          <TextField label="角色" value={it.role} onChange={(v) => set({ role: v })} placeholder="如 独立开发 / 后端负责人" />
          {dates()}
          <TextField label="链接（可选）" value={it.url} onChange={(v) => set({ url: v })} placeholder="https://…" wide />
          <TextArea label="一句话简介（可选）" value={it.summary} onChange={(v) => set({ summary: v })} />
          <TagInput label="技术栈" value={it.techStack} onChange={(v) => set({ techStack: v })} />
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
          <DateField label="日期" value={it.date} onChange={(v) => set({ date: v })} />
          <TextField label="链接（可选）" value={it.url} onChange={(v) => set({ url: v })} />
        </>
      );
    case "award":
      return (
        <>
          <TextField label="奖项" value={it.name} onChange={(v) => set({ name: v })} wide />
          <TextField label="颁发方（可选）" value={it.issuer} onChange={(v) => set({ issuer: v })} />
          <DateField label="日期" value={it.date} onChange={(v) => set({ date: v })} />
          <TextField label="说明（可选）" value={it.description} onChange={(v) => set({ description: v })} wide />
        </>
      );
  }
}

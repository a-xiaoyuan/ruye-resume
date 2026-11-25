// Markdown 导入/导出（对称格式，见 docs/DESIGN.md §9）。
// 导入是「尽力而为」：## 为模块，### 为条目，认不出的段落放进最近条目的 bullets。

import { MODULE_LABELS, PAGE_MODES, TEMPLATE_IDS, THEME_IDS, type Module, type ModuleType, type PageMode, type RuyeDocument, type TemplateId, type ThemeId } from "./types.ts";
import { normalizeDate, PRESENT } from "./validate.ts";

const SEP = " · ";
const LIST_SPLIT = /[、,，;；]\s*/;

function displayDate(d: string | undefined): string {
  if (!d) return "";
  if (d === PRESENT) return d;
  return d.replace(/-/g, ".");
}

function dateRange(start?: string, end?: string): string {
  const a = displayDate(start);
  const b = displayDate(end);
  if (!a && !b) return "";
  return `${a} - ${b}`.trim();
}

function joinTitle(...parts: (string | undefined)[]): string {
  return parts.filter((p): p is string => !!p && p.trim() !== "").join(SEP);
}

const BASIC_FIELDS: [keyof BasicFields, string][] = [
  ["phone", "电话"],
  ["email", "邮箱"],
  ["location", "地点"],
  ["gender", "性别"],
  ["birthday", "生日"],
  ["website", "网站"],
  ["github", "GitHub"],
  ["blog", "博客"],
];
type BasicFields = { phone?: string; email?: string; location?: string; gender?: string; birthday?: string; website?: string; github?: string; blog?: string };

const INTENT_FIELDS: [string, string][] = [
  ["role", "岗位"],
  ["city", "城市"],
  ["availability", "到岗"],
  ["salary", "期望薪资"],
];

function kv(label: string, value: string | undefined): string[] {
  return value && value.trim() !== "" ? [`- ${label}：${value}`] : [];
}

export function toMarkdown(doc: RuyeDocument): string {
  const out: string[] = [];
  out.push("---", `title: ${doc.meta.title}`, `template: ${doc.layout.templateId}`, `pageMode: ${doc.layout.pageMode}`);
  if (doc.layout.theme) out.push(`theme: ${doc.layout.theme}`);
  out.push("---", "");

  for (const m of doc.modules) {
    const hidden = m.visible ? "" : " <!-- hidden -->";
    if (m.type === "basic_info") {
      out.push(`# ${m.data.name}${hidden}`);
      // 照片用标准 Markdown 图片语法内嵌（data URL），文件自包含，普通阅读器里也能看到
      if (m.data.photoDataUrl) out.push(`![照片](${m.data.photoDataUrl})`);
      for (const [k, label] of BASIC_FIELDS) out.push(...kv(label, m.data[k]));
      for (const l of m.data.customLinks ?? []) out.push(`- ${l.label}：${l.url}`);
      out.push("");
      continue;
    }
    out.push(`## ${MODULE_LABELS[m.type]}${hidden}`);
    switch (m.type) {
      case "job_intention":
        for (const [k, label] of INTENT_FIELDS) out.push(...kv(label, (m.data as Record<string, string | undefined>)[k]));
        break;
      case "education":
        for (const it of m.data.items) {
          out.push(`### ${joinTitle(it.school, it.major, it.degree)}`);
          const r = dateRange(it.start, it.end);
          if (r) out.push(r);
          for (const h of it.highlights) out.push(`- ${h}`);
        }
        break;
      case "work":
      case "internship":
        for (const it of m.data.items) {
          out.push(`### ${joinTitle(it.org, it.title)}`);
          const r = dateRange(it.start, it.end);
          if (r) out.push(r);
          out.push(...kv("简介", it.summary));
          if (it.techStack?.length) out.push(`- 技术栈：${it.techStack.join("、")}`);
          for (const b of it.bullets) out.push(`- ${b}`);
        }
        break;
      case "project":
        for (const it of m.data.items) {
          out.push(`### ${joinTitle(it.name, it.role)}`);
          const r = dateRange(it.start, it.end);
          if (r) out.push(r);
          out.push(...kv("链接", it.url));
          out.push(...kv("简介", it.summary));
          if (it.techStack?.length) out.push(`- 技术栈：${it.techStack.join("、")}`);
          for (const b of it.bullets) out.push(`- ${b}`);
        }
        break;
      case "skills":
        // 分类名加粗，和描述句区分开：导入时据此还原，描述句里带冒号也不会被误认成分类
        for (const c of m.data.categories) out.push(`- **${c.name}**：${c.items.join("、")}`);
        for (const n of m.data.notes ?? []) if (n.trim() !== "") out.push(`- ${n}`);
        break;
      case "research":
        for (const it of m.data.items) {
          out.push(`### ${joinTitle(it.name, it.org)}`);
          const r = dateRange(it.start, it.end);
          if (r) out.push(r);
          for (const b of it.bullets) out.push(`- ${b}`);
        }
        break;
      case "paper":
        for (const it of m.data.items) {
          out.push(`### ${it.title}`);
          out.push(...kv("期刊/会议", it.venue), ...kv("作者", it.authors), ...kv("日期", displayDate(it.date)), ...kv("链接", it.url));
        }
        break;
      case "summary":
        for (const line of m.data.text.split("\n")) if (line.trim() !== "") out.push(line.trim());
        break;
      case "award":
        for (const it of m.data.items) {
          out.push(`### ${joinTitle(it.name, it.issuer)}`);
          out.push(...kv("日期", displayDate(it.date)), ...kv("说明", it.description));
        }
        break;
    }
    out.push("");
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

// ---------------------------------------------------------------- 导入

export const HEADING_ALIASES: Record<string, ModuleType> = {
  基本信息: "basic_info",
  个人信息: "basic_info",
  求职意向: "job_intention",
  教育背景: "education",
  教育经历: "education",
  工作经历: "work",
  工作经验: "work",
  实习经历: "internship",
  实习经验: "internship",
  项目经历: "project",
  项目经验: "project",
  专业技能: "skills",
  技能: "skills",
  技术栈: "skills",
  科研经历: "research",
  论文发表: "paper",
  论文: "paper",
  获奖情况: "award",
  荣誉奖项: "award",
  获奖: "award",
  自我评价: "summary",
  个人评价: "summary",
  个人总结: "summary",
  个人优势: "summary",
};

export interface MarkdownImportResult {
  doc: RuyeDocument;
  warnings: string[];
}

const DATE_LINE = /^(\S+?)\s*(?:-|–|—|~|～|至)\s*(\S+)$/;
const KV_LINE = /^([^：:]{1,12})[：:]\s*(.*)$/;

function splitTitle(s: string): string[] {
  return s.split(/\s*[·|｜]\s*/).map((x) => x.trim()).filter(Boolean);
}

function stripHidden(s: string): { text: string; hidden: boolean } {
  const hidden = /<!--\s*hidden\s*-->/.test(s);
  return { text: s.replace(/<!--.*?-->/g, "").trim(), hidden };
}

function parseDateLine(line: string): [string, string] | null {
  const m = line.match(DATE_LINE);
  if (!m) return null;
  const a = normalizeDate(m[1]);
  const b = normalizeDate(m[2]);
  const ok = (d: string) => d === PRESENT || /^\d{4}-\d{2}(-\d{2})?$/.test(d);
  return ok(a) && ok(b) ? [a, b] : null;
}

const BOLD_CATEGORY = /^\*\*(.+?)\*\*\s*[：:]\s*(.*)$/;

/**
 * 技能区每一行是「分类」还是「描述句」：
 * - 新格式（如页导出的文件）分类名加粗：`- **语言**：Java、Python`。只要出现过加粗分类，其余行一律是描述句。
 * - 旧格式没有加粗：`名称：a、b、c` 且内容里没有句读（，。；）时算分类，否则算描述句。
 */
function resolveSkills(lines: { module: Extract<Module, { type: "skills" }>; text: string }[], nextId: () => string): void {
  const strict = lines.some((l) => BOLD_CATEGORY.test(l.text));
  for (const { module, text } of lines) {
    const bold = text.match(BOLD_CATEGORY);
    const kv = bold ? [text, bold[1], bold[2]] : strict ? null : text.match(KV_LINE);
    const isCategory = kv !== null && (bold !== null || !/[，。；;]/.test(kv[2]));
    if (isCategory && kv) {
      module.data.categories.push({ id: nextId(), name: kv[1].trim(), items: kv[2].split(LIST_SPLIT).map((s) => s.trim()).filter(Boolean) });
    } else {
      (module.data.notes ??= []).push(text);
    }
  }
}

export function fromMarkdown(src: string): MarkdownImportResult {
  const warnings: string[] = [];
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  let i = 0;
  let title = "";
  let templateId: TemplateId = "classic";
  let pageMode: PageMode = "fit-a4";
  let theme: ThemeId | undefined;

  if (lines[0]?.trim() === "---") {
    i = 1;
    for (; i < lines.length && lines[i].trim() !== "---"; i++) {
      const m = lines[i].match(/^(\w+):\s*(.*)$/);
      if (!m) continue;
      if (m[1] === "title") title = m[2].trim();
      if (m[1] === "template" && TEMPLATE_IDS.includes(m[2].trim() as TemplateId)) templateId = m[2].trim() as TemplateId;
      if (m[1] === "pageMode" && PAGE_MODES.includes(m[2].trim() as PageMode)) pageMode = m[2].trim() as PageMode;
      if (m[1] === "theme" && THEME_IDS.includes(m[2].trim() as ThemeId)) theme = m[2].trim() as ThemeId;
    }
    i++;
  }

  const modules: Module[] = [];
  const counters: Record<string, number> = {};
  const nextId = (prefix: string) => {
    counters[prefix] = (counters[prefix] ?? 0) + 1;
    return `${prefix}-${counters[prefix]}`;
  };

  let current: Module | null = null;
  const skillLines: { module: Extract<Module, { type: "skills" }>; text: string }[] = [];
  // 位于未识别的 ## 模块之下：其内容整体跳过（已在标题处给出一条警告）
  let skipping = false;
  // 当前条目（指向 data.items 中的最后一项）
  let item: Record<string, unknown> | null = null;

  const basic = (): Extract<Module, { type: "basic_info" }> => {
    let m = modules.find((x) => x.type === "basic_info");
    if (!m) {
      m = { id: "m-basic_info", type: "basic_info", visible: true, data: { name: "" } };
      modules.unshift(m);
    }
    return m as Extract<Module, { type: "basic_info" }>;
  };

  const startModule = (type: ModuleType, hidden: boolean): Module => {
    const existing = modules.find((x) => x.type === type);
    if (existing) return existing;
    const base = { id: `m-${type}`, visible: !hidden };
    let m: Module;
    switch (type) {
      case "basic_info":
        return basic();
      case "job_intention":
        m = { ...base, type, data: {} };
        break;
      case "skills":
        m = { ...base, type, data: { categories: [] } };
        break;
      case "summary":
        m = { ...base, type, data: { text: "" } };
        break;
      default:
        m = { ...base, type, data: { items: [] } } as Module;
    }
    modules.push(m);
    return m;
  };

  const startItem = (heading: string) => {
    if (!current || current.type === "basic_info" || current.type === "job_intention" || current.type === "skills" || current.type === "summary") {
      warnings.push(`「${heading}」不属于任何经历类模块，已忽略`);
      item = null;
      return;
    }
    const parts = splitTitle(heading);
    const id = nextId(current.type);
    let it: Record<string, unknown>;
    switch (current.type) {
      case "education":
        it = { id, school: parts[0] ?? "", major: parts[1], degree: parts[2], start: "", end: "", highlights: [] };
        break;
      case "work":
      case "internship":
        it = { id, org: parts[0] ?? "", title: parts[1] ?? "", start: "", end: "", bullets: [] };
        break;
      case "project":
        it = { id, name: parts[0] ?? "", role: parts[1], bullets: [] };
        break;
      case "research":
        it = { id, name: parts[0] ?? "", org: parts[1], bullets: [] };
        break;
      case "paper":
        it = { id, title: heading };
        break;
      case "award":
        it = { id, name: parts[0] ?? "", issuer: parts[1] };
        break;
    }
    for (const k of Object.keys(it)) if (it[k] === undefined) delete it[k];
    (current.data as { items: unknown[] }).items.push(it);
    item = it;
  };

  const bulletKey = (m: Module) => (m.type === "education" ? "highlights" : "bullets");

  const addBullet = (text: string) => {
    if (!current) {
      warnings.push(`无法归属的内容：「${text}」`);
      return;
    }
    if (current.type === "basic_info") {
      const kvm = text.match(KV_LINE);
      if (!kvm) {
        warnings.push(`基本信息中无法识别：「${text}」`);
        return;
      }
      const field = BASIC_FIELDS.find(([, label]) => label.toLowerCase() === kvm[1].trim().toLowerCase());
      if (field) (current.data as Record<string, unknown>)[field[0]] = kvm[2].trim();
      else (current.data.customLinks ??= []).push({ label: kvm[1].trim(), url: kvm[2].trim() });
      return;
    }
    if (current.type === "job_intention") {
      const kvm = text.match(KV_LINE);
      const field = kvm && INTENT_FIELDS.find(([, label]) => label === kvm[1].trim());
      if (kvm && field) (current.data as Record<string, unknown>)[field[0]] = kvm[2].trim();
      else warnings.push(`求职意向中无法识别：「${text}」`);
      return;
    }
    if (current.type === "summary") {
      current.data.text = current.data.text ? `${current.data.text}\n${text}` : text;
      return;
    }
    if (current.type === "skills") {
      // 先收集，整个文件读完再判断是分类还是描述句（见 resolveSkills）
      skillLines.push({ module: current, text });
      return;
    }
    if (!item) {
      warnings.push(`「${MODULE_LABELS[current.type]}」中没有条目标题（###），已忽略：「${text}」`);
      return;
    }
    const kvm = text.match(KV_LINE);
    if (kvm) {
      const label = kvm[1].trim();
      const value = kvm[2].trim();
      const set = (k: string, v: unknown) => {
        item![k] = v;
      };
      const t = current.type;
      if ((label === "简介" || label === "项目简介" || label === "项目介绍") && (t === "work" || t === "internship" || t === "project")) return set("summary", value);
      if (label === "技术栈" && (t === "work" || t === "internship" || t === "project")) return set("techStack", value.split(LIST_SPLIT).filter(Boolean));
      if (label === "链接" && (t === "project" || t === "paper")) return set("url", value);
      if (label === "期刊/会议" && t === "paper") return set("venue", value);
      if (label === "作者" && t === "paper") return set("authors", value);
      if (label === "日期" && (t === "paper" || t === "award")) return set("date", normalizeDate(value));
      if (label === "说明" && t === "award") return set("description", value);
    }
    const key = bulletKey(current);
    if (current.type === "paper" || current.type === "award") {
      // 这两类没有 bullets：追加到描述
      const k = current.type === "award" ? "description" : "venue";
      item[k] = item[k] ? `${item[k]}；${text}` : text;
      return;
    }
    (item[key] as string[]).push(text);
  };

  for (; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (line === "") continue;

    let m: RegExpMatchArray | null;
    if (skipping && !/^#{1,2}\s/.test(line)) continue;
    skipping = false;
    // 图片：基本信息里的内嵌图片还原成照片；远程图片不下载（简历内容不出浏览器），给出提示
    if ((m = line.match(/^!\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)$/))) {
      const src = m[1];
      const cur = current as Module | null;
      if (cur?.type !== "basic_info") warnings.push("图片只能放在姓名（# 标题）下方作为照片，其他位置的图片已忽略");
      else if (!/^data:image\/(png|jpe?g|gif|webp);base64,/.test(src)) warnings.push(`照片只支持内嵌图片（data:image/…;base64），不会下载远程图片，已忽略：${src.slice(0, 60)}`);
      else cur.data.photoDataUrl = src;
      continue;
    }
    if ((m = line.match(/^#\s+(.*)$/))) {
      const { text, hidden } = stripHidden(m[1]);
      const b = basic();
      b.data.name = text;
      b.visible = !hidden;
      current = b;
      item = null;
    } else if ((m = line.match(/^##\s+(.*)$/))) {
      const { text, hidden } = stripHidden(m[1]);
      const type = HEADING_ALIASES[text];
      if (!type) {
        warnings.push(`未识别的模块标题「${text}」，其内容已跳过`);
        current = null;
        skipping = true;
      } else current = startModule(type, hidden);
      item = null;
    } else if ((m = line.match(/^###\s+(.*)$/))) {
      startItem(m[1].trim());
    } else if ((m = line.match(/^[-*+]\s+(.*)$/))) {
      addBullet(m[1].trim());
    } else {
      // item / current 在闭包里被赋值，TS 的控制流分析会误判为 never，这里显式标注
      const it = item as Record<string, unknown> | null;
      const cur = current as Module | null;
      const range = it ? parseDateLine(line) : null;
      if (range && it && cur && cur.type !== "paper" && cur.type !== "award" && !it.start) {
        it.start = range[0];
        it.end = range[1];
      } else addBullet(line);
    }
  }

  resolveSkills(skillLines, () => nextId("skill"));

  const info = basic();
  const intent = modules.find((x) => x.type === "job_intention");
  const role = intent && intent.type === "job_intention" ? intent.data.role : undefined;
  const doc: RuyeDocument = {
    version: 1,
    meta: { title: title || [info.data.name, role].filter(Boolean).join("-") || "简历", locale: "zh-CN", updatedAt: new Date().toISOString() },
    layout: theme ? { templateId, pageMode, theme } : { templateId, pageMode },
    modules,
  };
  return { doc, warnings };
}

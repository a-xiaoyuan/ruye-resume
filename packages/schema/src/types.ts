// 如页（Ruye）文档模型。所有编辑、导入导出、排版都以 RuyeDocument 为唯一事实来源。

export type PageMode = "standard" | "fit-a4" | "continuous";
export type TemplateId = "classic" | "minimal" | "elegant" | "timeline" | "campus-serif" | "social-sans" | "split-compact";

export type ThemeId = "ink" | "teal" | "wine" | "graphite" | "violet" | "amber";

export const PAGE_MODES: readonly PageMode[] = ["standard", "fit-a4", "continuous"];
export const THEME_IDS: readonly ThemeId[] = ["ink", "teal", "wine", "violet", "amber", "graphite"];

/**
 * 主题色板（主色 + 辅色）。完整色板（含亮色、浅底）定义在 packages/templates/typst/common.typ 的 palettes，
 * 两处的 primary / secondary 需保持一致。
 */
export const THEMES: Record<ThemeId, { label: string; accent: string; secondary: string }> = {
  ink: { label: "海蓝", accent: "#1d3b8b", secondary: "#2f6fe4" },
  teal: { label: "青碧", accent: "#0e5f5c", secondary: "#12a594" },
  wine: { label: "胭脂", accent: "#8c1d40", secondary: "#d1365f" },
  violet: { label: "紫藤", accent: "#4c1d95", secondary: "#7c3aed" },
  amber: { label: "琥珀", accent: "#8a3b0b", secondary: "#d97706" },
  graphite: { label: "石墨", accent: "#1f2937", secondary: "#475569" },
};
export const TEMPLATE_IDS: readonly TemplateId[] = ["classic", "minimal", "elegant", "timeline", "campus-serif", "social-sans", "split-compact"];

export interface RuyeDocument {
  version: 1;
  meta: {
    title: string;
    locale: "zh-CN";
    updatedAt: string;
    /** 备注名，只在「我的简历」列表里显示，用来区分投不同岗位的几份，如「投字节」。不出现在 PDF 里 */
    alias?: string;
  };
  layout: {
    templateId: TemplateId;
    pageMode: PageMode;
    /** 主题色，缺省为 ink */
    theme?: ThemeId;
  };
  modules: Module[];
  /** 为以后的功能预留（例如 AI 建议），v1 UI 不使用 */
  extensions?: Record<string, unknown>;
}

export interface ModuleBase {
  id: string;
  visible: boolean;
}

export interface BasicInfoModule extends ModuleBase {
  type: "basic_info";
  data: {
    name: string;
    photoDataUrl?: string;
    gender?: string;
    birthday?: string;
    phone?: string;
    email?: string;
    location?: string;
    website?: string;
    github?: string;
    blog?: string;
    customLinks?: { label: string; url: string }[];
  };
}

export interface JobIntentionModule extends ModuleBase {
  type: "job_intention";
  data: {
    role?: string;
    city?: string;
    availability?: string;
    salary?: string;
  };
}

export interface EducationItem {
  id: string;
  school: string;
  degree?: string;
  major?: string;
  start: string;
  end: string;
  highlights: string[];
}

export interface ExperienceItem {
  id: string;
  org: string;
  title: string;
  start: string;
  end: string;
  summary?: string;
  techStack?: string[];
  bullets: string[];
}

export interface ProjectItem {
  id: string;
  name: string;
  role?: string;
  start?: string;
  end?: string;
  url?: string;
  summary?: string;
  techStack?: string[];
  bullets: string[];
}

export interface SkillCategory {
  id: string;
  name: string;
  items: string[];
}

export interface ResearchItem {
  id: string;
  name: string;
  org?: string;
  start?: string;
  end?: string;
  bullets: string[];
}

export interface PaperItem {
  id: string;
  title: string;
  venue?: string;
  date?: string;
  authors?: string;
  url?: string;
}

export interface AwardItem {
  id: string;
  name: string;
  issuer?: string;
  date?: string;
  description?: string;
}

export interface EducationModule extends ModuleBase { type: "education"; data: { items: EducationItem[] } }
export interface WorkModule extends ModuleBase { type: "work"; data: { items: ExperienceItem[] } }
export interface InternshipModule extends ModuleBase { type: "internship"; data: { items: ExperienceItem[] } }
export interface ProjectModule extends ModuleBase { type: "project"; data: { items: ProjectItem[] } }
/**
 * 专业技能有两种内容，可以只用一种，也可以混用：
 * - categories：「分类 | 技能、技能」，适合列技术栈
 * - notes：描述句，每条一句，如「熟悉 Java 并发编程，理解 AQS 与线程池原理」。国内技术岗最常见的写法
 * 排版时先列分类，再列描述句。
 */
export interface SkillsModule extends ModuleBase { type: "skills"; data: { categories: SkillCategory[]; notes?: string[] } }
export interface ResearchModule extends ModuleBase { type: "research"; data: { items: ResearchItem[] } }
export interface PaperModule extends ModuleBase { type: "paper"; data: { items: PaperItem[] } }
export interface AwardModule extends ModuleBase { type: "award"; data: { items: AwardItem[] } }
/** 自我评价：一段或几段话，换行分段。建议 1～3 句，写和岗位相关的特质，不写空话 */
export interface SummaryModule extends ModuleBase { type: "summary"; data: { text: string } }

export type Module =
  | BasicInfoModule
  | JobIntentionModule
  | EducationModule
  | WorkModule
  | InternshipModule
  | ProjectModule
  | SkillsModule
  | ResearchModule
  | PaperModule
  | AwardModule
  | SummaryModule;

export type ModuleType = Module["type"];

export const MODULE_TYPES: readonly ModuleType[] = [
  "basic_info",
  "job_intention",
  "education",
  "work",
  "internship",
  "project",
  "skills",
  "research",
  "paper",
  "award",
  "summary",
];

/** 模块显示名（界面和 Markdown 标题共用） */
export const MODULE_LABELS: Record<ModuleType, string> = {
  basic_info: "基本信息",
  job_intention: "求职意向",
  education: "教育背景",
  work: "工作经历",
  internship: "实习经历",
  project: "项目经历",
  skills: "专业技能",
  research: "科研经历",
  paper: "论文发表",
  award: "获奖情况",
  summary: "自我评价",
};

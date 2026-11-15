// 如页（Ruye）文档模型。所有编辑、导入导出、排版都以 RuyeDocument 为唯一事实来源。

export type PageMode = "standard" | "fit-a4" | "continuous";
export type TemplateId = "campus-serif" | "social-sans" | "split-compact";

export type ThemeId = "ink" | "teal" | "wine" | "graphite";

export const PAGE_MODES: readonly PageMode[] = ["standard", "fit-a4", "continuous"];
export const THEME_IDS: readonly ThemeId[] = ["ink", "teal", "wine", "graphite"];

/** 主题色（强调色）。具体色值同时定义在 packages/templates/typst/common.typ，两处需保持一致 */
export const THEMES: Record<ThemeId, { label: string; accent: string }> = {
  ink: { label: "墨蓝", accent: "#1f3d63" },
  teal: { label: "青黛", accent: "#14595a" },
  wine: { label: "绛红", accent: "#7a2a35" },
  graphite: { label: "石墨", accent: "#2e3440" },
};
export const TEMPLATE_IDS: readonly TemplateId[] = ["campus-serif", "social-sans", "split-compact"];

export interface RuyeDocument {
  version: 1;
  meta: {
    title: string;
    locale: "zh-CN";
    updatedAt: string;
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
export interface SkillsModule extends ModuleBase { type: "skills"; data: { categories: SkillCategory[] } }
export interface ResearchModule extends ModuleBase { type: "research"; data: { items: ResearchItem[] } }
export interface PaperModule extends ModuleBase { type: "paper"; data: { items: PaperItem[] } }
export interface AwardModule extends ModuleBase { type: "award"; data: { items: AwardItem[] } }

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
  | AwardModule;

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
};

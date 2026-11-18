// 从 PDF 文本行中智能解析并还原出 RuyeDocument 简历模型
import {
  createEmptyDocument,
  createModule,
  newId,
  recoverDocument,
  validateDocument,
  type AwardItem,
  type EducationItem,
  type ExperienceItem,
  type Module,
  type ModuleType,
  type ProjectItem,
  type ResearchItem,
  type RuyeDocument,
  type SkillCategory,
} from "../../../packages/schema/src/index.ts";
import { normalizeDate, PRESENT } from "../../../packages/schema/src/validate.ts";

export interface PdfParseResult {
  doc: RuyeDocument;
  warnings: string[];
  recognizedModules: string[];
}

interface RawSection {
  type: ModuleType;
  lines: string[];
}

const SECTION_PATTERNS: { type: ModuleType; name: string; pattern: RegExp }[] = [
  { type: "basic_info", name: "基本信息", pattern: /^(?:基本信息|个人信息|个人资料|联系方式|About\s*Me)$/i },
  { type: "job_intention", name: "求职意向", pattern: /^(?:求职意向|期望职位|意向岗位|求职目标|Career\s*Objective)$/i },
  { type: "education", name: "教育背景", pattern: /^(?:教育背景|教育经历|学历背景|学习经历|教育信息|毕业院校|Education)$/i },
  { type: "work", name: "工作经历", pattern: /^(?:工作经历|工作经验|职业经历|从业经历|工作背景|Work\s*Experience|Experience)$/i },
  { type: "internship", name: "实习经历", pattern: /^(?:实习经历|实习经验|实习背景|Internship)$/i },
  { type: "project", name: "项目经历", pattern: /^(?:项目经历|项目经验|主要项目|核心项目|个人项目|开源项目|Projects)$/i },
  { type: "skills", name: "专业技能", pattern: /^(?:专业技能|掌握技能|技能特长|技术栈|核心技能|IT\s*技能|技能清单|Skills)$/i },
  { type: "research", name: "科研经历", pattern: /^(?:科研经历|科研项目|学术研究|Research)$/i },
  { type: "paper", name: "论文发表", pattern: /^(?:论文发表|学术论文|发表论文|学术成果|Publications)$/i },
  { type: "award", name: "荣誉奖项", pattern: /^(?:荣誉奖项|获奖经历|所获奖项|获奖情况|荣誉证书|奖项荣誉|Honors|Awards)$/i },
  { type: "summary", name: "自我评价", pattern: /^(?:自我评价|个人评价|个人总结|个人优势|自我介绍|Summary)$/i },
];

const DATE_RANGE_REGEX = /(?:((?:19|20)\d{2}[年./-]\d{1,2}(?:[月./-]\d{1,2})?|(?:19|20)\d{2}))\s*(?:-|–|—|~|～|至)\s*((?:19|20)\d{2}[年./-]\d{1,2}(?:[月./-]\d{1,2})?|(?:19|20)\d{2}|至今|现在|Present)/i;
const PHONE_REGEX = /(?:(?:\+?86)?\s*)?(1[3-9]\d{9})\b/;
const EMAIL_REGEX = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
const GITHUB_REGEX = /(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_.-]+)/i;
const URL_REGEX = /(https?:\/\/[^\s]+)/;

const MAJOR_DEGREES = ["博士研究生", "硕士研究生", "博士", "硕士", "本科", "学士", "大专", "专科", "MBA"];

/**
 * 将提取出的文本行转换为合法的 RuyeDocument
 */
export function parseResumeFromPdfLines(rawLines: string[], defaultTitle = "导入的简历"): PdfParseResult {
  const warnings: string[] = [];
  const lines = rawLines.map((l) => l.trim()).filter((l) => l.length > 0);

  // 1. 划分文档顶部（通常是基本信息）与各模块区域
  const { headerLines, sections } = splitIntoSections(lines);

  const doc = createEmptyDocument();
  doc.meta.title = defaultTitle;

  // 2. 解析基本信息（从顶部行和可能存在的 basic_info 模块中提取）
  const basicInfoLines = [...headerLines, ...(sections.find((s) => s.type === "basic_info")?.lines ?? [])];
  const basicModule = extractBasicInfo(basicInfoLines, defaultTitle);
  if (basicModule.data.name) {
    doc.meta.title = `${basicModule.data.name}的简历`;
  }

  const resultModules: Module[] = [basicModule];
  const recognizedNames: string[] = ["基本信息"];

  // 3. 逐个解析其他识别到的模块
  for (const sec of sections) {
    if (sec.type === "basic_info") continue;
    if (sec.lines.length === 0) continue;

    switch (sec.type) {
      case "job_intention": {
        const m = extractJobIntention(sec.lines);
        resultModules.push(m);
        recognizedNames.push("求职意向");
        break;
      }
      case "education": {
        const m = extractEducation(sec.lines);
        if (m.data.items.length > 0) {
          resultModules.push(m);
          recognizedNames.push("教育背景");
        }
        break;
      }
      case "work":
      case "internship": {
        const m = extractExperience(sec.type, sec.lines);
        if (m.data.items.length > 0) {
          resultModules.push(m);
          recognizedNames.push(sec.type === "work" ? "工作经历" : "实习经历");
        }
        break;
      }
      case "project": {
        const m = extractProjects(sec.lines);
        if (m.data.items.length > 0) {
          resultModules.push(m);
          recognizedNames.push("项目经历");
        }
        break;
      }
      case "skills": {
        const m = extractSkills(sec.lines);
        if (m.data.categories.length > 0 || (m.data.notes && m.data.notes.length > 0)) {
          resultModules.push(m);
          recognizedNames.push("专业技能");
        }
        break;
      }
      case "award": {
        const m = extractAwards(sec.lines);
        if (m.data.items.length > 0) {
          resultModules.push(m);
          recognizedNames.push("荣誉奖项");
        }
        break;
      }
      case "summary": {
        const m = extractSummary(sec.lines);
        if (m.data.text.trim().length > 0) {
          resultModules.push(m);
          recognizedNames.push("自我评价");
        }
        break;
      }
      case "research": {
        const m = extractResearch(sec.lines);
        if (m.data.items.length > 0) {
          resultModules.push(m);
          recognizedNames.push("科研经历");
        }
        break;
      }
      case "paper": {
        const m = extractPaper(sec.lines);
        if (m.data.items.length > 0) {
          resultModules.push(m);
          recognizedNames.push("论文发表");
        }
        break;
      }
    }
  }

  doc.modules = resultModules;

  // 4. 校验与自动修复
  const val = validateDocument(doc);
  if (!val.ok) {
    const recovered = recoverDocument(doc);
    if (recovered) {
      warnings.push(...recovered.issues.map((i) => `${i.path} ${i.message}`));
      return { doc: recovered.doc, warnings, recognizedModules: recognizedNames };
    }
  }

  return { doc, warnings, recognizedModules: recognizedNames };
}

/**
 * 依据标题特征切分模块
 */
function splitIntoSections(lines: string[]): { headerLines: string[]; sections: RawSection[] } {
  const headerLines: string[] = [];
  const sections: RawSection[] = [];
  let currentSection: RawSection | null = null;

  for (const line of lines) {
    const matchedType = detectSectionHeader(line);
    if (matchedType) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = { type: matchedType, lines: [] };
    } else if (currentSection) {
      currentSection.lines.push(line);
    } else {
      headerLines.push(line);
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  return { headerLines, sections };
}

function detectSectionHeader(line: string): ModuleType | null {
  // 过滤修饰字符，如 "## 教育经历"、"【专业技能】"、"1. 工作经历"、"■ 项目经验"
  const cleaned = line
    .replace(/^[#\-*·•★◆■□▲\d\s.、一二三四五六七八九十【】\[\]（）()|｜]+/u, "")
    .replace(/[【】\[\]（）()|｜#\-*·•]+$/u, "")
    .trim();

  if (!cleaned || cleaned.length > 15) return null;

  for (const { type, pattern } of SECTION_PATTERNS) {
    if (pattern.test(cleaned)) {
      return type;
    }
  }
  return null;
}

/**
 * 从基础信息行中提取姓名、电话、邮箱、网站等
 */
function extractBasicInfo(lines: string[], fallbackName: string): Extract<Module, { type: "basic_info" }> {
  const m = createModule("basic_info") as Extract<Module, { type: "basic_info" }>;
  const fullText = lines.join(" ");

  // 1. 电话
  const phoneMatch = fullText.match(PHONE_REGEX);
  if (phoneMatch) m.data.phone = phoneMatch[1];

  // 2. 邮箱
  const emailMatch = fullText.match(EMAIL_REGEX);
  if (emailMatch) m.data.email = emailMatch[1];

  // 3. GitHub
  const ghMatch = fullText.match(GITHUB_REGEX);
  if (ghMatch) m.data.github = ghMatch[1];

  // 4. 博客 / 个人主页
  const urlMatches = [...fullText.matchAll(new RegExp(URL_REGEX.source, "g"))];
  for (const u of urlMatches) {
    const link = u[1];
    if (!link.includes("github.com")) {
      m.data.website = link;
      break;
    }
  }

  // 5. 性别
  if (/(?:^|[^\u4e00-\u9fa5])男(?:$|[^\u4e00-\u9fa5])/.test(fullText) || /性别[：:]\s*男/.test(fullText)) {
    m.data.gender = "男";
  } else if (/(?:^|[^\u4e00-\u9fa5])女(?:$|[^\u4e00-\u9fa5])/.test(fullText) || /性别[：:]\s*女/.test(fullText)) {
    m.data.gender = "女";
  }

  // 6. 生日 / 年龄
  const birthMatch = fullText.match(/(?:生日|出生年月|出生日期)[：:]\s*((?:19|20)\d{2}[年.-]\d{1,2}(?:[月.-]\d{1,2})?)/);
  if (birthMatch) {
    m.data.birthday = normalizeDate(birthMatch[1]);
  } else {
    const standaloneBirth = fullText.match(/(?:19|20)\d{2}[年.-]\d{1,2}/);
    if (standaloneBirth && !fullText.includes("-") && !fullText.includes("至")) {
      m.data.birthday = normalizeDate(standaloneBirth[0]);
    }
  }

  // 7. 城市 / 地点
  const locMatch = fullText.match(/(?:城市|地点|现居|期望城市|所在地|居住地)[：:]\s*([^\s,，、/]+)/);
  if (locMatch) {
    m.data.location = locMatch[1].trim();
  } else {
    const cities = ["北京", "上海", "广州", "深圳", "杭州", "成都", "武汉", "南京", "西安", "厦门", "苏州", "天津", "重庆", "合肥", "长沙"];
    for (const c of cities) {
      if (new RegExp(`(?:^|\\s|/|·)${c}(?:市)?(?:\\s|$|/|·)`).test(fullText)) {
        m.data.location = c;
        break;
      }
    }
  }

  // 8. 姓名识别：寻找开头的纯姓名候选
  let detectedName = "";
  for (const l of lines.slice(0, 6)) {
    const clean = l
      .replace(new RegExp(PHONE_REGEX.source, "g"), "")
      .replace(new RegExp(EMAIL_REGEX.source, "g"), "")
      .replace(new RegExp(URL_REGEX.source, "g"), "")
      .replace(/[|｜·/\\:：_#*\-]/g, " ")
      .trim();

    if (!clean) continue;
    // 排除明显不是姓名的行
    if (/(?:简历|求职|工程师|前端|后端|开发|电话|邮箱|微信|年龄|岁|年|本科|硕士|学历)/.test(clean)) continue;

    // 英文全名匹配整行（如 Alex Wang）
    if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+$/.test(clean)) {
      detectedName = clean;
      break;
    }

    // 中文姓名匹配整行或分词（如 张三）
    if (/^[\u4e00-\u9fa5]{2,4}$/.test(clean)) {
      detectedName = clean;
      break;
    }

    const parts = clean.split(/\s+/);
    for (const p of parts) {
      if (/^[\u4e00-\u9fa5]{2,4}$/.test(p)) {
        detectedName = p;
        break;
      }
    }
    if (detectedName) break;
  }

  m.data.name = detectedName || fallbackName.replace(/\.pdf$/i, "");
  return m;
}

/**
 * 提取求职意向
 */
function extractJobIntention(lines: string[]): Extract<Module, { type: "job_intention" }> {
  const m = createModule("job_intention") as Extract<Module, { type: "job_intention" }>;
  const fullText = lines.join(" ");

  const role = fullText.match(/(?:求职意向|意向岗位|期望职位|职位|岗位)[：:]\s*([^\s,，、/]+)/);
  if (role) m.data.role = role[1].trim();

  const city = fullText.match(/(?:期望城市|意向城市|工作地点|城市)[：:]\s*([^\s,，、/]+)/);
  if (city) m.data.city = city[1].trim();

  const salary = fullText.match(/(?:期望薪资|期望月薪|薪资待遇|薪资)[：:]\s*([^\s,，/]+)/);
  if (salary) m.data.salary = salary[1].trim();

  const avail = fullText.match(/(?:到岗时间|入职时间|状态)[：:]\s*([^\s,，/]+)/);
  if (avail) m.data.availability = avail[1].trim();

  if (!m.data.role && lines[0] && lines[0].length < 20 && !lines[0].includes("：")) {
    m.data.role = lines[0].trim();
  }

  return m;
}

/**
 * 提取教育经历
 */
function extractEducation(lines: string[]): Extract<Module, { type: "education" }> {
  const m = createModule("education") as Extract<Module, { type: "education" }>;
  const items: EducationItem[] = [];

  // 条目切分：依据包含日期区间或高校名称的行切分
  const blocks = groupExperienceItems(lines, (l) => /(?:大学|学院|分校|University|College)/.test(l));

  for (const block of blocks) {
    if (block.length === 0) continue;
    let school = "";
    let major: string | undefined;
    let degree: string | undefined;
    let start = "";
    let end = "";
    const highlights: string[] = [];

    const firstLine = block[0];
    const dateMatch = firstLine.match(DATE_RANGE_REGEX);
    if (dateMatch) {
      start = normalizeDate(dateMatch[1]) || "";
      end = dateMatch[2] === "至今" || dateMatch[2].toLowerCase() === "present" ? PRESENT : normalizeDate(dateMatch[2]) || "";
    }

    // 查找学校
    for (const l of block) {
      if (!school) {
        const schMatch = l.match(/([\u4e00-\u9fa5a-zA-Z\s]+(?:大学|学院|分校))/);
        if (schMatch) {
          school = schMatch[1].trim();
        }
      }
      if (!degree) {
        for (const d of MAJOR_DEGREES) {
          if (l.includes(d)) {
            degree = d;
            break;
          }
        }
      }
    }

    // 若第一行没匹配到日期，在后续行中找日期
    if (!start) {
      for (const l of block) {
        const dm = l.match(DATE_RANGE_REGEX);
        if (dm) {
          start = normalizeDate(dm[1]) || "";
          end = dm[2] === "至今" || dm[2].toLowerCase() === "present" ? PRESENT : normalizeDate(dm[2]) || "";
          break;
        }
      }
    }

    // 提取专业
    for (const l of block) {
      const segs = l.split(/[\s·|｜/]/).map((s) => s.trim()).filter(Boolean);
      for (const s of segs) {
        if (s !== school && s !== degree && !DATE_RANGE_REGEX.test(s)) {
          if (/(?:系|专业|工程|科学|技术|管理|经济|英语|金融|设计|艺术|数学|自动化|软件|计算机)/.test(s) && s.length <= 15) {
            major = s;
            break;
          }
        }
      }
      if (major) break;
    }

    // 要点（GPA、主修课程、奖学金等）
    for (let i = 1; i < block.length; i++) {
      const l = block[i];
      if (l.includes(school) || (major && l.includes(major)) || DATE_RANGE_REGEX.test(l)) continue;
      const bullet = cleanBulletPrefix(l);
      if (bullet) highlights.push(bullet);
    }

    if (school || start) {
      items.push({
        id: newId("edu"),
        school: school || "毕业院校",
        degree,
        major,
        start: start || "2018-09",
        end: end || "2022-06",
        highlights,
      });
    }
  }

  m.data.items = items;
  return m;
}

/**
 * 提取工作或实习经历
 */
function extractExperience(type: "work" | "internship", lines: string[]): Extract<Module, { type: "work" | "internship" }> {
  const m = createModule(type) as Extract<Module, { type: "work" | "internship" }>;
  const items: ExperienceItem[] = [];

  const blocks = groupExperienceItems(lines);

  for (const block of blocks) {
    if (block.length === 0) continue;
    let org = "";
    let title = "";
    let start = "";
    let end = "";
    let summary: string | undefined;
    const techStack: string[] = [];
    const bullets: string[] = [];

    // 时间匹配
    for (const l of block) {
      const dm = l.match(DATE_RANGE_REGEX);
      if (dm) {
        start = normalizeDate(dm[1]) || "";
        end = dm[2] === "至今" || dm[2].toLowerCase() === "present" ? PRESENT : normalizeDate(dm[2]) || "";
        break;
      }
    }

    // 首行一般是公司与职位
    const titleLine = block[0].replace(DATE_RANGE_REGEX, "").trim();
    const parts = titleLine.split(/[\s·|｜/]+/).filter(Boolean);
    if (parts.length >= 2) {
      org = parts[0];
      title = parts.slice(1).join(" · ");
    } else if (parts.length === 1) {
      org = parts[0];
      if (block.length > 1) {
        const nextParts = block[1].split(/[\s·|｜/]+/).filter(Boolean);
        if (nextParts.length > 0 && !isBulletLine(block[1])) {
          title = nextParts[0];
        }
      }
    }

    for (let i = 1; i < block.length; i++) {
      const l = block[i];
      if (DATE_RANGE_REGEX.test(l) && l === block[i]) continue;
      if (l.startsWith("技术栈") || l.startsWith("Tech Stack")) {
        const ts = l.replace(/^[^:：]+[:：]/, "").split(/[、,，;；\s]+/).filter(Boolean);
        techStack.push(...ts);
        continue;
      }
      if (l.startsWith("简介") || l.startsWith("说明")) {
        summary = l.replace(/^[^:：]+[:：]/, "").trim();
        continue;
      }
      const b = cleanBulletPrefix(l);
      if (b) bullets.push(b);
    }

    if (org || title || bullets.length > 0) {
      items.push({
        id: newId("exp"),
        org: org || "公司/机构",
        title: title || "职位角色",
        start: start || "2022-07",
        end: end || PRESENT,
        summary,
        techStack: techStack.length > 0 ? techStack : undefined,
        bullets,
      });
    }
  }

  m.data.items = items;
  return m;
}

/**
 * 提取项目经历
 */
function extractProjects(lines: string[]): Extract<Module, { type: "project" }> {
  const m = createModule("project") as Extract<Module, { type: "project" }>;
  const items: ProjectItem[] = [];

  const blocks = groupExperienceItems(lines, (l) => /^###?\s+/.test(l));

  for (const block of blocks) {
    if (block.length === 0) continue;
    let name = "";
    let role: string | undefined;
    let start: string | undefined;
    let end: string | undefined;
    let url: string | undefined;
    let summary: string | undefined;
    const techStack: string[] = [];
    const bullets: string[] = [];

    // 日期
    for (const l of block) {
      const dm = l.match(DATE_RANGE_REGEX);
      if (dm) {
        start = normalizeDate(dm[1]);
        end = dm[2] === "至今" || dm[2].toLowerCase() === "present" ? PRESENT : normalizeDate(dm[2]);
        break;
      }
    }

    const titleLine = block[0].replace(DATE_RANGE_REGEX, "").trim();
    const parts = titleLine.split(/[\s·|｜/]+/).filter(Boolean);
    if (parts.length >= 2) {
      name = parts[0];
      role = parts.slice(1).join(" · ");
    } else {
      name = parts[0] || "项目名称";
    }

    for (let i = 1; i < block.length; i++) {
      const l = block[i];
      if (DATE_RANGE_REGEX.test(l) && l === block[i]) continue;
      if (l.startsWith("链接") || l.startsWith("URL") || URL_REGEX.test(l)) {
        const um = l.match(URL_REGEX);
        if (um) url = um[1];
        continue;
      }
      if (l.startsWith("技术栈") || l.startsWith("Tech Stack")) {
        const ts = l.replace(/^[^:：]+[:：]/, "").split(/[、,，;；\s]+/).filter(Boolean);
        techStack.push(...ts);
        continue;
      }
      if (l.startsWith("简介") || l.startsWith("说明")) {
        summary = l.replace(/^[^:：]+[:：]/, "").trim();
        continue;
      }
      const b = cleanBulletPrefix(l);
      if (b) bullets.push(b);
    }

    items.push({
      id: newId("prj"),
      name: name || "项目名称",
      role,
      start,
      end,
      url,
      summary,
      techStack: techStack.length > 0 ? techStack : undefined,
      bullets,
    });
  }

  m.data.items = items;
  return m;
}

/**
 * 提取专业技能
 */
function extractSkills(lines: string[]): Extract<Module, { type: "skills" }> {
  const m = createModule("skills") as Extract<Module, { type: "skills" }>;
  const categories: SkillCategory[] = [];
  const notes: string[] = [];

  for (const l of lines) {
    const clean = cleanBulletPrefix(l);
    if (!clean) continue;

    // 匹配 "分类：项1、项2、项3"
    const kv = clean.match(/^([^：:]{1,12})[：:]\s*(.*)$/);
    if (kv && !/[，。；;]/.test(kv[2])) {
      const catName = kv[1].replace(/\*\*/g, "").trim();
      const items = kv[2].split(/[、,，;；\s]+/).map((s) => s.trim()).filter(Boolean);
      categories.push({ id: newId("sk"), name: catName, items });
    } else {
      notes.push(clean);
    }
  }

  m.data.categories = categories;
  if (notes.length > 0) m.data.notes = notes;
  return m;
}

/**
 * 提取荣誉奖项
 */
function extractAwards(lines: string[]): Extract<Module, { type: "award" }> {
  const m = createModule("award") as Extract<Module, { type: "award" }>;
  const items: AwardItem[] = [];

  for (const l of lines) {
    const clean = cleanBulletPrefix(l);
    if (!clean) continue;
    const parts = clean.split(/[\s·|｜/]+/).filter(Boolean);
    const dateMatch = clean.match(/(?:19|20)\d{2}[年.-]\d{1,2}/);
    const date = dateMatch ? normalizeDate(dateMatch[0]) : undefined;

    items.push({
      id: newId("awd"),
      name: parts[0] || clean,
      issuer: parts.length > 1 ? parts[1] : undefined,
      date,
    });
  }

  m.data.items = items;
  return m;
}

/**
 * 提取自我评价
 */
function extractSummary(lines: string[]): Extract<Module, { type: "summary" }> {
  const m = createModule("summary") as Extract<Module, { type: "summary" }>;
  m.data.text = lines.map(cleanBulletPrefix).filter(Boolean).join("\n");
  return m;
}

/**
 * 提取科研经历
 */
function extractResearch(lines: string[]): Extract<Module, { type: "research" }> {
  const m = createModule("research") as Extract<Module, { type: "research" }>;
  const items: ResearchItem[] = [];
  const blocks = groupExperienceItems(lines);

  for (const b of blocks) {
    if (b.length === 0) continue;
    const name = b[0].replace(DATE_RANGE_REGEX, "").trim() || "研究项目";
    const bullets = b.slice(1).map(cleanBulletPrefix).filter(Boolean);
    items.push({ id: newId("res"), name, bullets });
  }

  m.data.items = items;
  return m;
}

/**
 * 提取论文
 */
function extractPaper(lines: string[]): Extract<Module, { type: "paper" }> {
  const m = createModule("paper") as Extract<Module, { type: "paper" }>;
  m.data.items = lines.map((l) => ({
    id: newId("ppr"),
    title: cleanBulletPrefix(l),
  }));
  return m;
}

/**
 * 工具函数：智能将多行文本切分为独立的经历条目块
 */
function groupExperienceItems(lines: string[], extraAnchor?: (line: string) => boolean): string[][] {
  const blocks: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    const isAnchor = DATE_RANGE_REGEX.test(line) || (extraAnchor ? extraAnchor(line) : false);

    if (isAnchor) {
      if (current.length > 0) {
        const lastLine = current[current.length - 1];
        // 如果上一行是简短的标题行（且不是 bullet，且不是日期行），它很可能是本条目的标题行
        if (!isBulletLine(lastLine) && !DATE_RANGE_REGEX.test(lastLine) && current.length > 1) {
          const titleLine = current.pop()!;
          blocks.push(current);
          current = [titleLine, line];
          continue;
        } else if (current.some((l) => DATE_RANGE_REGEX.test(l) || (extraAnchor && extraAnchor(l)))) {
          // 当前块中已经包含了旧条目的关键信息，切分新条目
          blocks.push(current);
          current = [line];
          continue;
        }
      }
    }

    current.push(line);
  }

  if (current.length > 0) {
    blocks.push(current);
  }

  return blocks;
}

function isBulletLine(line: string): boolean {
  return /^[\s*•·●○■□◆◇▪▸►\-–—]+|\(?\d{1,2}[.)、．）]/.test(line);
}

function cleanBulletPrefix(line: string): string {
  return line.replace(/^\s*(?:[•·●○■□◆◇▪▸►\-*–—]+|\(?\d{1,2}[.)、．）](?!\d)|[①-⑳])\s*/u, "").trim();
}

// 零依赖运行时校验。设计说明书允许「Zod 或同等」；这里手写是为了让 schema 包
// 不装任何依赖也能在 Node 里直接测试。导入非法文件时返回带路径的错误列表。

import {
  MODULE_TYPES,
  PAGE_MODES,
  TEMPLATE_IDS,
  THEME_IDS,
  type Module,
  type ModuleType,
  type RuyeDocument,
} from "./types.ts";

export interface ValidationIssue {
  path: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; doc: RuyeDocument }
  | { ok: false; issues: ValidationIssue[] };

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?$/;
export const PRESENT = "至今";

/** 日期允许：空字符串（未填）、YYYY-MM、YYYY-MM-DD、「至今」 */
export function isValidDate(v: string): boolean {
  return v === "" || v === PRESENT || DATE_RE.test(v);
}

/** 把常见写法（2024.09、2024/9、2024年9月、现在）归一成 YYYY-MM 或「至今」。无法识别时原样返回。 */
export function normalizeDate(raw: string): string {
  const s = raw.trim();
  if (s === "") return "";
  if (/^(至今|现在|今|present|now)$/i.test(s)) return PRESENT;
  const m = s.match(/^(\d{4})\s*[-./年]\s*(\d{1,2})\s*(?:月|(?:[-./月]\s*(\d{1,2})\s*日?))?$/);
  if (!m) return s;
  const month = m[2].padStart(2, "0");
  if (Number(month) < 1 || Number(month) > 12) return s;
  if (m[3] !== undefined) return `${m[1]}-${month}-${m[3].padStart(2, "0")}`;
  return `${m[1]}-${month}`;
}

class Ctx {
  issues: ValidationIssue[] = [];
  fail(path: string, message: string): void {
    this.issues.push({ path, message });
  }
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function reqString(ctx: Ctx, o: Record<string, unknown>, key: string, path: string): void {
  if (typeof o[key] !== "string") ctx.fail(`${path}.${key}`, "必须是字符串");
}

function optString(ctx: Ctx, o: Record<string, unknown>, key: string, path: string): void {
  if (o[key] !== undefined && typeof o[key] !== "string") ctx.fail(`${path}.${key}`, "必须是字符串或省略");
}

function reqDate(ctx: Ctx, o: Record<string, unknown>, key: string, path: string, optional: boolean): void {
  const v = o[key];
  if (v === undefined && optional) return;
  if (typeof v !== "string") {
    ctx.fail(`${path}.${key}`, "日期必须是字符串");
    return;
  }
  if (!isValidDate(v)) ctx.fail(`${path}.${key}`, `日期格式应为 YYYY-MM、YYYY-MM-DD 或「至今」，实际是「${v}」`);
}

function stringArray(ctx: Ctx, v: unknown, path: string, optional: boolean): void {
  if (v === undefined && optional) return;
  if (!Array.isArray(v)) {
    ctx.fail(path, "必须是字符串数组");
    return;
  }
  v.forEach((s, i) => {
    if (typeof s !== "string") ctx.fail(`${path}[${i}]`, "必须是字符串");
  });
}

function items(ctx: Ctx, data: Record<string, unknown>, path: string, check: (item: Record<string, unknown>, p: string) => void, key = "items"): void {
  const arr = data[key];
  if (!Array.isArray(arr)) {
    ctx.fail(`${path}.${key}`, "必须是数组");
    return;
  }
  const seen = new Set<string>();
  arr.forEach((item, i) => {
    const p = `${path}.${key}[${i}]`;
    if (!isObj(item)) {
      ctx.fail(p, "必须是对象");
      return;
    }
    if (typeof item.id !== "string" || item.id === "") ctx.fail(`${p}.id`, "必须是非空字符串");
    else if (seen.has(item.id)) ctx.fail(`${p}.id`, `条目 id 重复：${item.id}`);
    else seen.add(item.id);
    check(item, p);
  });
}

function checkExperience(ctx: Ctx, it: Record<string, unknown>, p: string): void {
  reqString(ctx, it, "org", p);
  reqString(ctx, it, "title", p);
  reqDate(ctx, it, "start", p, false);
  reqDate(ctx, it, "end", p, false);
  optString(ctx, it, "summary", p);
  stringArray(ctx, it.techStack, `${p}.techStack`, true);
  stringArray(ctx, it.bullets, `${p}.bullets`, false);
}

function checkModuleData(ctx: Ctx, type: ModuleType, data: Record<string, unknown>, p: string): void {
  switch (type) {
    case "basic_info": {
      reqString(ctx, data, "name", p);
      for (const k of ["photoDataUrl", "gender", "birthday", "phone", "email", "location", "website", "github", "blog"]) {
        optString(ctx, data, k, p);
      }
      if (typeof data.photoDataUrl === "string" && data.photoDataUrl !== "" && !data.photoDataUrl.startsWith("data:image/")) {
        ctx.fail(`${p}.photoDataUrl`, "照片只支持本地 data URL（data:image/...）");
      }
      if (data.customLinks !== undefined) {
        if (!Array.isArray(data.customLinks)) ctx.fail(`${p}.customLinks`, "必须是数组");
        else
          data.customLinks.forEach((l, i) => {
            if (!isObj(l) || typeof l.label !== "string" || typeof l.url !== "string") {
              ctx.fail(`${p}.customLinks[${i}]`, "需要 { label, url } 两个字符串字段");
            }
          });
      }
      return;
    }
    case "job_intention":
      for (const k of ["role", "city", "availability", "salary"]) optString(ctx, data, k, p);
      return;
    case "education":
      items(ctx, data, p, (it, ip) => {
        reqString(ctx, it, "school", ip);
        optString(ctx, it, "degree", ip);
        optString(ctx, it, "major", ip);
        reqDate(ctx, it, "start", ip, false);
        reqDate(ctx, it, "end", ip, false);
        stringArray(ctx, it.highlights, `${ip}.highlights`, false);
      });
      return;
    case "work":
    case "internship":
      items(ctx, data, p, (it, ip) => checkExperience(ctx, it, ip));
      return;
    case "project":
      items(ctx, data, p, (it, ip) => {
        reqString(ctx, it, "name", ip);
        for (const k of ["role", "url", "summary"]) optString(ctx, it, k, ip);
        reqDate(ctx, it, "start", ip, true);
        reqDate(ctx, it, "end", ip, true);
        stringArray(ctx, it.techStack, `${ip}.techStack`, true);
        stringArray(ctx, it.bullets, `${ip}.bullets`, false);
      });
      return;
    case "skills":
      items(
        ctx,
        data,
        p,
        (it, ip) => {
          reqString(ctx, it, "name", ip);
          stringArray(ctx, it.items, `${ip}.items`, false);
        },
        "categories",
      );
      return;
    case "research":
      items(ctx, data, p, (it, ip) => {
        reqString(ctx, it, "name", ip);
        optString(ctx, it, "org", ip);
        reqDate(ctx, it, "start", ip, true);
        reqDate(ctx, it, "end", ip, true);
        stringArray(ctx, it.bullets, `${ip}.bullets`, false);
      });
      return;
    case "paper":
      items(ctx, data, p, (it, ip) => {
        reqString(ctx, it, "title", ip);
        for (const k of ["venue", "authors", "url"]) optString(ctx, it, k, ip);
        reqDate(ctx, it, "date", ip, true);
      });
      return;
    case "award":
      items(ctx, data, p, (it, ip) => {
        reqString(ctx, it, "name", ip);
        for (const k of ["issuer", "description"]) optString(ctx, it, k, ip);
        reqDate(ctx, it, "date", ip, true);
      });
      return;
  }
}

export function validateDocument(input: unknown): ValidationResult {
  const ctx = new Ctx();
  if (!isObj(input)) return { ok: false, issues: [{ path: "$", message: "根节点必须是对象" }] };

  if (input.version !== 1) ctx.fail("$.version", "只支持 version: 1");

  if (!isObj(input.meta)) ctx.fail("$.meta", "缺少 meta 对象");
  else {
    reqString(ctx, input.meta, "title", "$.meta");
    if (input.meta.locale !== "zh-CN") ctx.fail("$.meta.locale", "只支持 zh-CN");
    reqString(ctx, input.meta, "updatedAt", "$.meta");
  }

  if (!isObj(input.layout)) ctx.fail("$.layout", "缺少 layout 对象");
  else {
    if (!TEMPLATE_IDS.includes(input.layout.templateId as never)) {
      ctx.fail("$.layout.templateId", `未知模板：${String(input.layout.templateId)}`);
    }
    if (!PAGE_MODES.includes(input.layout.pageMode as never)) {
      ctx.fail("$.layout.pageMode", `未知页面模式：${String(input.layout.pageMode)}`);
    }
    if (input.layout.theme !== undefined && !THEME_IDS.includes(input.layout.theme as never)) {
      ctx.fail("$.layout.theme", `未知主题色：${String(input.layout.theme)}`);
    }
  }

  if (!Array.isArray(input.modules)) ctx.fail("$.modules", "必须是数组");
  else {
    const seenIds = new Set<string>();
    const seenTypes = new Set<string>();
    input.modules.forEach((m, i) => {
      const p = `$.modules[${i}]`;
      if (!isObj(m)) {
        ctx.fail(p, "必须是对象");
        return;
      }
      if (typeof m.id !== "string" || m.id === "") ctx.fail(`${p}.id`, "必须是非空字符串");
      else if (seenIds.has(m.id)) ctx.fail(`${p}.id`, `模块 id 重复：${m.id}`);
      else seenIds.add(m.id);
      if (typeof m.visible !== "boolean") ctx.fail(`${p}.visible`, "必须是布尔值");
      if (!MODULE_TYPES.includes(m.type as ModuleType)) {
        ctx.fail(`${p}.type`, `未知模块类型：${String(m.type)}`);
        return;
      }
      // v1：每种模块最多一个（多个项目放进同一个模块的 items）
      if (seenTypes.has(m.type as string)) ctx.fail(`${p}.type`, `同一文档只能有一个「${String(m.type)}」模块`);
      seenTypes.add(m.type as string);
      if (!isObj(m.data)) {
        ctx.fail(`${p}.data`, "必须是对象");
        return;
      }
      checkModuleData(ctx, m.type as ModuleType, m.data, `${p}.data`);
    });
  }

  if (input.extensions !== undefined && !isObj(input.extensions)) ctx.fail("$.extensions", "必须是对象或省略");

  if (ctx.issues.length > 0) return { ok: false, issues: ctx.issues };
  return { ok: true, doc: input as unknown as RuyeDocument };
}

const nonEmpty = (s: string | undefined): boolean => s !== undefined && s.trim() !== "";

/** 模块是否「内容全空」：全空的模块不渲染，也不参与高度计算 */
export function isModuleEmpty(m: Module): boolean {
  switch (m.type) {
    case "basic_info":
      return !nonEmpty(m.data.name);
    case "job_intention":
      return ![m.data.role, m.data.city, m.data.availability, m.data.salary].some(nonEmpty);
    case "skills":
      return !m.data.categories.some((c) => c.items.some(nonEmpty));
    default:
      return m.data.items.length === 0;
  }
}

/** 实际参与排版的模块：可见且非空，保持原顺序 */
export function renderableModules(doc: RuyeDocument): Module[] {
  return doc.modules.filter((m) => m.visible && !isModuleEmpty(m));
}

export function getBasicInfo(doc: RuyeDocument) {
  const m = doc.modules.find((x) => x.type === "basic_info");
  return m && m.type === "basic_info" ? m.data : undefined;
}

/** 导出 PDF 前的检查：姓名必填 */
export function checkExportable(doc: RuyeDocument): { ok: true } | { ok: false; message: string } {
  const info = getBasicInfo(doc);
  if (!info || info.name.trim() === "") return { ok: false, message: "未填写姓名，无法导出 PDF。" };
  return { ok: true };
}

/** 文件名：{姓名}-{求职意向}，非法字符去掉，缺省为「简历」 */
export function exportBaseName(doc: RuyeDocument): string {
  const info = getBasicInfo(doc);
  const intent = doc.modules.find((x) => x.type === "job_intention");
  const role = intent && intent.type === "job_intention" ? intent.data.role ?? "" : "";
  const parts = [info?.name ?? "", role].map((s) => s.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "").trim()).filter(Boolean);
  return parts.length > 0 ? parts.join("-") : "简历";
}

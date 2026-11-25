// 本地读取 PDF 文字再走现有 Markdown 导入。不上传、不调用模型。
// 当前仓库没有视觉模型：扫描件只说明原因，不假装已经导入。
import { HEADING_ALIASES, fromMarkdown, validateDocument, type ModuleType } from "../../../packages/schema/src/index.ts";
import type { ImportResult } from "./import-file.ts";

const MAX_PDF_BYTES = 8 * 1024 * 1024;
const EXPERIENCE = new Set<ModuleType>(["education", "work", "internship", "project", "research", "paper", "award"]);
const DATE_LINE = /^(\d{4}\s*[./年-]\s*\d{1,2}(?:\s*[./月-]\s*\d{1,2})?)\s*[-–—~～至到]+\s*(\d{4}\s*[./年-]\s*\d{1,2}(?:\s*[./月-]\s*\d{1,2})?|至今|现在|今)$/;

function fail(message: string): ImportResult {
  return { ok: false, message, sticky: true };
}

const RANGE_TAIL = /^(.*\S)\s+(\d{4}\s*[./年-]\s*\d{1,2}(?:\s*[./月-]\s*\d{1,2})?)\s*[-–—~～\u2010-\u2015至到]+\s*(\d{4}\s*[./年-]\s*\d{1,2}(?:\s*[./月-]\s*\d{1,2})?|至今|现在|今)\s*$/;

function peelRange(text: string): { text: string; date?: string } {
  const m = text.match(RANGE_TAIL);
  if (!m) return { text };
  return { text: m[1].trim(), date: `${m[2].replace(/\s+/g, "")} - ${m[3].replace(/\s+/g, "")}` };
}

function peelSingleDate(text: string): { text: string; date?: string } {
  const m = text.match(/^(.*\S)\s+(\d{4}\s*[./年-]\s*\d{1,2}(?:\s*[./月-]\s*\d{1,2})?)\s*$/);
  if (!m) return { text };
  return { text: m[1].trim(), date: m[2].replace(/\s+/g, "") };
}

function columnsOf(line: string): string[] {
  return line.split(/\s{2,}|[|｜]/).map((s) => s.trim()).filter(Boolean);
}

/** 页眉里没有冒号的一段：电话、邮箱、GitHub 归基本信息，岗位和城市归求职意向。归不进的文字交还调用方，不能丢掉。 */
function placeHeaderColumn(col: string, basic: string[], intent: string[]): string | null {
  let rest = col;
  const phone = rest.match(/(?<!\d)(?:\+?86[-\s]?)?(1[3-9]\d{9})(?!\d)/);
  if (phone) {
    basic.push(`- 电话：${phone[1]}`);
    rest = rest.replace(phone[0], " ");
  }
  const email = rest.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  if (email) {
    basic.push(`- 邮箱：${email[0]}`);
    rest = rest.replace(email[0], " ");
  }
  const gh = rest.match(/(?:https?:\/\/)?github\.com\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?/i);
  if (gh) {
    const url = /^https?:\/\//i.test(gh[0]) ? gh[0] : `https://${gh[0]}`;
    basic.push(`- GitHub：${url}`);
    rest = rest.replace(gh[0], " ");
  }
  rest = rest.replace(/\s+/g, " ").trim();
  if (!rest) return null;
  if (/到岗|入职|可实习|随时|暑期|寒假/.test(rest) || /\d{4}\s*年/.test(rest)) {
    intent.push(`- 到岗：${rest}`);
    return null;
  }
  if (/实习|工程师|开发|经理|研究员|设计师|负责人|顾问|专员/.test(rest) && rest.length <= 24) {
    intent.push(`- 岗位：${rest}`);
    return null;
  }
  if (/[/／、]/.test(rest) && rest.length <= 24 && !/\d/.test(rest)) {
    intent.push(`- 城市：${rest}`);
    return null;
  }
  if (rest.length <= 8 && !/\d/.test(rest)) {
    basic.push(`- 地点：${rest}`);
    return null;
  }
  return rest;
}

function peelUrl(line: string): { text: string; url?: string } {
  const m = line.match(/(?:https?:\/\/)?github\.com\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?/i) ?? line.match(/https?:\/\/\S+/);
  if (!m) return { text: line };
  const url = /^https?:\/\//i.test(m[0]) ? m[0] : `https://${m[0]}`;
  return { text: line.replace(m[0], "").replace(/\s{2,}/g, " ").replace(/\s+[·|｜]\s*$/, "").trim(), url };
}

export function pdfPlainTextToMarkdown(text: string): string {
  const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const out: string[] = [];
  let i = 0;
  if (lines.length && !(lines[0].replace(/[：:\s]+$/g, "") in HEADING_ALIASES)) {
    out.push(`# ${lines[0]}`);
    i = 1;
  }
  const basic: string[] = [];
  const intent: string[] = [];
  const loose: string[] = [];
  while (i < lines.length && !(lines[i].replace(/[：:\s]+$/g, "") in HEADING_ALIASES)) {
    const line = lines[i++];
    if (/^[-*]?\s*[^：:]{1,12}[：:]\s*.+$/.test(line)) {
      basic.push(line.startsWith("-") || line.startsWith("*") ? line : `- ${line}`);
      continue;
    }
    for (const col of columnsOf(line)) {
      const left = placeHeaderColumn(col, basic, intent);
      if (left) loose.push(left);
    }
  }
  out.push(...basic);
  if (intent.length) {
    out.push("## 求职意向");
    out.push(...intent);
  }
  let type: ModuleType | null = intent.length ? "job_intention" : null;
  let needItem = false;
  for (; i < lines.length; i++) {
    const line = lines[i];
    const heading = line.replace(/[：:\s]+$/g, "");
    if (heading in HEADING_ALIASES) {
      type = HEADING_ALIASES[heading];
      needItem = EXPERIENCE.has(type);
      out.push(`## ${heading}`);
      continue;
    }
    if (type === "summary") {
      out.push(line);
      continue;
    }
    if (type === "skills") {
      const bullet = line.startsWith("-") ? line.slice(1).trim() : line;
      if (/^[与和及]/.test(bullet) && bullet.length <= 12 && out.at(-1)?.startsWith("- ")) {
        const prev = out[out.length - 1];
        out[out.length - 1] = prev.endsWith(" ") ? prev + bullet : `${prev} ${bullet}`;
      }
      else out.push(`- ${bullet}`);
      continue;
    }
    if (!type || !EXPERIENCE.has(type)) {
      out.push(line.startsWith("-") ? line : `- ${line}`);
      continue;
    }
    if (DATE_LINE.test(line)) {
      out.push(line);
      continue;
    }
    const next = lines[i + 1] ?? "";
    const parts = columnsOf(line);
    const urls: string[] = [];
    const titleParts: string[] = [];
    for (const part of parts) {
      const peeled = peelUrl(part);
      if (peeled.url) urls.push(peeled.url);
      if (peeled.text) titleParts.push(peeled.text);
    }
    const ranged = peelRange(titleParts.join("  "));
    const award = type === "award" ? peelSingleDate(ranged.text) : { text: ranged.text };
    const titleText = award.text;
    const dated = !!(ranged.date || award.date);
    const startItem = (needItem || dated || (DATE_LINE.test(next) && titleParts.length === 1)) && titleText.length > 0 && titleText.length <= 80;
    if (startItem) {
      const bits = titleText.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);
      const title =
        type === "award"
          ? bits.join(" ")
          : (type === "work" || type === "internship" || type === "project" || type === "research") && bits.length > 1
            ? `${bits[0]} · ${bits.slice(1).join(" ")}`
            : bits.join(" · ");
      out.push(`### ${title}`);
      if (ranged.date) out.push(ranged.date);
      if (award.date) out.push(`- 日期：${award.date}`);
      for (const url of urls) out.push(`- 链接：${url}`);
      needItem = false;
      continue;
    }
    const peeled = peelUrl(line);
    if (peeled.text) out.push(peeled.text.startsWith("-") ? peeled.text : `- ${peeled.text}`);
    if (peeled.url) out.push(`- 链接：${peeled.url}`);
  }
  if (loose.length) {
    if (!out.some((l) => /^##\s+(自我评价|个人评价|个人总结|个人优势)/.test(l))) out.push("## 自我评价");
    for (const line of loose) out.push(line);
  }
  return out.join("\n") + "\n";
}

function isPdf(data: Uint8Array): boolean {
  const head = new TextDecoder("latin1").decode(data.subarray(0, Math.min(data.length, 1024))).trimStart();
  return head.startsWith("%PDF-");
}

function isEncrypted(data: Uint8Array): boolean {
  const sample = new TextDecoder("latin1").decode(data.subarray(0, Math.min(data.length, 256 * 1024)));
  return /\/Encrypt\b/.test(sample);
}

type PdfText = { str: string; transform: number[] };

/** 只去掉汉字与汉字之间的单个空格。两个及以上空格是栏与栏的间隔，必须留下。 */
function tightenCjk(s: string): string {
  return s.replace(/([\p{Script=Han}])[ \u00a0](?=[\p{Script=Han}])/gu, "$1");
}

function textWidth(it: PdfText): number {
  const scale = Math.abs(it.transform[0]) || Math.abs(it.transform[3]) || 10;
  let w = 0;
  for (const ch of it.str) w += (ch.codePointAt(0) ?? 0) > 255 ? scale * 0.85 : scale * 0.45;
  return Math.max(w, scale * 0.2);
}

function pageText(items: PdfText[]): string {
  const rows: { y: number; parts: PdfText[] }[] = [];
  for (const it of items) {
    if (!it.str.trim()) continue;
    const y = Math.round(it.transform[5]);
    let row = rows.find((r) => Math.abs(r.y - y) <= 2);
    if (!row) {
      row = { y, parts: [] };
      rows.push(row);
    }
    row.parts.push(it);
  }
  rows.sort((a, b) => b.y - a.y);
  return rows
    .map((r) => {
      const parts = [...r.parts].sort((a, b) => a.transform[4] - b.transform[4]);
      let line = "";
      let cursor = 0;
      for (const p of parts) {
        const x = p.transform[4];
        const scale = Math.abs(p.transform[0]) || 10;
        if (line) {
          const gap = x - cursor;
          const hanBoundary = /\p{Script=Han}$/u.test(line) && /^\p{Script=Han}/u.test(p.str);
          if (gap > scale * 0.35) line += hanBoundary ? "  " : " ";
          else if (gap > scale * 0.12 && !line.endsWith(" ")) line += " ";
        }
        line += p.str;
        cursor = x + textWidth(p);
      }
      return tightenCjk(line).trim();
    })
    .filter(Boolean)
    .join("\n");
}

async function useLocalPdfParser(): Promise<void> {
  const g = globalThis as { pdfjsWorker?: { WorkerMessageHandler?: unknown } };
  if (g.pdfjsWorker?.WorkerMessageHandler) return;
  // 解析器随页面打包，不设置 workerSrc，避免去拉 ./pdf.worker.mjs 或公共 CDN。
  g.pdfjsWorker = await import("pdfjs-dist/build/pdf.worker.min.mjs");
}

async function extractPdfText(data: Uint8Array): Promise<string> {
  await useLocalPdfParser();
  const { getDocument } = await import("pdfjs-dist");
  // 复制一份再交给解析器。pdf.js 会分离传入的缓冲区，不能动到调用方手里的那份。
  const bytes = new Uint8Array(data.byteLength);
  bytes.set(data);
  const task = getDocument({
    data: bytes,
    isEvalSupported: false,
    useSystemFonts: false,
    enableXfa: false,
    disableRange: true,
    disableStream: true,
  });
  try {
    const doc = await task.promise;
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const lines: PdfText[] = [];
      for (const it of content.items) {
        if ("str" in it && typeof it.str === "string" && "transform" in it && Array.isArray(it.transform)) lines.push({ str: it.str, transform: it.transform });
      }
      pages.push(pageText(lines));
      const annotations = (await page.getAnnotations()) as { subtype?: string; url?: string }[];
      const hay = pages.join("\n");
      for (const a of annotations) {
        if (a.subtype !== "Link" || !a.url) continue;
        const bare = a.url.replace(/^mailto:/i, "").replace(/^https?:\/\//i, "");
        if (hay.includes(a.url) || (bare.length > 0 && hay.includes(bare))) continue;
        pages.push(`链接：${a.url}`);
      }
    }
    return pages.join("\n");
  } finally {
    await task.destroy().catch(() => undefined);
  }
}

/** 在浏览器里读 PDF 文字并整理成简历。失败时不含 doc，调用方不得替换当前简历。 */
export async function importPdfBytes(data: Uint8Array): Promise<ImportResult> {
  if (data.byteLength > MAX_PDF_BYTES) {
    return fail(`这份 PDF 有 ${(data.byteLength / 1024 / 1024).toFixed(1)}MB，超过 8MB，没有导入。当前简历没有被替换。`);
  }
  if (!isPdf(data)) return fail("这不是有效的 PDF 文件。当前简历没有被替换。");
  if (isEncrypted(data)) return fail("这份 PDF 有密码，本地无法读取。请先去掉密码再导入。当前简历没有被替换。没有上传这份文件。");
  let text = "";
  try {
    text = await extractPdfText(data);
  } catch (e) {
    const name = (e as { name?: string }).name ?? "";
    if (name === "PasswordException") return fail("这份 PDF 有密码，本地无法读取。请先去掉密码再导入。当前简历没有被替换。没有上传这份文件。");
    return fail(`无法读取这份 PDF（${(e as Error).message || "文件已损坏"}）。当前简历没有被替换。`);
  }
  const plain = text.replace(/\u0000/g, "").trim();
  if (plain.length < 2) {
    return fail("这份 PDF 里没有可复制的文字，多半是扫描件或图片。当前没有视觉模型，不能识别图片里的字，也没有把文件上传。请换成可以选中文字的 PDF，或先整理成 Markdown / JSON。当前简历没有被替换。");
  }
  const parsed = fromMarkdown(pdfPlainTextToMarkdown(plain));
  const checked = validateDocument(parsed.doc);
  if (!checked.ok) {
    const detail = checked.issues.slice(0, 3).map((i) => `${i.path} ${i.message}`).join("；");
    return fail(`读到了文字，但整理后无法作为简历（${detail}）。当前简历没有被替换。`);
  }
  const name = checked.doc.modules.find((m) => m.type === "basic_info");
  const who = name && name.type === "basic_info" && name.data.name.trim() ? name.data.name.trim() : "未命名";
  const extra = parsed.warnings.length ? `有 ${parsed.warnings.length} 处没能归进模块。` : "";
  return { ok: true, doc: checked.doc, message: `已从 PDF 导入「${who}」。文字只在这台电脑上读取，没有上传。照片、颜色、分栏和精确间距不会保留。同一行里的学校、专业和日期会尽量拆开，拆不开的会留在标题里。扫描件里的图片文字仍无法识别。${extra}` };
}

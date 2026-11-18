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

export function pdfPlainTextToMarkdown(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((s) => s.replace(/[ \t\u00a0]+/g, " ").trim())
    .filter(Boolean);
  const out: string[] = [];
  let named = false;
  let type: ModuleType | null = null;
  let needItem = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const heading = line.replace(/[：:\s]+$/g, "");
    if (heading in HEADING_ALIASES) {
      type = HEADING_ALIASES[heading];
      needItem = EXPERIENCE.has(type);
      out.push(`## ${heading}`);
      continue;
    }
    if (!named && type === null) {
      out.push(`# ${line}`);
      named = true;
      continue;
    }
    if (type === null || type === "basic_info" || type === "job_intention") {
      const kv = line.match(/^([^：:]{1,12})[：:]\s*(.+)$/);
      out.push(kv ? `- ${kv[1]}：${kv[2]}` : `- ${line}`);
      continue;
    }
    if (type === "summary") {
      out.push(line);
      continue;
    }
    if (type === "skills") {
      out.push(line.startsWith("-") ? line : `- ${line}`);
      continue;
    }
    const next = lines[i + 1] ?? "";
    if (needItem || (EXPERIENCE.has(type) && DATE_LINE.test(next) && !DATE_LINE.test(line))) {
      out.push(`### ${line}`);
      needItem = false;
      continue;
    }
    if (DATE_LINE.test(line)) {
      out.push(line);
      continue;
    }
    out.push(line.startsWith("-") ? line : `- ${line}`);
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

function pageText(items: PdfText[]): string {
  const rows: { y: number; parts: { x: number; s: string }[] }[] = [];
  for (const it of items) {
    if (!it.str) continue;
    const y = Math.round(it.transform[5]);
    let row = rows.find((r) => Math.abs(r.y - y) <= 2);
    if (!row) {
      row = { y, parts: [] };
      rows.push(row);
    }
    row.parts.push({ x: it.transform[4], s: it.str });
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map((r) => r.parts.sort((a, b) => a.x - b.x).map((p) => p.s).join("")).join("\n");
}

async function extractPdfText(data: Uint8Array): Promise<string> {
  const { getDocument } = await import("pdfjs-dist");
  const task = getDocument({ data, isEvalSupported: false, useSystemFonts: false, disableWorker: true } as Parameters<typeof getDocument>[0]);
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
  return { ok: true, doc: checked.doc, message: `已从 PDF 导入「${who}」。文字只在这台电脑上读取，没有上传。${extra}` };
}

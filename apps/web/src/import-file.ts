// 导入 .ruye.json / .md / .pdf：纯函数，便于测试。不修改当前文档，由调用方决定如何替换
import { fromMarkdown, recoverDocument, validateDocument, type RuyeDocument } from "../../../packages/schema/src/index.ts";
import { extractTextFromPdf } from "./pdf-extract.ts";
import { parseResumeFromPdfLines } from "./pdf-resume.ts";

export type ImportResult =
  | { ok: true; doc: RuyeDocument; message: string; level?: "error"; sticky?: boolean }
  | { ok: false; message: string; sticky?: boolean };

/**
 * 同步解析 JSON 或 Markdown 文本
 */
export function parseImport(fileName: string, text: string): ImportResult {
  if (fileName.toLowerCase().endsWith(".json")) {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch (e) {
      return { ok: false, message: `导入失败：不是合法的 JSON（${(e as Error).message}）。当前内容没有被替换。`, sticky: true };
    }
    const recovered = recoverDocument(raw);
    if (!recovered) return { ok: false, message: "导入失败：这份 JSON 不是可恢复的如页简历，当前内容没有被替换。", sticky: true };
    if (recovered.issues.length > 0) {
      const detail = recovered.issues.slice(0, 3).map((i) => `${i.path} ${i.message}`).join("；");
      return { ok: true, doc: recovered.doc, message: `已导入，姓名和正文都保留着。有 ${recovered.issues.length} 处格式问题：${detail}`, level: "error", sticky: true };
    }
    return { ok: true, doc: recovered.doc, message: `已导入「${recovered.doc.meta.title}」。` };
  }
  const { doc, warnings } = fromMarkdown(text);
  const v = validateDocument(doc);
  if (!v.ok) return { ok: false, message: `导入失败：${v.issues.slice(0, 3).map((i) => `${i.path} ${i.message}`).join("；")}` };
  return { ok: true, doc, message: warnings.length ? `已导入，但有 ${warnings.length} 处没能识别：${warnings.slice(0, 3).join("；")}` : "已从 Markdown 导入。" };
}

/**
 * 异步解析 PDF 简历字节流
 */
export async function parsePdfImport(data: Uint8Array | ArrayBuffer, fileName = "导入的简历.pdf"): Promise<ImportResult> {
  try {
    const extracted = await extractTextFromPdf(data);
    if (!extracted.lines.length || !extracted.fullText.trim()) {
      return {
        ok: false,
        message: "导入失败：该 PDF 文件中未检测到可提取的文本（可能是纯图片扫描件），请使用含文本层的 PDF 简历。",
        sticky: true,
      };
    }

    const defaultTitle = fileName.replace(/\.[^/.]+$/, "") || "导入的简历";
    const { doc, warnings, recognizedModules } = parseResumeFromPdfLines(extracted.lines, defaultTitle);

    const moduleSummary = recognizedModules.length > 0 ? `，已识别模块：${recognizedModules.join("、")}` : "";
    const warningSummary = warnings.length > 0 ? `（有 ${warnings.length} 处格式微调：${warnings.slice(0, 2).join("；")}）` : "。";

    return {
      ok: true,
      doc,
      message: `已成功从 PDF 导入${moduleSummary}${warningSummary}请在右侧预览并核对。`,
    };
  } catch (e) {
    return {
      ok: false,
      message: `PDF 解析失败：${(e as Error).message || "文件格式可能损坏"}。`,
      sticky: true,
    };
  }
}

/**
 * 统一的异步导入入口，支持 .json、.md、.txt、.pdf
 */
export async function parseImportAsync(fileName: string, content: string | Uint8Array | ArrayBuffer): Promise<ImportResult> {
  if (fileName.toLowerCase().endsWith(".pdf")) {
    const bytes = typeof content === "string" ? new TextEncoder().encode(content) : content;
    return parsePdfImport(bytes, fileName);
  }

  const text = typeof content === "string" ? content : new TextDecoder("utf-8").decode(content);
  return parseImport(fileName, text);
}

// 导入 .ruye.json / .md / .txt / .pdf / .docx。不修改当前文档，由调用方决定如何替换。
// 二进制不会按文本解析。
import { fromMarkdown, recoverDocument, validateDocument, type RuyeDocument } from "../../../packages/schema/src/index.ts";
import { importDocxBytes } from "./docx.ts";
import { importPdfBytes } from "./pdf-import.ts";

export type ImportResult =
  | { ok: true; doc: RuyeDocument; message: string; level?: "error"; sticky?: boolean }
  | { ok: false; message: string; sticky?: boolean };

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

function latin(data: Uint8Array, n: number): string {
  return new TextDecoder("latin1").decode(data.subarray(0, Math.min(data.length, n)));
}

function isZip(data: Uint8Array): boolean {
  return data.length >= 4 && data[0] === 0x50 && data[1] === 0x4b && data[2] === 3 && data[3] === 4;
}

/** 按扩展名和文件头分流。失败时不含 doc。 */
export async function importFileBytes(fileName: string, mime: string, data: Uint8Array): Promise<ImportResult> {
  const lower = fileName.toLowerCase();
  const head = latin(data, 5).trimStart();
  if (lower.endsWith(".doc") && !lower.endsWith(".docx")) {
    return { ok: false, message: "旧版 .doc 不能安全解析。请另存为 .docx 后再导入。当前简历没有被替换。", sticky: true };
  }
  if (lower.endsWith(".pdf") || mime === "application/pdf") return importPdfBytes(data);
  if (lower.endsWith(".docx") || mime.includes("wordprocessingml")) return importDocxBytes(data);
  if (head.startsWith("%PDF-") || isZip(data)) {
    return { ok: false, message: "这是二进制文件，不能按文本读取。请使用 .pdf 或 .docx。当前简历没有被替换。", sticky: true };
  }
  return parseImport(fileName, new TextDecoder().decode(data));
}

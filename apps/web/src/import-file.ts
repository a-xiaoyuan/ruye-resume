// 导入 .ruye.json / .md：纯函数，便于测试。不修改当前文档，由调用方决定如何替换
import { fromMarkdown, recoverDocument, validateDocument, type RuyeDocument } from "../../../packages/schema/src/index.ts";

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

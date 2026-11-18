// PDF 文本与排版几何提取：使用 pdfjs-dist 提取页面文字、坐标与行结构
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";

export interface TextItemInfo {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExtractedLine {
  text: string;
  y: number;
  height: number;
  minX: number;
  maxX: number;
}

export interface ExtractedPage {
  pageNumber: number;
  lines: ExtractedLine[];
  text: string;
}

export interface PdfExtractResult {
  numPages: number;
  pages: ExtractedPage[];
  fullText: string;
  lines: string[];
}

/**
 * 确保在浏览器环境中正确配置 PDF.js Worker 路径
 * Node.js 环境下跳过（Node.js 不依赖 Web Worker）
 */
function ensureWorkerConfigured(): void {
  if (typeof window === "undefined") return;
  if (GlobalWorkerOptions.workerSrc) return;

  const base = (typeof import.meta !== "undefined" && (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL) || "./";
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  GlobalWorkerOptions.workerSrc = new URL(`${normalizedBase}pdf.worker.min.mjs`, window.location.href).href;
}

/**
 * 从 PDF 二进制字节流中提取文本
 * 按 PDF 页面及空间坐标聚合成行，保留从上到下、从左到右的自然阅读顺序
 */
export async function extractTextFromPdf(data: Uint8Array | ArrayBuffer): Promise<PdfExtractResult> {
  ensureWorkerConfigured();

  const rawBytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  // 强制构造纯粹的 Uint8Array，避免 Node.js 环境下 Buffer 触发 pdfjs-dist 的类型检查异常
  const bytes = new Uint8Array(rawBytes.byteLength);
  bytes.set(rawBytes);

  const loadingTask = getDocument({
    data: bytes,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  const pages: ExtractedPage[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items: TextItemInfo[] = [];

    for (const item of textContent.items) {
      if (!("str" in item) || typeof item.str !== "string") continue;
      const str = item.str.replace(/\u0000/g, "").trim();
      if (!str) continue;

      const transform = item.transform; // [scaleX, skewY, skewX, scaleY, tx, ty]
      const tx = transform[4];
      const ty = transform[5];
      const width = item.width || 0;
      const height = item.height || Math.hypot(transform[2], transform[3]) || 12;

      items.push({
        str: item.str,
        x: tx,
        y: ty,
        width,
        height,
      });
    }

    const lines = clusterItemsToLines(items);
    const pageText = lines.map((l) => l.text).join("\n");
    pages.push({
      pageNumber: pageNum,
      lines,
      text: pageText,
    });
  }

  const allLines = pages.flatMap((p) => p.lines.map((l) => l.text));
  const fullText = pages.map((p) => p.text).join("\n\n");

  return {
    numPages,
    pages,
    fullText,
    lines: allLines,
  };
}

/**
 * 将散落的文字块根据 Y 轴坐标（降序）聚合成行，行内根据 X 轴坐标（升序）拼接
 * 并支持双栏布局识别（防止左右分栏文字因高度接近被交错拼接）
 */
function clusterItemsToLines(items: TextItemInfo[]): ExtractedLine[] {
  if (items.length === 0) return [];

  // 1. 检查是否存在双栏排版：
  // 统计 X 坐标分布。若有大量元素分别聚集在左半区和右半区，且中间有明显空白间隙
  const isMultiColumn = detectColumns(items);
  if (isMultiColumn) {
    const { leftItems, rightItems } = isMultiColumn;
    const leftLines = clusterSingleColumn(leftItems);
    const rightLines = clusterSingleColumn(rightItems);
    return [...leftLines, ...rightLines];
  }

  return clusterSingleColumn(items);
}

function detectColumns(items: TextItemInfo[]): { leftItems: TextItemInfo[]; rightItems: TextItemInfo[] } | null {
  if (items.length < 25) return null;

  const xs = items.map((it) => it.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...items.map((it) => it.x + it.width));
  const width = maxX - minX;

  // 仅在宽度较大（常见 A4 宽度 400~600pt）时检测分栏
  if (width < 350) return null;

  const mid = minX + width * 0.45;
  const midRight = minX + width * 0.55;

  let leftCount = 0;
  let rightCount = 0;
  let spanCount = 0;

  for (const it of items) {
    const rightEdge = it.x + it.width;
    if (rightEdge < mid) {
      leftCount++;
    } else if (it.x > midRight) {
      rightCount++;
    } else if (it.x < mid && rightEdge > midRight) {
      spanCount++;
    }
  }

  // 若左右两栏元素数量都很充足，且跨栏元素极少，则视为典型双栏布局
  if (leftCount >= 10 && rightCount >= 10 && spanCount <= (leftCount + rightCount) * 0.08) {
    const splitX = minX + width * 0.48;
    return {
      leftItems: items.filter((it) => it.x < splitX),
      rightItems: items.filter((it) => it.x >= splitX),
    };
  }

  return null;
}

function clusterSingleColumn(items: TextItemInfo[]): ExtractedLine[] {
  if (items.length === 0) return [];

  // PDF 的 Y 轴原点在左下角，越靠上 Y 值越大。因此 Y 降序代表从上到下。
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);

  const lines: ExtractedLine[] = [];
  let currentGroup: TextItemInfo[] = [];
  let currentY = sorted[0].y;
  let currentH = sorted[0].height;

  for (const item of sorted) {
    const tolerance = Math.max(3, currentH * 0.4);
    if (Math.abs(item.y - currentY) <= tolerance) {
      currentGroup.push(item);
      currentY = (currentY + item.y) / 2; // 动态更新行基准 Y
      currentH = Math.max(currentH, item.height);
    } else {
      lines.push(buildLine(currentGroup, currentY, currentH));
      currentGroup = [item];
      currentY = item.y;
      currentH = item.height;
    }
  }

  if (currentGroup.length > 0) {
    lines.push(buildLine(currentGroup, currentY, currentH));
  }

  return lines.filter((l) => l.text.trim().length > 0);
}

function buildLine(items: TextItemInfo[], y: number, height: number): ExtractedLine {
  items.sort((a, b) => a.x - b.x);

  let result = "";
  let lastRight = -1;
  let minX = Infinity;
  let maxX = -Infinity;

  for (const it of items) {
    minX = Math.min(minX, it.x);
    maxX = Math.max(maxX, it.x + it.width);

    if (lastRight >= 0) {
      const gap = it.x - lastRight;
      // 若水平间距较大（>3.5pt）且两端是非空白字符，适当补一个半角空格
      if (gap > 3.5 && result.length > 0 && !result.endsWith(" ") && !it.str.startsWith(" ")) {
        // 如果前后都是英文字母或数字，补空格；如果都是汉字且间距不算非常大，不补空格
        const prevChar = result[result.length - 1];
        const nextChar = it.str[0];
        const isPrevAscii = /[a-zA-Z0-9]/.test(prevChar);
        const isNextAscii = /[a-zA-Z0-9]/.test(nextChar);
        if (isPrevAscii || isNextAscii || gap > 12) {
          result += " ";
        }
      }
    }

    result += it.str;
    lastRight = it.x + it.width;
  }

  return {
    text: normalizeExtractedLine(result),
    y,
    height,
    minX: minX === Infinity ? 0 : minX,
    maxX: maxX === -Infinity ? 0 : maxX,
  };
}

function normalizeExtractedLine(str: string): string {
  return str
    .replace(/\u00a0/g, " ") // 不间断空格转普通空格
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // 清除零宽字符
    .replace(/[ \t]+/g, " ") // 合并连续空白字符
    .trim();
}

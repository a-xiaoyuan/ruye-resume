// 本地 DOCX：真正的段落、标题、列表和超链接，不是把整页截图塞进 Word。
// 只读写压缩包里的 XML，不执行宏，不下载外部图片或链接。
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { fromMarkdown, MODULE_LABELS, validateDocument, type Module, type RuyeDocument } from "../../../packages/schema/src/index.ts";
import { decodeDataUrl } from "../../../packages/templates/src/index.ts";
import type { ImportResult } from "./import-file.ts";

const MAX_DOCX_BYTES = 8 * 1024 * 1024;
const MAX_UNPACKED = 20 * 1024 * 1024;

export interface DocxExport {
  bytes: Uint8Array;
  /** 用户必须看到的取舍，避免静默丢掉照片或版式 */
  notes: string[];
}

function fail(message: string): ImportResult {
  return { ok: false, message, sticky: true };
}

function xml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function unescapeXml(s: string): string {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

function textRun(text: string): string {
  const space = /^\s|\s$/.test(text) ? ` xml:space="preserve"` : "";
  return `<w:r><w:t${space}>${xml(text)}</w:t></w:r>`;
}

function paragraph(inner: string, style?: string, list = false): string {
  const props = [
    style ? `<w:pStyle w:val="${style}"/>` : "",
    list ? `<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>` : "",
  ].join("");
  return `<w:p>${props ? `<w:pPr>${props}</w:pPr>` : ""}${inner}</w:p>`;
}

function heading(level: 1 | 2 | 3, text: string): string {
  return paragraph(textRun(text), `Heading${level}`);
}

function dateRange(start?: string, end?: string): string {
  const show = (d?: string) => (!d ? "" : d === "至今" ? d : d.replace(/-/g, "."));
  const a = show(start);
  const b = show(end);
  if (!a && !b) return "";
  return `${a} - ${b}`.trim();
}

function joinTitle(...parts: (string | undefined)[]): string {
  return parts.filter((p): p is string => !!p && p.trim() !== "").join(" · ");
}

interface Built {
  body: string[];
  rels: string[];
  media: Record<string, Uint8Array>;
  notes: string[];
  nextId: number;
}

function linkParagraph(b: Built, label: string, url: string): void {
  const id = `rIdL${b.nextId++}`;
  b.rels.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xml(url)}" TargetMode="External"/>`);
  b.body.push(paragraph(`${textRun(`${label}：`)}<w:hyperlink r:id="${id}">${textRun(url)}</w:hyperlink>`));
}

function plainList(b: Built, text: string): void {
  b.body.push(paragraph(textRun(text), undefined, true));
}

function addPhoto(b: Built, dataUrl: string | undefined): void {
  if (!dataUrl) return;
  const decoded = decodeDataUrl(dataUrl);
  if (!decoded || (decoded.ext !== "png" && decoded.ext !== "jpg")) {
    b.notes.push("照片不是 PNG 或 JPEG，没有写进 Word。请用 JSON 或 Markdown 保留原照片。");
    b.body.push(paragraph(textRun("照片未写入：只支持 PNG 或 JPEG。原照片仍在 JSON / Markdown 里。")));
    return;
  }
  const id = `rIdImg${b.nextId++}`;
  const name = `media/photo.${decoded.ext}`;
  b.media[`word/${name}`] = decoded.bytes;
  b.rels.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${name}"/>`);
  const cx = 731520;
  const cy = 975360;
  b.body.push(
    paragraph(`<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="1" name="photo"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="1" name="photo"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`),
  );
}

function addModule(b: Built, m: Module): void {
  if (m.type === "basic_info") {
    b.body.push(heading(1, m.data.name || "未命名"));
    addPhoto(b, m.data.photoDataUrl);
    const fields: [string, string | undefined][] = [
      ["电话", m.data.phone],
      ["邮箱", m.data.email],
      ["地点", m.data.location],
      ["性别", m.data.gender],
      ["生日", m.data.birthday],
      ["网站", m.data.website],
      ["GitHub", m.data.github],
      ["博客", m.data.blog],
    ];
    for (const [label, value] of fields) {
      if (!value?.trim()) continue;
      if (/^https?:\/\//i.test(value) || label === "GitHub" || label === "网站" || label === "博客") linkParagraph(b, label, value);
      else plainList(b, `${label}：${value}`);
    }
    for (const l of m.data.customLinks ?? []) if (l.url.trim()) linkParagraph(b, l.label || "链接", l.url);
    return;
  }
  b.body.push(heading(2, MODULE_LABELS[m.type]));
  if (m.type === "job_intention") {
    for (const [label, value] of [
      ["岗位", m.data.role],
      ["城市", m.data.city],
      ["到岗", m.data.availability],
      ["期望薪资", m.data.salary],
    ] as const) {
      if (value?.trim()) plainList(b, `${label}：${value}`);
    }
    return;
  }
  if (m.type === "summary") {
    for (const line of m.data.text.split("\n")) if (line.trim()) b.body.push(paragraph(textRun(line.trim())));
    return;
  }
  if (m.type === "skills") {
    for (const c of m.data.categories) plainList(b, `${c.name}：${c.items.join("、")}`);
    for (const n of m.data.notes ?? []) if (n.trim()) plainList(b, n.trim());
    return;
  }
  if (!("items" in m.data)) return;
  for (const it of m.data.items as unknown as Record<string, unknown>[]) {
    const title =
      m.type === "education"
        ? joinTitle(it.school as string, it.major as string, it.degree as string)
        : m.type === "work" || m.type === "internship"
          ? joinTitle(it.org as string, it.title as string)
          : m.type === "project"
            ? joinTitle(it.name as string, it.role as string)
            : m.type === "research"
              ? joinTitle(it.name as string, it.org as string)
              : m.type === "paper"
                ? String(it.title ?? "")
                : joinTitle(it.name as string, it.issuer as string);
    b.body.push(heading(3, title || "未命名"));
    const range = dateRange(it.start as string | undefined, it.end as string | undefined);
    if (range) b.body.push(paragraph(textRun(range)));
    if (typeof it.summary === "string" && it.summary.trim()) plainList(b, `简介：${it.summary}`);
    if (Array.isArray(it.techStack) && it.techStack.length) plainList(b, `技术栈：${(it.techStack as string[]).join("、")}`);
    if (typeof it.url === "string" && it.url.trim()) linkParagraph(b, "链接", it.url);
    if (typeof it.venue === "string" && it.venue.trim()) plainList(b, `期刊/会议：${it.venue}`);
    if (typeof it.authors === "string" && it.authors.trim()) plainList(b, `作者：${it.authors}`);
    if (typeof it.date === "string" && it.date.trim()) plainList(b, `日期：${it.date}`);
    if (typeof it.description === "string" && it.description.trim()) plainList(b, `说明：${it.description}`);
    const bullets = (Array.isArray(it.highlights) ? it.highlights : Array.isArray(it.bullets) ? it.bullets : []) as string[];
    for (const bullet of bullets) if (bullet.trim()) plainList(b, bullet.trim());
  }
}

/** 导出可编辑的 DOCX。颜色、分栏和精确间距不会保留。 */
export function exportDocx(doc: RuyeDocument): DocxExport {
  const b: Built = { body: [], rels: [], media: {}, notes: ["颜色、分栏和精确间距不会保留，文字、标题、列表和链接会保留。"], nextId: 1 };
  for (const m of doc.modules) {
    if (!m.visible) continue;
    addModule(b, m);
  }
  b.notes.push("这份 Word 是段落和列表，不是整页图片。");
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${b.body.join("")}<w:sectPr/></w:body></w:document>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>${b.rels.join("")}</Relationships>`;
  const overrides = Object.keys(b.media)
    .map((path) => {
      const part = path.replace(/^word\//, "");
      const type = part.endsWith(".png") ? "image/png" : "image/jpeg";
      return `<Override PartName="/word/${part}" ContentType="${type}"/>`;
    })
    .join("");
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>${overrides}</Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`),
    "word/document.xml": strToU8(documentXml),
    "word/_rels/document.xml.rels": strToU8(rels),
    "word/styles.xml": strToU8(STYLES),
    "word/numbering.xml": strToU8(NUMBERING),
    ...b.media,
  };
  return { bytes: zipSync(files), notes: b.notes };
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:pPr><w:outlineLvl w:val="2"/></w:pPr></w:style></w:styles>`;

const NUMBERING = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;

function unzip(data: Uint8Array): Record<string, Uint8Array> {
  const files = unzipSync(data);
  let total = 0;
  for (const bytes of Object.values(files)) {
    total += bytes.length;
    if (total > MAX_UNPACKED) throw new Error("解压后超过 20MB");
  }
  return files;
}

function readXml(files: Record<string, Uint8Array>, path: string): string | null {
  const hit = Object.keys(files).find((k) => k.replace(/\\/g, "/").toLowerCase() === path.toLowerCase());
  return hit ? strFromU8(files[hit]) : null;
}

interface Rel {
  id: string;
  target: string;
  type: string;
  external: boolean;
}

function readRels(xmlText: string): Rel[] {
  const out: Rel[] = [];
  for (const tag of xmlText.match(/<Relationship\b[^>]*\/>/g) ?? []) {
    const attr = Object.fromEntries([...tag.matchAll(/([\w:]+)="([^"]*)"/g)].map((m) => [m[1], unescapeXml(m[2])]));
    if (!attr.Id || !attr.Target) continue;
    out.push({ id: attr.Id, target: attr.Target, type: attr.Type ?? "", external: attr.TargetMode === "External" || /^[a-z]+:/i.test(attr.Target) });
  }
  return out;
}

function paragraphText(chunk: string, rels: Rel[]): { text: string; url?: string } {
  let url: string | undefined;
  const link = chunk.match(/<w:hyperlink\b([^>]*)>/);
  if (link) {
    const id = link[1].match(/\br:id="([^"]+)"/)?.[1];
    const rel = rels.find((r) => r.id === id);
    if (rel?.external && /^(https?:|mailto:)/i.test(rel.target)) url = rel.target;
  }
  const text = [...chunk.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => unescapeXml(m[1])).join("");
  return { text, url };
}

function docxToMarkdown(files: Record<string, Uint8Array>): { markdown: string; notes: string[] } {
  const notes: string[] = [];
  if (Object.keys(files).some((k) => k.toLowerCase().includes("vbaproject.bin"))) notes.push("发现宏，已忽略，没有执行。");
  const documentXml = readXml(files, "word/document.xml");
  if (!documentXml) throw new Error("没有 word/document.xml");
  const rels = readRels(readXml(files, "word/_rels/document.xml.rels") ?? "");
  let photo: string | null = null;
  for (const rel of rels) {
    if (!rel.type.includes("/image")) continue;
    if (rel.external) {
      notes.push("外部图片没有下载。");
      continue;
    }
    const path = rel.target.replace(/^\/+/, "").replace(/^\.\.\//, "");
    const key = Object.keys(files).find((k) => k.replace(/\\/g, "/").endsWith(path));
    const bytes = key ? files[key] : undefined;
    if (!bytes || photo) continue;
    const png = bytes[0] === 0x89 && bytes[1] === 0x50;
    const jpg = bytes[0] === 0xff && bytes[1] === 0xd8;
    if (!png && !jpg) continue;
    let bin = "";
    for (const byte of bytes) bin += String.fromCharCode(byte);
    photo = `data:image/${png ? "png" : "jpeg"};base64,${btoa(bin)}`;
  }
  const chunks = documentXml.split(/<w:p[ >]/).slice(1).map((p) => p.split(/<\/w:p>/)[0]);
  const lines: string[] = [];
  let photoPlaced = false;
  const placePhoto = () => {
    if (photo && !photoPlaced) {
      lines.push(`![照片](${photo})`);
      photoPlaced = true;
    }
  };
  for (const chunk of chunks) {
    const { text, url } = paragraphText(chunk, rels);
    const value = text.trim();
    if (!value && !url) continue;
    const style = chunk.match(/<w:pStyle\b[^>]*w:val="([^"]+)"/)?.[1] ?? "";
    const outline = chunk.match(/<w:outlineLvl\b[^>]*w:val="(\d+)"/)?.[1];
    const list = /<w:numPr[\s>]/.test(chunk);
    const level = /^Heading1$/i.test(style) || outline === "0" ? 1 : /^Heading2$/i.test(style) || outline === "1" ? 2 : /^Heading3$/i.test(style) || outline === "2" ? 3 : 0;
    if (level === 1) {
      lines.push(`# ${value}`);
      placePhoto();
      continue;
    }
    else if (level === 2) lines.push(`## ${value}`);
    else if (level === 3) lines.push(`### ${value}`);
    else if (url && !value.includes(url)) lines.push(`- 链接：${url}`);
    else if (list) lines.push(`- ${value}`);
    else lines.push(value);
  }
  return { markdown: lines.join("\n") + "\n", notes };
}

export async function importDocxBytes(data: Uint8Array): Promise<ImportResult> {
  if (data.byteLength > MAX_DOCX_BYTES) return fail(`这份 Word 有 ${(data.byteLength / 1024 / 1024).toFixed(1)}MB，超过 8MB，没有导入。当前简历没有被替换。`);
  if (!(data[0] === 0x50 && data[1] === 0x4b)) return fail("这不是有效的 .docx 文件。当前简历没有被替换。");
  let files: Record<string, Uint8Array>;
  try {
    files = unzip(data);
  } catch (e) {
    return fail(`无法打开这份 Word（${(e as Error).message || "文件已损坏"}）。当前简历没有被替换。没有上传这份文件。`);
  }
  let markdown: string;
  let notes: string[];
  try {
    ({ markdown, notes } = docxToMarkdown(files));
  } catch (e) {
    return fail(`无法读取这份 Word（${(e as Error).message}）。当前简历没有被替换。没有上传这份文件。`);
  }
  if (markdown.replace(/!\[[^\]]*\]\([^)]*\)/g, "").trim().length < 2) {
    return fail("这份 Word 里没有可编辑的文字。当前简历没有被替换。没有上传这份文件。");
  }
  const parsed = fromMarkdown(markdown);
  const checked = validateDocument(parsed.doc);
  if (!checked.ok) {
    const detail = checked.issues.slice(0, 3).map((i) => `${i.path} ${i.message}`).join("；");
    return fail(`读到了文字，但整理后无法作为简历（${detail}）。当前简历没有被替换。`);
  }
  const name = checked.doc.modules.find((m) => m.type === "basic_info");
  const who = name && name.type === "basic_info" && name.data.name.trim() ? name.data.name.trim() : "未命名";
  const extra = [...notes, parsed.warnings.length ? `有 ${parsed.warnings.length} 处没能归进模块。` : ""].filter(Boolean).join("");
  return { ok: true, doc: checked.doc, message: `已从 Word 导入「${who}」。只读取了文档里的文字和内嵌图片，没有执行宏，也没有上传。${extra}` };
}

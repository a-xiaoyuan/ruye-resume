// 粘贴处理：从旧简历、Word、网页复制过来的文字

/** 粘贴的多行文字拆成要点：去掉行首的 •、-、*、·、1.、1、、(1)、① 之类，丢掉空行 */
export function splitPastedLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[•·●○■□◆◇▪▸►\-*–—]+|\(?\d{1,2}[.)、．）](?!\d)|[①-⑳])\s*/u, "").trim())
    .filter(Boolean);
}

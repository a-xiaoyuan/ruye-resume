// 日期选择器用到的纯函数（便于测试）。简历里的日期一律是 YYYY-MM，个别奖项、论文可以到日：YYYY-MM-DD

export interface YM {
  y: number;
  m: number; // 1–12
}

/** "2024-09" / "2024-09-15" → { y: 2024, m: 9 }；空、「至今」、无法识别 → null */
export function parseYM(v: string | undefined): YM | null {
  const m = /^(\d{4})-(\d{2})/.exec(v ?? "");
  if (!m) return null;
  const month = Number(m[2]);
  return month >= 1 && month <= 12 ? { y: Number(m[1]), m: month } : null;
}

export function formatYM({ y, m }: YM): string {
  return `${y}-${String(m).padStart(2, "0")}`;
}

/** 按钮上显示的文字：2024 年 9 月 / 2024 年 9 月 15 日 / 至今 */
export function displayDate(v: string | undefined): string {
  if (!v) return "";
  if (v === "至今") return "至今";
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(v);
  if (!m) return v;
  return `${m[1]} 年 ${Number(m[2])} 月${m[3] ? ` ${Number(m[3])} 日` : ""}`;
}

/** 结束早于开始？「至今」和空值不比较 */
export function endBeforeStart(start: string | undefined, end: string | undefined): boolean {
  const s = parseYM(start);
  const e = parseYM(end);
  if (!s || !e) return false;
  return e.y * 12 + e.m < s.y * 12 + s.m;
}

/**
 * 打开选择器时先翻到哪一年：有值就是那一年；结束日期没值时跟开始日期同年；
 * 都没有就按当前年份（开始日期往前一年，学校、项目多半是过去开始的）
 */
export function initialYear(value: string | undefined, related: string | undefined, kind: "start" | "end" | "single", now = new Date()): number {
  const own = parseYM(value);
  if (own) return own.y;
  const rel = parseYM(related);
  if (rel) return rel.y;
  return kind === "start" ? now.getFullYear() - 1 : now.getFullYear();
}

// 写作检查：不影响导出，只给出可以改进的地方。规则都很保守，宁可少提示也不误报。
import type { Module, RuyeDocument } from "./types.ts";

export interface LintIssue {
  moduleId: string;
  /** 条目 id（经历、项目等）；模块级提示时为空 */
  itemId?: string;
  /** 要点序号（从 0 开始） */
  index?: number;
  level: "warn" | "tip";
  message: string;
}

const SUBHEAD = /^[^：:，,。；;]{1,12}[：:]\s*$/;
const HAS_NUMBER = /\d|[一二三四五六七八九十百千万亿两]+\s*(倍|个|项|次|人|家|名|条|份|万|亿|%)|翻倍|减半/;
const WEAK_START = /^(负责|参与|协助|配合)/;
const MAX_BULLET = 90;

const isText = (s: unknown): s is string => typeof s === "string" && s.trim() !== "";
const len = (s: string) => [...s.trim()].length;

/** 有要点的模块：经历、项目、科研 */
function bulletsOf(m: Module): { id: string; bullets: string[] }[] {
  if (m.type === "work" || m.type === "internship" || m.type === "project" || m.type === "research") {
    return m.data.items.map((it) => ({ id: it.id, bullets: (it.bullets ?? []).filter(isText) }));
  }
  return [];
}

export function lintDocument(doc: RuyeDocument): LintIssue[] {
  const out: LintIssue[] = [];
  const seen = new Map<string, string>();

  for (const m of doc.modules) {
    if (!m.visible) continue;

    if (m.type === "basic_info" && !isText(m.data.phone) && !isText(m.data.email)) {
      out.push({ moduleId: m.id, level: "warn", message: "没有留电话或邮箱，HR 无法联系你。" });
    }
    if (m.type === "job_intention" && !isText(m.data.role)) {
      out.push({ moduleId: m.id, level: "tip", message: "写上目标岗位（如「Java 后端开发」），筛简历的人第一眼就能对上号。" });
    }

    if (m.type === "skills") {
      const notes = (m.data.notes ?? []).filter(isText);
      const mastered = notes.filter((n) => n.trim().startsWith("精通")).length;
      if (mastered >= 3) {
        out.push({ moduleId: m.id, level: "tip", message: `有 ${mastered} 条写了「精通」。面试官会按「精通」来追问，建议只留给真正最拿手的一两项。` });
      }
    }

    if (m.type === "summary" && len(m.data.text) > 200) {
      out.push({ moduleId: m.id, level: "tip", message: `自我评价有 ${len(m.data.text)} 字，建议控制在 100 字左右，写一两条有事实支撑的特点。` });
    }

    for (const item of bulletsOf(m)) {
      const real = item.bullets.map((b, i) => ({ b: b.trim(), i })).filter((x) => !SUBHEAD.test(x.b));
      if (real.length === 0) {
        out.push({ moduleId: m.id, itemId: item.id, level: "warn", message: "还没有写内容：写清你做了什么、用了什么、结果如何。" });
        continue;
      }
      if (real.length >= 2 && !real.some((x) => HAS_NUMBER.test(x.b))) {
        out.push({ moduleId: m.id, itemId: item.id, level: "tip", message: "这段经历没有任何量化结果。加上规模、耗时、比例等数字，比形容词更有说服力。" });
      }
      for (const { b, i } of real) {
        if (len(b) > MAX_BULLET) {
          out.push({ moduleId: m.id, itemId: item.id, index: i, level: "tip", message: `第 ${i + 1} 条有 ${len(b)} 字，建议拆成两条，或精简到 60 字以内。` });
        }
        if (WEAK_START.test(b) && len(b) < 16) {
          out.push({ moduleId: m.id, itemId: item.id, index: i, level: "tip", message: `第 ${i + 1} 条只写了「${b.slice(0, 2)}」什么，补上你具体做了什么、结果如何。` });
        }
        const key = b.replace(/\s+/g, "");
        const prev = seen.get(key);
        if (prev !== undefined) {
          out.push({ moduleId: m.id, itemId: item.id, index: i, level: "warn", message: `第 ${i + 1} 条和其他经历里的一条完全相同。` });
        } else seen.set(key, item.id);
      }
    }
  }
  return out;
}

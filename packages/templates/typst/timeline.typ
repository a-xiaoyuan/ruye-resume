// 如页 · timeline「时间轴」
// 经历类模块按时间轴排：左侧时间列（主色、右对齐），中间一条竖线和圆点，右侧是条目内容。
// 模块标题是浅色底的圆角标签条；页眉姓名在左、联系方式竖排在右。原创版式。
#import "common.typ": *

#set page(width: 210mm, height: page-height, margin: page-margin, footer: page-footer)
#set text(font: sans, size: body-size, fill: ink, lang: "zh", region: "cn", top-edge: 0.88em, bottom-edge: -0.12em)
#set par(leading: lead, spacing: lead, justify: true)
#set block(spacing: 0pt)

#let date-w = 21mm
#let date-pad = 3.4mm
#let rail-gap = 4.2mm

#let section-head(title, type) = block(breakable: false, width: 100%, fill: tint, radius: 1.2mm, inset: (x: 2.6mm, y: 1.3mm), grid(
  columns: (auto, auto),
  column-gutter: 0.5em,
  align: (left + horizon, left + horizon),
  svg-image(section-icon-svg.at(type, default: section-icon-svg.project), accent, 1em),
  text(size: t.headingPt * 1pt, weight: "bold", fill: accent, tracking: 0.1em)[#title],
))

// 时间列文字：起止日期分两行，窄列里不折行
#let when(a, b) = {
  let x = fmt-date(a)
  let y = fmt-date(b)
  set par(justify: false)
  set text(size: meta-size, number-width: "tabular")
  align(right, {
    if x != "" { text(fill: accent, weight: "medium")[#x] }
    if y != "" { linebreak(); text(fill: muted)[– #y] }
  })
}

// 一个带时间轴的条目：左列日期，右列内容，右列左边是竖线，标题处有一个圆点
#let rail-item(date, units) = grid(
  columns: (date-w, 1fr),
  column-gutter: date-pad,
  date,
  block(stroke: (left: 0.9pt + accent.lighten(60%)), inset: (left: rail-gap), {
    place(top + left, dx: -rail-gap - 1.15mm, dy: 0.32em, circle(radius: 1.15mm, fill: white, stroke: 1.4pt + accent))
    for (j, u) in units.enumerate() {
      if j > 0 { gap(t.paragraphGapMm) }
      u
    }
  }),
)

// 不按时间排的模块（技能、获奖、论文、自我评价）占满整行，不浪费时间列的宽度
#let plain-item(units) = block({
  for (j, u) in units.enumerate() {
    if j > 0 { gap(t.paragraphGapMm) }
    u
  }
})

#let timed = ("education", "work", "internship", "project", "research")

#let header() = {
  let lhs = {
    set par(justify: false)
    if basic-module != none {
      block(text(size: t.namePt * 1.15pt, weight: "bold", fill: accent, tracking: 0.08em)[#basic-module.data.name])
    }
    if intention-module != none {
      let r = intention-row(intention-module.data)
      if r != none { v(lead + 2.2mm); block(r) }
    }
  }
  let items = if basic-module != none { contact-items(basic-module.data) } else { () }
  let rhs = if items.len() > 0 {
    set align(left)
    set par(justify: false)
    text(size: meta-size, fill: muted, stack(spacing: lead * 0.7, ..items.map(((ic, c)) => box[#icon(ic, color: accent) #h(0.3em) #c])))
  }
  let cols = if photo-path != none { (1fr, auto, 20mm) } else { (1fr, auto) }
  let cells = (lhs, rhs) + if photo-path != none { (photo-box(20mm),) } else { () }
  block(breakable: false, {
    grid(columns: cols, column-gutter: 6mm, align: (left + horizon, left + horizon, right + top), ..cells)
    v(3mm)
    line(length: 100%, stroke: 1.2pt + accent)
  })
}

#header()
#if body-modules.len() > 0 { gap(t.sectionGapMm) }
#for (i, m) in body-modules.enumerate() {
  if i > 0 { gap(t.sectionGapMm) }
  let items = module-items(m)
  if items.len() == 0 { continue }
  // 时间轴模块的日期在左列；获奖、论文这类单行条目的日期仍放在行尾
  date-style.update(if m.type in timed { "none" } else { "accent" })
  let rows = if m.type in timed {
    m.data.items.zip(items).map(((it, units)) => rail-item(when(get(it, "start"), get(it, "end")), units))
  } else {
    items.map(plain-item)
  }
  // 标题与第一个条目绑在一起，避免标题落在页底
  block(breakable: false, {
    section-head(module-labels.at(m.type), m.type)
    v(if compact { 1.4mm } else { 2.2mm })
    rows.at(0)
  })
  for r in rows.slice(1) {
    gap(t.itemGapMm)
    r
  }
}

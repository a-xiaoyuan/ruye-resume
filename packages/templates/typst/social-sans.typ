// 如页 · social-sans（社招单栏）
// 全无衬线、信息密度更高。页眉左侧姓名与意向，右侧联系方式竖排；模块标题是浅色底带。原创版式。
#import "common.typ": *

#set page(width: 210mm, height: page-height, margin: page-margin)
#set text(font: sans, size: body-size, fill: ink, lang: "zh", region: "cn", top-edge: 0.88em, bottom-edge: -0.12em)
#set par(leading: lead, spacing: lead, justify: true)
#set block(spacing: 0pt)

// 模块标题：浅色底带 + 左侧色条
#let section-head(title) = block(
  breakable: false,
  width: 100%,
  fill: tint,
  radius: (right: 2pt),
  stroke: (left: 2.4pt + accent),
  inset: (left: 0.6em, y: 0.28em),
  text(size: t.headingPt * 1pt, weight: "bold", fill: accent, tracking: 0.1em)[#title],
)

#let header() = {
  let left-lines = ()
  if basic-module != none {
    left-lines.push(text(size: t.namePt * 1pt, weight: "bold", fill: ink, tracking: 0.06em)[#basic-module.data.name])
  }
  if intention-module != none {
    let r = intention-row(intention-module.data, label: false)
    if r != none { left-lines.push(r) }
  }
  let lhs = for (i, l) in left-lines.enumerate() {
    if i > 0 { v(lead + 1.6mm) }
    block(l)
  }
  // 联系方式竖排、右对齐，图标在右
  let items = if basic-module != none { contact-items(basic-module.data) } else { () }
  let rhs = if items.len() > 0 {
    set align(right)
    set par(justify: false)
    text(size: meta-size, fill: muted, stack(spacing: lead * 0.7, ..items.map(((ic, c)) => box[#c #h(0.25em) #icon(ic)])))
  }
  let cols = if photo-path != none { (1fr, auto, 22mm) } else { (1fr, auto) }
  let cells = (lhs, rhs) + if photo-path != none { (photo-box(22mm),) } else { () }
  block(breakable: false, {
    grid(columns: cols, column-gutter: 5mm, align: (left + bottom, right + bottom, right + top), ..cells)
    v(2.4mm)
    line(length: 100%, stroke: 1.1pt + accent)
  })
}

#header()
#if body-modules.len() > 0 { gap(t.sectionGapMm) }
#render-modules(body-modules, section-head, after-head: 1.8mm)

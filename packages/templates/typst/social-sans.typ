// 如页 · social-sans「社招 · 侧条」
// 纸张左缘一条渐变竖色条；大号姓名、彩色图标的联系方式竖排在右；
// 模块标题是「彩色线性图标 + 粗体标题 + 渐变短条 + 细线」。全无衬线，信息密度高。原创版式。
#import "common.typ": *

#set page(
  width: 210mm,
  height: page-height,
  margin: page-margin,
  footer: page-footer,
  background: place(top + left, rect(width: 4.2mm, height: 100%, fill: grad-v)),
)
#set text(font: sans, size: body-size, fill: ink, lang: "zh", region: "cn", top-edge: 0.88em, bottom-edge: -0.12em)
#set par(leading: lead, spacing: lead, justify: true)
#set block(spacing: 0pt)
#date-style.update("accent")

#let section-head(title, type) = block(breakable: false, {
  grid(
    columns: (auto, auto, 1fr),
    column-gutter: 0.45em,
    align: (left + horizon, left + horizon, left + horizon),
    box(baseline: 0.15em, svg-image(section-icon-svg.at(type, default: section-icon-svg.project), accent2, 1.05em)),
    text(size: t.headingPt * 1pt, weight: "bold", fill: accent, tracking: 0.1em)[#title],
    [],
  )
  v(if compact { 0.9mm } else { 1.3mm })
  // 一条渐变短粗条接一条细线
  grid(
    columns: (3.2em, 1fr),
    align: horizon,
    rect(width: 100%, height: 1.6pt, fill: gradient.linear(accent, accent2, angle: 0deg)),
    line(length: 100%, stroke: 0.6pt + hairline),
  )
})

#let header() = {
  let left-lines = ()
  if basic-module != none {
    left-lines.push(text(size: t.namePt * 1.2pt, weight: "bold", fill: ink, tracking: 0.08em)[#basic-module.data.name])
  }
  if intention-module != none {
    let r = intention-row(intention-module.data)
    if r != none { left-lines.push(box(fill: tint, radius: 99pt, inset: (x: 0.7em), outset: (y: 0.32em), r)) }
  }
  let lhs = for (i, l) in left-lines.enumerate() {
    if i > 0 { v(lead + 2.6mm) }
    block(l)
  }
  // 联系方式竖排、右对齐，彩色图标在右
  let items = if basic-module != none { contact-items(basic-module.data) } else { () }
  let rhs = if items.len() > 0 {
    set align(right)
    set par(justify: false)
    text(size: meta-size, fill: muted, stack(spacing: lead * 0.75, ..items.map(((ic, c)) => box[#c #h(0.3em) #icon(ic, color: accent2)])))
  }
  let cols = if photo-path != none { (1fr, auto, 22mm) } else { (1fr, auto) }
  let cells = (lhs, rhs) + if photo-path != none { (photo-box(22mm),) } else { () }
  block(breakable: false, {
    grid(columns: cols, column-gutter: 6mm, align: (left + bottom, right + bottom, right + top), ..cells)
    v(3mm)
    rect(width: 100%, height: 2pt, fill: grad-h)
  })
}

#header()
#if body-modules.len() > 0 { gap(t.sectionGapMm) }
#render-modules(body-modules, section-head, after-head: 1.9mm)

// 如页 · campus-serif（校招单栏）
// 衬线标题 + 无衬线正文，留白充足。页顶细色带、色块标记的模块标题、延伸细线。原创版式。
#import "common.typ": *

#set page(
  width: 210mm,
  height: page-height,
  margin: page-margin,
  background: place(top + left, rect(width: 100%, height: 2.2mm, fill: accent)),
)
// 文字盒高度固定为 1em，于是行距 = lineHeight × 字号，和 CSS 的 line-height 语义一致
#set text(font: sans, size: body-size, fill: ink, lang: "zh", region: "cn", top-edge: 0.88em, bottom-edge: -0.12em)
#set par(leading: lead, spacing: lead, justify: true)
#set block(spacing: 0pt)

// 模块标题：色块 + 衬线标题 + 延伸到右边的细线
#let section-head(title) = block(breakable: false, grid(
  columns: (auto, 1fr),
  column-gutter: 0.6em,
  align: (left + horizon, left + horizon),
  {
    box(baseline: 0.02em, rect(width: 0.42em, height: 0.82em, radius: 0.08em, fill: accent))
    h(0.45em)
    text(font: serif, size: t.headingPt * 1pt, weight: "bold", fill: accent, tracking: 0.08em)[#title]
  },
  line(length: 100%, stroke: (if compact { 0.4pt } else { 0.55pt }) + hairline),
))

// 页眉：姓名 → 求职意向 → 联系方式；照片在右
#let header() = {
  let lines = ()
  if basic-module != none {
    lines.push(text(font: serif, size: t.namePt * 1pt, weight: "bold", fill: accent, tracking: 0.12em)[#basic-module.data.name])
  }
  if intention-module != none {
    let r = intention-row(intention-module.data)
    if r != none { lines.push(r) }
  }
  if basic-module != none {
    let c = contact-row(basic-module.data)
    if c != none { lines.push(c) }
  }
  if lines.len() == 0 { return }
  let text-part = for (i, l) in lines.enumerate() {
    if i == 1 { v(lead + 2mm) } else if i > 1 { v(lead + 0.8mm) }
    block(l)
  }
  if photo-path != none {
    grid(columns: (1fr, 25mm), column-gutter: 6mm, align: (left + horizon, right + top), text-part, photo-box(25mm))
  } else {
    block(text-part)
  }
}

#header()
#if body-modules.len() > 0 and (basic-module != none or intention-module != none) { gap(t.sectionGapMm) }
#render-modules(body-modules, section-head)

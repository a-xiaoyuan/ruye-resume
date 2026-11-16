// 如页 · classic「经典 · 简洁」
// 面向投递的默认模板：白底、单一主色、无大面积色块，打印和 ATS 解析都稳妥。
// 页眉：姓名与求职意向同一行，下一行联系方式，底部双线；照片在右侧。
// 模块标题：主色方块 + 粗体标题 + 一条贯穿到右边的细线。原创版式。
#import "common.typ": *

#set page(width: 210mm, height: page-height, margin: page-margin, footer: page-footer)
#set text(font: sans, size: body-size, fill: ink, lang: "zh", region: "cn", top-edge: 0.88em, bottom-edge: -0.12em)
#set par(leading: lead, spacing: lead, justify: true)
#set block(spacing: 0pt)
#date-style.update("plain")

#let section-head(title, type) = block(breakable: false, {
  grid(
    columns: (auto, auto, 1fr),
    column-gutter: 0.5em,
    align: (left + horizon, left + horizon, left + horizon),
    rect(width: 0.32em, height: 0.95em, fill: accent, radius: 0.5pt),
    text(size: t.headingPt * 1pt, weight: "bold", fill: accent, tracking: 0.08em)[#title],
    line(length: 100%, stroke: 0.7pt + accent.lighten(55%)),
  )
})

// 页眉：姓名与求职意向同一行（意向沿姓名基线对齐），下一行是联系方式（细竖线分隔），
// 底部一粗一细两条线收住。照片在右侧，与文字顶端对齐。左对齐比三行居中更紧凑、更有重心。
#let header() = {
  let name = if basic-module != none {
    text(size: t.namePt * 1.08pt, weight: "bold", fill: ink, tracking: 0.1em)[#basic-module.data.name]
  }
  let role = if intention-module != none { intention-row(intention-module.data) }
  let first = if role == none { name } else {
    box(name)
    h(1em)
    box(baseline: 0pt, text(size: body-size * 1.02)[#role])
  }
  let bar = text(fill: hairline.darken(20%))[#h(0.55em)|#h(0.55em)]
  let contacts = if basic-module != none { contact-row(basic-module.data, icon-color: accent, sep: bar) }
  let body = {
    set par(justify: false, leading: lead * 0.8)
    if first != none { block(first) }
    if contacts != none { v(lead + 1.8mm); block(contacts) }
  }
  block(breakable: false, width: 100%, {
    if photo-path != none {
      grid(columns: (1fr, 20mm), column-gutter: 6mm, align: (left + bottom, right + top), body, photo-box(20mm))
    } else { body }
    v(2.6mm)
    line(length: 100%, stroke: 1.6pt + accent)
    v(0.6mm)
    line(length: 100%, stroke: 0.4pt + accent.lighten(40%))
  })
}

#header()
#if body-modules.len() > 0 { gap(t.sectionGapMm + 0.5) }
#render-modules(body-modules, section-head, after-head: 2mm)

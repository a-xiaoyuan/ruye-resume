// 如页 · classic「经典 · 简洁」
// 面向投递的默认模板：白底、单一主色、无大面积色块，打印和 ATS 解析都稳妥。
// 页眉：姓名居中，下面依次是求职意向、联系方式；有照片时照片固定在右上角，不影响居中。
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

#let header() = {
  let lines = ()
  if basic-module != none {
    lines.push(text(size: t.namePt * 1pt, weight: "bold", fill: ink, tracking: 0.12em)[#basic-module.data.name])
  }
  if intention-module != none {
    let r = intention-row(intention-module.data)
    if r != none { lines.push(r) }
  }
  if basic-module != none {
    let c = contact-row(basic-module.data, icon-color: accent)
    if c != none { lines.push(c) }
  }
  centered-header(lines, photo-w: 21mm, first-gap: 2.4mm, rest-gap: 1.2mm)
}

#header()
#if body-modules.len() > 0 { gap(t.sectionGapMm + 0.5) }
#render-modules(body-modules, section-head, after-head: 2mm)

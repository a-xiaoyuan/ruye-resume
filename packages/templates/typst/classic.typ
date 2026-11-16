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
  let photo-w = 21mm
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
  // 有照片时左右各留出照片宽度，文字仍在整页居中，且不会压到照片
  let side = if photo-path != none { photo-w + 4mm } else { 0mm }
  block(breakable: false, width: 100%, {
    if photo-path != none { place(top + right, photo-box(photo-w)) }
    pad(left: side, right: side, align(center, {
      set par(justify: false)
      for (i, l) in lines.enumerate() {
        if i > 0 { v(lead + if i == 1 { 2.4mm } else { 1.2mm }) }
        block(l)
      }
    }))
  })
}

// 照片比文字高时，用照片高度撑开页眉，避免正文压到照片
#context {
  let hb = header()
  let h = measure(hb, width: text-width).height
  let ph = if photo-path != none { 21mm * 4 / 3 } else { 0mm }
  hb
  if ph > h { v(ph - h) }
}
#if body-modules.len() > 0 { gap(t.sectionGapMm + 0.5) }
#render-modules(body-modules, section-head, after-head: 2mm)

// 如页 · campus-serif「校招 · 横幅」
// 页顶通栏渐变横幅（白色姓名、意向、联系方式），模块标题配渐变圆形图标，日期是浅色胶囊。原创版式。
#import "common.typ": *

#set page(width: 210mm, height: page-height, margin: page-margin, footer: page-footer)
// 文字盒高度固定为 1em，于是行距 = lineHeight × 字号，和 CSS 的 line-height 语义一致
#set text(font: sans, size: body-size, fill: ink, lang: "zh", region: "cn", top-edge: 0.88em, bottom-edge: -0.12em)
#set par(leading: lead, spacing: lead, justify: true)
#set block(spacing: 0pt)
#date-style.update("pill")

// 模块标题：渐变圆形图标 + 衬线标题 + 渐淡的长线
#let section-head(title, type) = block(breakable: false, grid(
  columns: (auto, auto, 1fr),
  column-gutter: 0.55em,
  align: (left + horizon, left + horizon, left + horizon),
  section-badge(type, fill: grad-v),
  text(font: serif, size: t.headingPt * 1pt, weight: "bold", fill: accent, tracking: 0.08em)[#title],
  line(length: 100%, stroke: 1.4pt + gradient.linear(accent2.lighten(55%), white, angle: 0deg)),
))

// 页顶横幅：铺满纸张宽度并顶到纸边（负内边距抵消页边距），内容仍与正文左右对齐
#let banner() = {
  let lines = ()
  if basic-module != none {
    lines.push(text(font: serif, size: t.namePt * 1.18pt, weight: "bold", fill: white, tracking: 0.16em)[#basic-module.data.name])
  }
  if intention-module != none {
    let r = intention-row(intention-module.data, role-color: white, color: white.transparentize(12%), sep-color: white.transparentize(55%))
    if r != none { lines.push(r) }
  }
  if basic-module != none {
    let c = contact-row(basic-module.data, color: white.transparentize(8%), icon-color: white)
    if c != none { lines.push(c) }
  }
  if lines.len() == 0 { return }
  let body = for (i, l) in lines.enumerate() {
    if i == 1 { v(lead + 2.4mm) } else if i > 1 { v(lead + 1.2mm) }
    block(l)
  }
  let content = if photo-path != none {
    grid(columns: (1fr, 23mm), column-gutter: 6mm, align: (left + horizon, right + horizon), body, box(stroke: 1.6pt + white, radius: 1.6mm, clip: true, photo-box(23mm)))
  } else { body }
  pad(
    left: -margin.left * 1mm,
    right: -margin.right * 1mm,
    top: -margin.top * 1mm,
    block(
      width: 100%,
      fill: grad-h,
      inset: (left: margin.left * 1mm, right: margin.right * 1mm, top: 10mm, bottom: 8mm),
      content,
    ),
  )
}

#banner()
#if body-modules.len() > 0 and (basic-module != none or intention-module != none) { gap(t.sectionGapMm + 1) }
#render-modules(body-modules, section-head, after-head: 2.2mm)

// 如页 · elegant「雅致 · 衬线」
// 页眉居中：上下各一组主色双细线，夹着宋体姓名、求职意向和联系方式。
// 模块标题居中，左右两段渐隐短线托住衬线标题；正文用黑体保证小字号清晰。原创版式。
#import "common.typ": *

#set page(width: 210mm, height: page-height, margin: page-margin, footer: page-footer)
#set text(font: sans, size: body-size, fill: ink, lang: "zh", region: "cn", top-edge: 0.88em, bottom-edge: -0.12em)
#set par(leading: lead, spacing: lead, justify: true)
#set block(spacing: 0pt)
#date-style.update("accent")

#let double-rule = {
  line(length: 100%, stroke: 1.1pt + accent)
  v(0.7mm)
  line(length: 100%, stroke: 0.4pt + accent)
}

#let section-head(title, type) = block(breakable: false, width: 100%, grid(
  columns: (1fr, auto, 1fr),
  column-gutter: 0.8em,
  align: (right + horizon, center + horizon, left + horizon),
  line(length: 70%, stroke: 0.8pt + gradient.linear(white, accent2.lighten(20%), angle: 0deg)),
  text(font: serif, size: t.headingPt * 1pt, weight: "bold", fill: accent, tracking: 0.3em)[#title],
  line(length: 70%, stroke: 0.8pt + gradient.linear(accent2.lighten(20%), white, angle: 0deg)),
))

#let header() = {
  let lines = ()
  if basic-module != none {
    lines.push(text(font: serif, size: t.namePt * 1.12pt, weight: "bold", fill: ink, tracking: 0.35em)[#basic-module.data.name])
  }
  if intention-module != none {
    let r = intention-row(intention-module.data)
    if r != none { lines.push(r) }
  }
  if basic-module != none {
    let c = contact-row(basic-module.data, icon-color: accent2)
    if c != none { lines.push(c) }
  }
  block(breakable: false, width: 100%, {
    double-rule
    v(3.2mm)
    centered-header(lines, photo-w: 19mm, first-gap: 2.2mm, rest-gap: 1mm)
    v(3.2mm)
    // 下方双线与上方镜像：细线在上
    line(length: 100%, stroke: 0.4pt + accent)
    v(0.7mm)
    line(length: 100%, stroke: 1.1pt + accent)
  })
}

#header()
#if body-modules.len() > 0 { gap(t.sectionGapMm + 0.6) }
#render-modules(body-modules, section-head, after-head: 2.2mm)

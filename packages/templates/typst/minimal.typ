// 如页 · minimal「极简 · 黑白」
// 只用黑、深灰两种颜色，没有图标和色块：彩色打印、黑白打印、系统解析结果都一样。
// 姓名左对齐，下面一行纯文字联系方式；模块标题加宽字距，下方一条贯穿全宽的黑色细线。原创版式。
// 主题色在这套模板里不生效：排版时固定使用黑白色板 mono（见 templates/src/index.ts 的 fixedTheme）。
#import "common.typ": *

#let black = rgb("#111111")
#set page(width: 210mm, height: page-height, margin: page-margin, footer: page-footer)
#set text(font: sans, size: body-size, fill: ink, lang: "zh", region: "cn", top-edge: 0.88em, bottom-edge: -0.12em)
#set par(leading: lead, spacing: lead, justify: true)
#set block(spacing: 0pt)
#date-style.update("plain")

#let section-head(title, type) = block(breakable: false, {
  text(size: t.headingPt * 1pt, weight: "bold", fill: black, tracking: 0.22em)[#title]
  v(if compact { 0.8mm } else { 1.2mm })
  line(length: 100%, stroke: 0.9pt + black)
})

#let header() = {
  let rows = ()
  if basic-module != none {
    rows.push(text(size: t.namePt * 1.1pt, weight: "bold", fill: black, tracking: 0.06em)[#basic-module.data.name])
  }
  if intention-module != none {
    let r = intention-row(intention-module.data, role-color: black, color: ink, sep-color: muted)
    if r != none { rows.push(r) }
  }
  if basic-module != none {
    let c = contact-text(basic-module.data, sep: text(fill: muted)[#h(0.5em)|#h(0.5em)])
    if c != none { rows.push(text(size: meta-size, fill: muted, c)) }
  }
  let body = {
    set par(justify: false)
    for (i, l) in rows.enumerate() {
      if i == 1 { v(lead + 2mm) } else if i > 1 { v(lead + 0.8mm) }
      block(l)
    }
  }
  block(breakable: false, if photo-path != none {
    grid(columns: (1fr, 20mm), column-gutter: 6mm, align: (left + bottom, right + top), body, photo-box(20mm))
  } else { body })
}

#header()
#if body-modules.len() > 0 { gap(t.sectionGapMm + 0.8) }
#render-modules(body-modules, section-head, after-head: 1.8mm)

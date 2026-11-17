// 如页 · classic「经典 · 简洁」
// 面向投递的默认模板：白底、单一主色、无大面积色块，打印和 ATS 解析都稳妥。
// 页眉：左栏姓名 + 求职意向（主色竖条收边），右栏联系方式小表格；照片在最右。
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

// 页眉：左右两栏。左栏是姓名和求职意向，左边一条主色竖条把它们收成一块；
// 右栏是联系方式，图标 + 文字排成整齐的小表格（四项以上两列），不再挤成一长行。
// 底部一条细线，左端一段主色粗线压在上面。照片（如有）在最右侧。
#let header() = {
  let d = if basic-module != none { basic-module.data } else { (:) }
  let name = if basic-module != none {
    text(size: t.namePt * 1.12pt, weight: "bold", fill: ink, tracking: 0.12em)[#d.name]
  }
  // 求职意向拆成两行：岗位单独一行（主色加粗），城市、到岗、薪资等放下一行的灰色小字；
  // 每项是一个不可拆的盒子，放不下时整项换行，不会把「可实习 6 个月」拆成两半
  let it = if intention-module != none { intention-module.data } else { (:) }
  let role = get(it, "role")
  let rest = (get(it, "city"), get(it, "availability"), get(it, "salary")).filter(x => x != none)
  let lhs = {
    set par(justify: false, leading: lead * 0.8)
    if name != none { block(name) }
    if role != none {
      v(lead + 1.6mm)
      block(text(size: body-size * 1.08, weight: "bold", fill: accent)[#icon("target", size: 0.88em) #h(0.15em) #role])
    }
    if rest.len() > 0 {
      v(lead + 0.6mm)
      block(text(size: meta-size, fill: muted, rest.map(x => box[#x]).join([#h(0.5em)#text(fill: hairline.darken(25%))[|]#h(0.5em)])))
    }
  }
  let items = contact-items(d)
  let contacts = if items.len() > 0 {
    let cols = if items.len() >= 4 { 2 } else { 1 }
    text(size: meta-size, fill: ink.lighten(12%), grid(
      columns: cols,
      column-gutter: 5mm,
      row-gutter: lead + 1.4mm,
      ..items.map(((ic, c)) => box[#icon(ic, color: accent) #h(0.25em) #c]),
    ))
  }
  let bar = block(stroke: (left: 1.3mm + accent), inset: (left: 4.2mm, y: 0.6mm), lhs)
  let cells = (bar,)
  let cols = (1fr,)
  if contacts != none { cells.push(contacts); cols.push(auto) }
  if photo-path != none { cells.push(photo-box(20mm)); cols.push(20mm) }
  block(breakable: false, width: 100%, {
    grid(columns: cols, column-gutter: 6mm, align: horizon, ..cells)
    v(3.6mm)
    block(width: 100%, {
      line(length: 100%, stroke: 0.5pt + accent.lighten(55%))
      place(top + left, dy: -0.7pt, line(length: 26mm, stroke: 1.9pt + accent))
    })
  })
}

#header()
#if body-modules.len() > 0 { gap(t.sectionGapMm + 0.5) }
#render-modules(body-modules, section-head, after-head: 2mm)

// 如页 · split-compact（双栏紧凑）
// 左侧整高浅色侧栏：照片、姓名、意向、联系方式、技能、教育、获奖；右侧：经历、项目、科研、论文。
// 侧栏不靠拉伸字号填满，内容自上而下排。原创版式。
#import "common.typ": *

#let sidebar-w = 58mm
#let gutter = 7mm
// 侧栏底色宽度：左页边 + 侧栏 + 半个栏距
#let band-w = margin.left * 1mm + sidebar-w + gutter / 2

#set page(
  width: 210mm,
  height: page-height,
  margin: page-margin,
  background: place(top + left, rect(width: band-w, height: 100%, fill: tint)),
)
#set text(font: sans, size: body-size, fill: ink, lang: "zh", region: "cn", top-edge: 0.88em, bottom-edge: -0.12em)
// 栏宽较窄，两端对齐会在中英文之间拉出大空隙，所以左对齐
#set par(leading: lead, spacing: lead, justify: false)
#set block(spacing: 0pt)

#let main-head(title) = block(breakable: false, grid(
  columns: (auto, 1fr),
  column-gutter: 0.6em,
  align: (left + horizon, left + horizon),
  text(size: t.headingPt * 1pt, weight: "bold", fill: accent, tracking: 0.1em)[#title],
  line(length: 100%, stroke: 0.55pt + hairline),
))

#let side-head(title) = block(breakable: false, {
  text(size: t.headingPt * 1pt, weight: "bold", fill: accent, tracking: 0.1em)[#title]
  v(1mm)
  line(length: 2.2em, stroke: 1.4pt + accent)
})

// 侧栏里的技能：分类名在上，内容在下（窄栏放不下两栏对齐）
#let side-skills(m) = {
  let cats = skill-cats(m.data.categories)
  (cats.map(c => block({
    text(weight: "bold", fill: ink)[#c.name]
    linebreak()
    par(justify: false, text(fill: ink)[#nonempty(c.items).join("、")])
  })),)
}

// 侧栏里的教育：学校、专业学位、日期各占一行
#let side-education(m) = m.data.items.map(item => {
  let head = block({
    title-text(item.school)
    let sub = (get(item, "major"), get(item, "degree")).filter(x => x != none)
    if sub.len() > 0 { linebreak(); role-text(sub.join(" · ")) }
    let d = date-range(get(item, "start"), get(item, "end"))
    if d != none { linebreak(); meta(d) }
  })
  item-units(head, bullets(get(item, "highlights")))
})

#let side-awards(m) = (m.data.items.map(item => block(breakable: false, {
  text(weight: "medium")[#item.name]
  let sub = (get(item, "issuer"), fmt-date(get(item, "date"))).filter(x => x != none and x != "")
  if sub.len() > 0 { linebreak(); meta(sub.join(" · ")) }
  if has(item, "description") { linebreak(); meta(item.description) }
})),)

#let side-types = ("skills", "education", "award")
#let side-modules = body-modules.filter(m => m.type in side-types)
#let main-modules = body-modules.filter(m => m.type not in side-types)

#let sidebar = {
  if photo-path != none {
    photo-box(26mm)
    v(4mm)
  }
  if basic-module != none {
    block(text(size: t.namePt * 1pt, weight: "bold", fill: accent, tracking: 0.1em)[#basic-module.data.name])
  }
  if intention-module != none {
    let d = intention-module.data
    let role = get(d, "role")
    let rest = (get(d, "city"), get(d, "availability"), get(d, "salary")).filter(x => x != none)
    if role != none { v(lead + 1.2mm); block(text(weight: "bold", fill: ink)[#role]) }
    for r in rest { v(lead * 0.6); block(meta(r)) }
  }
  let items = if basic-module != none { contact-items(basic-module.data) } else { () }
  if items.len() > 0 {
    v(lead + 3mm)
    set par(justify: false)
    text(size: meta-size, fill: ink, stack(spacing: lead + 0.4mm, ..items.map(((ic, c)) => grid(
      columns: (1.3em, 1fr),
      align: (left + top, left + top),
      icon(ic),
      c,
    ))))
  }
  for m in side-modules {
    gap(t.sectionGapMm)
    let items = if m.type == "skills" { side-skills(m) } else if m.type == "education" { side-education(m) } else { side-awards(m) }
    render-section(side-head(module-labels.at(m.type)), items, after-head: 1.8mm)
  }
}

#let main = render-modules(main-modules, main-head, skills-width: 210mm - (margin.left + margin.right) * 1mm - sidebar-w - gutter, after-head: 1.8mm)

#grid(columns: (sidebar-w, 1fr), column-gutter: gutter, sidebar, main)

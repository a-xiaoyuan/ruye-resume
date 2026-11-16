// 如页 · split-compact「双栏 · 深色侧栏」
// 左侧整高深色渐变侧栏（白字）：照片、姓名、意向、联系方式，以及技能（半透明胶囊）/ 教育 / 获奖；
// 右侧白底：经历、项目、科研、论文，标题配渐变圆形图标，日期是浅色胶囊。
// 两栏自动平衡：用 measure() 实测几种分配方式的两栏高度，选总高最矮的一种，避免一边满一边空。
// 侧栏不靠拉伸字号填满，内容自上而下排。原创版式。
#import "common.typ": *

#let sidebar-w = 58mm
#let gutter = 7mm
#let main-w = 210mm - (margin.left + margin.right) * 1mm - sidebar-w - gutter
// 侧栏底色宽度：左页边 + 侧栏 + 栏距的一半多一点（让白字离色块边缘有呼吸感）
#let band-w = margin.left * 1mm + sidebar-w + gutter * 0.55
#let on-dark = white
#let on-dark-soft = white.transparentize(22%)

#set page(
  width: 210mm,
  height: page-height,
  margin: page-margin,
  footer: page-footer,
  background: place(top + left, rect(width: band-w, height: 100%, fill: grad-v)),
)
#set text(font: sans, size: body-size, fill: ink, lang: "zh", region: "cn", top-edge: 0.88em, bottom-edge: -0.12em)
// 栏宽较窄，两端对齐会在中英文之间拉出大空隙，所以左对齐
#set par(leading: lead, spacing: lead, justify: false)
#set block(spacing: 0pt)
#date-style.update("pill")

#let main-head(title, type) = block(breakable: false, grid(
  columns: (auto, auto, 1fr),
  column-gutter: 0.5em,
  align: (left + horizon, left + horizon, left + horizon),
  section-badge(type, fill: grad-v, size: 1.45em),
  text(size: t.headingPt * 1pt, weight: "bold", fill: accent, tracking: 0.1em)[#title],
  line(length: 100%, stroke: 1.2pt + gradient.linear(accent2.lighten(55%), white, angle: 0deg)),
))

#let side-head(title) = block(breakable: false, {
  text(size: t.headingPt * 1pt, weight: "bold", fill: on-dark, tracking: 0.14em)[#title]
  v(1.1mm)
  rect(width: 2.4em, height: 1.6pt, fill: bright)
})

#let side-bullet(s) = grid(
  columns: (0.9em, 1fr),
  align: (left + top, left + top),
  box(height: 1em, align(horizon, move(dy: 0.08em, dot(0.3em, bright)))),
  text(fill: on-dark-soft)[#s],
)

// 侧栏里的技能：分类名在上，技能是半透明白色胶囊
#let side-skills(m) = {
  let cats = skill-cats(m.data.categories)
  (cats.map(c => block({
    text(weight: "bold", fill: on-dark)[#c.name]
    v(lead * 0.6 + 0.6mm)
    let items = nonempty(c.items)
    // 技能名做成胶囊；有一项像句子（汉字超过 4 个，或总长超过 22）时整类改成普通文字，胶囊折行很难看
    let is-name(it) = it.matches(regex("[\p{Han}]")).len() <= 4 and it.clusters().len() <= 22
    if items.all(is-name) {
      par(leading: lead + 0.9mm, items.map(it => box(
        fill: white.transparentize(84%),
        radius: 99pt,
        inset: (x: 0.55em),
        outset: (y: 0.22em),
        text(size: meta-size, fill: on-dark)[#it],
      )).join(h(0.35em)))
    } else {
      text(fill: on-dark-soft)[#items.join("；")]
    }
  })),)
}

// 侧栏里的教育：学校、专业学位、日期各占一行
#let side-education(m) = m.data.items.map(item => {
  let head = block({
    text(weight: "bold", fill: on-dark)[#item.school]
    let sub = (get(item, "major"), get(item, "degree")).filter(x => x != none)
    if sub.len() > 0 { linebreak(); text(fill: bright.lighten(30%))[#sub.join(" · ")] }
    let d = date-range(get(item, "start"), get(item, "end"))
    if d != none { linebreak(); text(size: meta-size, fill: on-dark-soft)[#d] }
  })
  item-units(head, nonempty(get(item, "highlights")).map(side-bullet))
})

#let side-awards(m) = (m.data.items.map(item => block(breakable: false, {
  text(weight: "medium", fill: on-dark)[#item.name]
  let sub = (get(item, "issuer"), fmt-date(get(item, "date"))).filter(x => x != none and x != "")
  if sub.len() > 0 { linebreak(); text(size: meta-size, fill: on-dark-soft)[#sub.join(" · ")] }
  if has(item, "description") { linebreak(); text(size: meta-size, fill: on-dark-soft)[#item.description] }
})),)

// 能放进侧栏的模块：技能（没有描述句时；整句描述在 58mm 里放不下）、教育、获奖
#let side-capable(m) = m.type in ("skills", "education", "award") and not has-skill-notes(m)

#let sidebar(side-modules) = {
  if photo-path != none {
    box(stroke: 1.6pt + white, radius: 1.6mm, clip: true, photo-box(26mm))
    v(4.5mm)
  }
  if basic-module != none {
    block(text(size: t.namePt * 1.1pt, weight: "bold", fill: on-dark, tracking: 0.12em)[#basic-module.data.name])
  }
  if intention-module != none {
    let d = intention-module.data
    let role = get(d, "role")
    let rest = (get(d, "city"), get(d, "availability"), get(d, "salary")).filter(x => x != none)
    if role != none { v(lead + 1.4mm); block(text(weight: "bold", fill: bright.lighten(35%))[#role]) }
    for r in rest { v(lead * 0.6); block(text(size: meta-size, fill: on-dark-soft)[#r]) }
  }
  let items = if basic-module != none { contact-items(basic-module.data) } else { () }
  if items.len() > 0 {
    v(lead + 3.4mm)
    text(size: meta-size, fill: on-dark, stack(spacing: lead + 0.5mm, ..items.map(((ic, c)) => grid(
      columns: (1.35em, 1fr),
      align: (left + top, left + top),
      icon(ic, color: bright.lighten(30%)),
      c,
    ))))
  }
  for m in side-modules {
    gap(t.sectionGapMm)
    let items = if m.type == "skills" { side-skills(m) } else if m.type == "education" { side-education(m) } else { side-awards(m) }
    render-section(side-head(module-labels.at(m.type)), items, after-head: 2mm)
  }
}

#let main-column(main-modules) = render-modules(main-modules, main-head, skills-width: main-w, after-head: 1.8mm)

// 几种分配方式：哪些侧栏模块真的放进侧栏。按偏好排列（越靠前越保留经典布局）
#let side-options = (
  ("skills", "education", "award"),
  ("skills", "award"),
  ("skills", "education"),
  ("skills",),
)

#context {
  let best = none
  for opt in side-options {
    let side = body-modules.filter(m => side-capable(m) and m.type in opt)
    let main = body-modules.filter(m => not (side-capable(m) and m.type in opt))
    let hs = measure(block(width: sidebar-w, sidebar(side))).height
    let hm = measure(block(width: main-w, main-column(main))).height
    let score = calc.max(hs, hm)
    // 至少矮 3mm 才换方案，避免为了一点点高度把教育挪来挪去
    if best == none or score < best.score - 3mm { best = (score: score, side: side, main: main) }
  }
  grid(columns: (sidebar-w, 1fr), column-gutter: gutter, sidebar(best.side), main-column(best.main))
}

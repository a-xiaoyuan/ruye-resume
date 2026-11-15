// 如页 · campus-serif（校招单栏）
// 衬线标题 + 无衬线正文。一枚深墨蓝强调色贯穿：页顶色带、模块标记、技术栈标签、要点圆点。
// 原创版式。
//
// 约定：
// - 数据只从 data.json / tokens.json / page.json 读取。用户写的任何文字都以字符串形式
//   插入（[#s]），不会被当成 Typst 标记解析，所以 # * _ $ @ < 等字符都安全。
// - 所有垂直间距都由 gap() 显式控制，便于引擎按 token 精确收紧。
// - 页面高度为 "auto" 时，Typst 让页面高度等于内容高度：引擎用它做测量和长一页。

#let doc = json("data.json")
#let t = json("tokens.json")
#let spec = json("page.json")

// ---------------------------------------------------------------- 配色
#let ink = rgb("#18202c")        // 正文：近黑
#let accent = rgb("#1f3d63")     // 强调色：深墨蓝
#let muted = rgb("#4b5563")      // 次级信息：深灰（打印仍清晰）
#let hairline = rgb("#c9d2de")   // 细线
#let tint = rgb("#eef2f7")       // 标签底色

#let body-size = t.bodyPt * 1pt
#let meta-size = t.metaPt * 1pt
#let lead = (t.lineHeight - 1) * body-size
#let compact = t.compact
#let sans = (t.fontFamily.sans, "Noto Sans SC")
#let serif = (t.fontFamily.serif, "Noto Serif SC", t.fontFamily.sans, "Noto Sans SC")
#let margin = t.pageMarginMm
#let text-width = 210mm - (margin.left + margin.right) * 1mm

#set page(
  width: 210mm,
  height: if spec.height == "auto" { auto } else { spec.height * 1mm },
  margin: (top: margin.top * 1mm, bottom: margin.bottom * 1mm, left: margin.left * 1mm, right: margin.right * 1mm),
  // 页顶一条细色带（不占版心，不影响测量）
  background: place(top + left, rect(width: 100%, height: 2.2mm, fill: accent)),
)
// 文字盒高度固定为 1em，于是行距 = lineHeight × 字号，和 CSS 的 line-height 语义一致
#set text(font: sans, size: body-size, fill: ink, lang: "zh", region: "cn", top-edge: 0.88em, bottom-edge: -0.12em)
#set par(leading: lead, spacing: lead, justify: true)
#set block(spacing: 0pt)

// ---------------------------------------------------------------- 工具函数

#let has(d, k) = type(d) == dictionary and k in d and d.at(k) != none and d.at(k) != ""
#let get(d, k) = if has(d, k) { d.at(k) } else { none }
#let nonempty(arr) = if arr == none { () } else { arr.filter(s => s != none and s.trim() != "") }

// 两个内容单元之间的垂直间距：一个行距 + token 指定的额外间距；分页处自动折叠
#let gap(extra-mm) = v(lead + extra-mm * 1mm, weak: true)

#let fmt-date(s) = if s == none or s == "" { "" } else if s == "至今" { s } else { s.replace("-", ".") }
#let date-range(a, b) = {
  let x = fmt-date(a)
  let y = fmt-date(b)
  if x == "" and y == "" { none } else if y == "" { x } else { x + " – " + y }
}

#let meta(s) = text(size: meta-size, fill: muted)[#s]

// 链接：显示时去掉协议头，PDF 中可点击
#let pretty-url(u) = u.replace(regex("^https?://"), "").replace(regex("^mailto:"), "").replace(regex("/$"), "")
#let url-link(u) = link(u)[#pretty-url(u)]

// 小色块（模块标记、联系方式分隔）
#let dot(size, color) = box(baseline: -0.32em, circle(radius: size / 2, fill: color))
#let square-mark = box(baseline: 0.02em, rect(width: 0.42em, height: 0.82em, radius: 0.08em, fill: accent))

// 量化成果加粗：带单位的数字（320ms、85%、3 天、20 万）或两位以上的整数（600、1500）。
// 紧跟在字母或符号后面的数字是型号、版本号（P99、A4、HTTP/2、OAuth 2.0 里的点号小数），不加粗。
#let metric-units = "%|％|ms|秒|分钟|小时|天|周|个月|倍|万|千|亿|QPS|qps|TPS|条|次|人|项|篇|位"
#let metric-re = regex("[A-Za-z/_.-]?\d[\d,.]*(\s?(" + metric-units + "))?")
#let unit-re = regex("(" + metric-units + ")$")
#let emphasize(s) = {
  show metric-re: it => {
    let raw = it.text
    let prefixed = raw.match(regex("^[A-Za-z/_.-]")) != none
    let has-unit = raw.match(unit-re) != none
    let big-int = raw.match(regex("^\d{2,}[\d,]*$")) != none
    if not prefixed and (has-unit or big-int) { text(weight: "bold", fill: ink, it) } else { it }
  }
  [#s]
}

// 标题行：左侧标题，右侧日期（右对齐）
#let headline(lhs, rhs) = {
  if rhs == none or rhs == "" {
    block(lhs)
  } else {
    grid(
      columns: (1fr, auto),
      column-gutter: 1em,
      align: (left + bottom, right + bottom),
      lhs,
      text(size: meta-size, fill: muted, number-type: "lining", number-width: "tabular")[#rhs],
    )
  }
}

// 要点：强调色小圆点 + 文本（悬挂缩进）
#let bullet(s) = grid(
  columns: (1em, 1fr),
  align: (left + top, left + top),
  box(height: 1em, align(horizon, move(dy: 0.08em, dot(0.32em, accent)))),
  emphasize(s),
)

// 技术栈标签：浅底、强调色字，可换行
#let tag(s) = box(
  fill: tint,
  radius: 0.25em,
  inset: (x: 0.4em, y: 0.12em),
  outset: (y: 0.08em),
  text(size: meta-size, fill: accent)[#s],
)
#let tags(arr) = arr.map(tag).join(h(0.35em))

// ---------------------------------------------------------------- 条目与模块
//
// 每个条目返回一组「单元」（content 数组）。第一个单元是不可拆分的「标题 + 第一条要点」，
// 保证标准分页时条目标题不会孤零零落在页底。

#let item-units(head, lines) = {
  // 每个单元都包成 block：间距只由 gap() 决定，不受段落间距影响
  let lines = lines.filter(x => x != none).map(x => block(x))
  if lines.len() == 0 {
    (block(breakable: false, head),)
  } else {
    let first = block(breakable: false, {
      head
      gap(t.paragraphGapMm)
      lines.at(0)
    })
    (first,) + lines.slice(1)
  }
}

#let bullets(arr) = nonempty(arr).map(b => bullet(b))

// 简介 + 技术栈。默认两行；紧凑变体合并成一行
#let meta-lines(item) = {
  let s = get(item, "summary")
  let stack = nonempty(get(item, "techStack"))
  if compact {
    if s == none and stack.len() == 0 { return () }
    (par(justify: false, {
      if s != none { meta(s) }
      if s != none and stack.len() > 0 { h(0.8em) }
      if stack.len() > 0 { tags(stack) }
    }),)
  } else {
    let out = ()
    if s != none { out.push(meta(s)) }
    if stack.len() > 0 { out.push(par(justify: false, tags(stack))) }
    out
  }
}

#let title-text(s) = text(weight: "bold")[#s]
#let role-text(s) = text(fill: accent)[#s]
#let sep = h(0.7em)

#let education-units(item) = {
  let lhs = {
    title-text(item.school)
    if has(item, "major") { sep; role-text(item.major) }
    if has(item, "degree") { sep; meta(item.degree) }
  }
  let head = headline(lhs, date-range(get(item, "start"), get(item, "end")))
  let hl = nonempty(get(item, "highlights"))
  if compact and hl.len() > 0 {
    item-units(head, (emphasize(hl.join("；")),))
  } else {
    item-units(head, bullets(hl))
  }
}

#let experience-units(item) = {
  let lhs = {
    title-text(item.org)
    if has(item, "title") { sep; role-text(item.title) }
  }
  let head = headline(lhs, date-range(get(item, "start"), get(item, "end")))
  item-units(head, meta-lines(item) + bullets(get(item, "bullets")))
}

#let project-units(item) = {
  let lhs = {
    title-text(item.name)
    if has(item, "role") { sep; role-text(item.role) }
    if has(item, "url") { sep; text(size: meta-size, fill: muted, url-link(item.url)) }
  }
  let head = headline(lhs, date-range(get(item, "start"), get(item, "end")))
  item-units(head, meta-lines(item) + bullets(get(item, "bullets")))
}

#let research-units(item) = {
  let lhs = {
    title-text(item.name)
    if has(item, "org") { sep; role-text(item.org) }
  }
  let head = headline(lhs, date-range(get(item, "start"), get(item, "end")))
  item-units(head, bullets(get(item, "bullets")))
}

#let paper-units(item) = {
  let parts = (get(item, "authors"), get(item, "venue")).filter(x => x != none)
  let body = {
    title-text(item.title)
    if parts.len() > 0 { sep; meta(parts.join(". ")) }
    if has(item, "url") { sep; text(size: meta-size, fill: muted, url-link(item.url)) }
  }
  (block(breakable: false, headline(body, fmt-date(get(item, "date")))),)
}

#let award-units(item) = {
  let lhs = {
    title-text(item.name)
    if has(item, "issuer") { sep; role-text(item.issuer) }
    if has(item, "description") { sep; meta(item.description) }
  }
  (block(breakable: false, headline(lhs, fmt-date(get(item, "date")))),)
}

// 技能：「分类 | 内容」两栏对齐。紧凑变体在每行都放得下半栏时改成双列
#let skills-units(cats) = {
  let cats = cats.filter(c => nonempty(c.items).len() > 0)
  let label-w = 4.6em
  let row(c) = grid(
    columns: (label-w, 1fr),
    align: (left + top, left + top),
    text(weight: "bold", fill: accent)[#c.name],
    par(justify: false)[#nonempty(c.items).join("、")],
  )
  let row-gap = lead + t.paragraphGapMm * 1mm
  if compact and cats.len() > 1 {
    (context {
      let col = ((text-width - 1.5em) / 2).to-absolute()
      let fits = cats.all(c => (measure([#c.name]).width.to-absolute() <= label-w.to-absolute()) and measure([#nonempty(c.items).join("、")]).width.to-absolute() <= col - label-w.to-absolute())
      if fits {
        grid(columns: (1fr, 1fr), column-gutter: 1.5em, row-gutter: row-gap, ..cats.map(row))
      } else {
        stack(spacing: row-gap, ..cats.map(row))
      }
    },)
  } else {
    cats.map(row)
  }
}

// 模块标题：色块标记 + 衬线标题 + 延伸到右边的细线
#let section-head(title) = block(breakable: false, grid(
  columns: (auto, 1fr),
  column-gutter: 0.6em,
  align: (left + horizon, left + horizon),
  {
    square-mark
    h(0.45em)
    text(font: serif, size: t.headingPt * 1pt, weight: "bold", fill: accent, tracking: 0.08em)[#title]
  },
  line(length: 100%, stroke: (if compact { 0.4pt } else { 0.55pt }) + hairline),
))

// 一个模块：标题与第一个单元绑在一起，之后的单元之间按「要点间距 / 条目间距」分隔
#let section(title, items) = {
  if items.len() == 0 { return }
  block(breakable: false, {
    section-head(title)
    v(if compact { 1.3mm } else { 2mm })
    items.at(0).at(0)
  })
  for (i, units) in items.enumerate() {
    if i > 0 { gap(t.itemGapMm) }
    for (j, u) in units.enumerate() {
      if i == 0 and j == 0 { continue }
      gap(t.paragraphGapMm)
      u
    }
  }
}

// ---------------------------------------------------------------- 页眉（姓名 + 求职意向 + 联系方式）

#let intention = doc.modules.find(m => m.type == "job_intention")

#let contact-row(d) = {
  let items = ()
  if has(d, "phone") { items.push([#d.phone]) }
  if has(d, "email") { items.push(link("mailto:" + d.email)[#d.email]) }
  if has(d, "location") { items.push([#d.location]) }
  for k in ("github", "website", "blog") {
    if has(d, k) { items.push(url-link(d.at(k))) }
  }
  let custom = if has(d, "customLinks") { d.customLinks } else { () }
  for l in custom {
    if l.url != "" { items.push([#l.label #url-link(l.url)]) }
  }
  for x in (get(d, "gender"), fmt-date(get(d, "birthday"))) {
    if x != none and x != "" { items.push([#x]) }
  }
  if items.len() == 0 { return none }
  // 每项内部不断行，便于复制
  text(size: meta-size, fill: muted, items.map(c => box(c)).join(h(0.55em) + dot(0.22em, hairline.darken(25%)) + h(0.55em)))
}

#let intention-row(d) = {
  let role = get(d, "role")
  let rest = (get(d, "city"), get(d, "availability"), get(d, "salary")).filter(x => x != none)
  if role == none and rest.len() == 0 { return none }
  {
    text(size: meta-size, fill: muted)[求职意向]
    h(0.6em)
    if role != none { text(weight: "bold", fill: accent)[#role] }
    for r in rest { h(0.6em); text(fill: hairline.darken(30%))[|]; h(0.6em); [#r] }
  }
}

#let basic-header(d) = {
  let lines = ()
  lines.push(text(font: serif, size: t.namePt * 1pt, weight: "bold", fill: accent, tracking: 0.12em)[#d.name])
  if intention != none and intention.visible != false {
    let r = intention-row(intention.data)
    if r != none { lines.push(r) }
  }
  let c = contact-row(d)
  if c != none { lines.push(c) }
  let text-part = {
    for (i, l) in lines.enumerate() {
      if i == 1 { v(lead + 2mm) } else if i > 1 { v(lead + 0.6mm) }
      block(l)
    }
  }
  let photo = spec.at("photo", default: none)
  if photo != none {
    grid(
      columns: (1fr, 25mm),
      column-gutter: 6mm,
      align: (left + horizon, right + top),
      text-part,
      box(clip: true, radius: 1.2mm, stroke: 0.5pt + hairline, image(photo, width: 25mm)),
    )
  } else {
    block(text-part)
  }
}

// 求职意向不在页眉时（例如没有基本信息模块），单独成一行
#let intention-standalone(d) = {
  let r = intention-row(d)
  if r != none { block(breakable: false, r) }
}

// ---------------------------------------------------------------- 主体

#let labels = (
  education: "教育背景",
  work: "工作经历",
  internship: "实习经历",
  project: "项目经历",
  skills: "专业技能",
  research: "科研经历",
  paper: "论文发表",
  award: "获奖情况",
)
#let item-fns = (
  education: education-units,
  work: experience-units,
  internship: experience-units,
  project: project-units,
  research: research-units,
  paper: paper-units,
  award: award-units,
)

#let has-basic = doc.modules.any(m => m.type == "basic_info")
#let first = true
#for m in doc.modules {
  let ty = m.type
  // 有基本信息时，求职意向已经并入页眉
  if ty == "job_intention" and has-basic { continue }
  if not first { gap(t.sectionGapMm) }
  first = false
  if ty == "basic_info" {
    basic-header(m.data)
  } else if ty == "job_intention" {
    intention-standalone(m.data)
  } else if ty == "skills" {
    // 所有技能行算作一个条目，行与行之间用「要点间距」
    section(labels.skills, (skills-units(m.data.categories),))
  } else {
    section(labels.at(ty), m.data.items.map(item-fns.at(ty)))
  }
}

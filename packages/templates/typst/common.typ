// 如页 · 三套模板共用的数据读取、主题色、图标和条目渲染。
// 模板文件负责：页面与文字的 set 规则、页眉、模块标题样式、整体布局。
//
// 约定：
// - 数据只从 data.json / tokens.json / page.json 读取。用户文字都以字符串形式插入（[#s]），
//   不会被当成 Typst 标记解析，# * _ $ @ < 等字符都安全。
// - 所有垂直间距由 gap() 显式控制，便于引擎按 token 精确收紧。

#let data = json("data.json")
#let doc-modules = data.modules
#let t = json("tokens.json")
#let spec = json("page.json")

// ---------------------------------------------------------------- 主题色
// 与 packages/schema/src/types.ts 的 THEMES 保持一致
#let themes = (
  ink: rgb("#1f3d63"),
  teal: rgb("#14595a"),
  wine: rgb("#7a2a35"),
  graphite: rgb("#2e3440"),
)
#let accent = themes.at(data.at("theme", default: "ink"), default: themes.ink)
#let ink = rgb("#18202c")                       // 正文：近黑
#let muted = rgb("#4b5563")                     // 次级信息：深灰（打印仍清晰）
#let hairline = rgb("#c9d2de")                  // 细线
#let tint = accent.lighten(90%).desaturate(30%) // 标签、侧栏底色

// ---------------------------------------------------------------- 尺寸
#let body-size = t.bodyPt * 1pt
#let meta-size = t.metaPt * 1pt
#let lead = (t.lineHeight - 1) * body-size
#let compact = t.compact
#let sans = (t.fontFamily.sans, "Noto Sans SC")
#let serif = (t.fontFamily.serif, "Noto Serif SC", t.fontFamily.sans, "Noto Sans SC")
#let margin = t.pageMarginMm
#let text-width = 210mm - (margin.left + margin.right) * 1mm
#let page-height = if spec.height == "auto" { auto } else { spec.height * 1mm }
#let page-margin = (top: margin.top * 1mm, bottom: margin.bottom * 1mm, left: margin.left * 1mm, right: margin.right * 1mm)

// 页脚页码：只在实际超过一页时出现（标准分页），印在下页边里，不占版心、不影响测量。
// 页数来自 Typst 的分页结果本身，所以 PDF、预览、界面显示的页数是同一个数。
#let page-footer = context {
  let total = counter(page).final().first()
  if total > 1 {
    set text(size: meta-size, fill: muted, top-edge: "cap-height", bottom-edge: "baseline")
    align(right, [#counter(page).display() / #total])
  }
}

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
#let pretty-url(u) = u.replace(regex("^https?://"), "").replace(regex("^mailto:"), "").replace(regex("/$"), "")
// 链接安全：只为 http、https、mailto 生成可点击链接；没写协议的网址（github.com/xx）补 https://；
// 其他协议（javascript:、data: 等）只显示文字，不生成链接——预览 SVG 会插进编辑器页面，不能让它执行脚本
#let safe-url(u) = {
  if u.match(regex("(?i)^(https?://|mailto:)")) != none { u }
  else if u.match(regex("^[A-Za-z][A-Za-z0-9+.-]*:")) != none { none }
  else { "https://" + u }
}
#let url-link(u) = {
  let target = safe-url(u)
  if target == none { [#pretty-url(u)] } else { link(target)[#pretty-url(u)] }
}
#let dot(size, color) = box(baseline: -0.32em, circle(radius: size / 2, fill: color))

#let title-text(s) = text(weight: "bold")[#s]
#let role-text(s) = text(fill: accent)[#s]
#let sep = h(0.7em)

// ---------------------------------------------------------------- 图标（原创，简单线性图形）

#let icon-svg = (
  phone: "<rect x='6.5' y='2.5' width='11' height='19' rx='2.5' fill='none' stroke='C' stroke-width='2'/><circle cx='12' cy='17.6' r='1.3' fill='C'/>",
  email: "<rect x='3' y='5' width='18' height='14' rx='2.2' fill='none' stroke='C' stroke-width='2'/><path d='M4 7l8 6 8-6' fill='none' stroke='C' stroke-width='2' stroke-linejoin='round' stroke-linecap='round'/>",
  location: "<path d='M12 21.5s6.5-5.8 6.5-11.2a6.5 6.5 0 1 0-13 0c0 5.4 6.5 11.2 6.5 11.2z' fill='none' stroke='C' stroke-width='2' stroke-linejoin='round'/><circle cx='12' cy='10.3' r='2.4' fill='C'/>",
  code: "<path d='M8.5 7 3.5 12l5 5M15.5 7l5 5-5 5' fill='none' stroke='C' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/>",
  link: "<path d='M10.2 13.8a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7l-1.1 1.1M13.8 10.2a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1.1-1.1' fill='none' stroke='C' stroke-width='2' stroke-linecap='round'/>",
  person: "<circle cx='12' cy='8' r='3.8' fill='none' stroke='C' stroke-width='2'/><path d='M4.5 20.5c1.4-3.8 4.2-5.6 7.5-5.6s6.1 1.8 7.5 5.6' fill='none' stroke='C' stroke-width='2' stroke-linecap='round'/>",
  target: "<circle cx='12' cy='12' r='8.5' fill='none' stroke='C' stroke-width='2'/><circle cx='12' cy='12' r='4' fill='none' stroke='C' stroke-width='2'/><circle cx='12' cy='12' r='1.2' fill='C'/>",
)

#let icon(name, color: accent, size: 0.95em) = box(
  baseline: 0.14em,
  image(
    bytes("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>" + icon-svg.at(name).replace("C", color.to-hex()) + "</svg>"),
    format: "svg",
    height: size,
  ),
)

// 联系方式：返回 ((图标名, 内容), ...)；顺序固定
#let contact-items(d) = {
  let items = ()
  if has(d, "phone") { items.push(("phone", [#d.phone])) }
  if has(d, "email") { items.push(("email", link("mailto:" + d.email)[#d.email])) }
  if has(d, "location") { items.push(("location", [#d.location])) }
  if has(d, "github") { items.push(("code", url-link(d.github))) }
  for k in ("website", "blog") {
    if has(d, k) { items.push(("link", url-link(d.at(k)))) }
  }
  let custom = if has(d, "customLinks") { d.customLinks } else { () }
  for l in custom {
    if l.url != "" { items.push(("link", [#l.label #url-link(l.url)])) }
  }
  let personal = (get(d, "gender"), fmt-date(get(d, "birthday"))).filter(x => x != none and x != "")
  if personal.len() > 0 { items.push(("person", [#personal.join(" · ")])) }
  items
}

// 一行联系方式：图标 + 文字，项与项之间留白；每项内部不断行，便于复制
#let contact-row(d, color: muted) = {
  let items = contact-items(d)
  if items.len() == 0 { return none }
  text(size: meta-size, fill: color, items.map(((ic, c)) => box[#icon(ic) #h(0.15em) #c]).join(h(1.1em)))
}

#let intention-module = doc-modules.find(m => m.type == "job_intention")
#let has-basic = doc-modules.any(m => m.type == "basic_info")

// 求职意向：岗位加粗 + 其余信息用竖线分隔
#let intention-row(d, label: true) = {
  let role = get(d, "role")
  let rest = (get(d, "city"), get(d, "availability"), get(d, "salary")).filter(x => x != none)
  if role == none and rest.len() == 0 { return none }
  {
    if label { icon("target"); h(0.35em) }
    if role != none { text(weight: "bold", fill: accent)[#role] }
    for (i, r) in rest.enumerate() {
      if i > 0 or role != none { h(0.55em); text(fill: hairline.darken(30%))[|]; h(0.55em) }
      [#r]
    }
  }
}

#let photo-path = spec.at("photo", default: none)
// 照片：3:4 证件照比例，超出部分裁切
#let photo-box(width) = box(width: width, height: width * 4 / 3, clip: true, radius: 1.2mm, stroke: 0.5pt + hairline, image(photo-path, width: 100%, height: 100%, fit: "cover"))

// ---------------------------------------------------------------- 正文元素

// 量化成果加粗：带单位的数字（320ms、85%、3 天、20 万）或两位以上整数（600、1500）。
// 紧跟在字母或符号后的数字是型号、版本号（P99、A4、HTTP/2），小数（OAuth 2.0）也不加粗。
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

// 标题行：左侧标题，右侧日期（右对齐、等宽数字）
#let headline(lhs, rhs) = {
  // 标题行折行时不做两端对齐，避免把字拉散
  set par(justify: false)
  if rhs == none or rhs == "" {
    block(lhs)
  } else {
    grid(
      columns: (1fr, auto),
      column-gutter: 1em,
      align: (left + bottom, right + bottom),
      lhs,
      text(size: meta-size, fill: muted, number-width: "tabular")[#rhs],
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
#let bullets(arr) = nonempty(arr).map(b => bullet(b))

// 技术栈标签：底色用 outset 画在行框之外，不改变行高，所以有无标签的行距一致
#let tag(s) = box(
  fill: tint,
  radius: 0.22em,
  inset: (x: 0.38em),
  outset: (y: 0.2em),
  text(size: meta-size, fill: accent)[#s],
)
#let tags(arr) = arr.map(tag).join(h(0.4em))

// 简介 + 技术栈：默认分两行；紧凑变体合并成一行
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

// ---------------------------------------------------------------- 条目
//
// 每个条目返回一组「单元」（content 数组）。第一个单元是不可拆分的「标题 + 第一行」，
// 保证标准分页时条目标题不会孤零零落在页底。

// metas：标题下的简介、技术栈行；lines：要点。标题、全部 metas 与第一条要点绑成一个不可拆分的单元，
// 这样标准分页时不会出现「标题和简介在页底、要点全在下一页」的情况
#let item-units(head, lines, metas: ()) = {
  let metas = metas.filter(x => x != none).map(x => block(x))
  let lines = lines.filter(x => x != none).map(x => block(x))
  let keep = metas + lines.slice(0, calc.min(1, lines.len()))
  let first = block(breakable: false, {
    head
    for u in keep {
      gap(t.paragraphGapMm)
      u
    }
  })
  (first,) + lines.slice(calc.min(1, lines.len()))
}

#let education-units(item) = {
  let lhs = {
    title-text(item.school)
    if has(item, "major") { sep; role-text(item.major) }
    if has(item, "degree") { sep; meta(item.degree) }
  }
  item-units(headline(lhs, date-range(get(item, "start"), get(item, "end"))), bullets(get(item, "highlights")))
}

#let experience-units(item) = {
  let lhs = {
    title-text(item.org)
    if has(item, "title") { sep; role-text(item.title) }
  }
  item-units(headline(lhs, date-range(get(item, "start"), get(item, "end"))), bullets(get(item, "bullets")), metas: meta-lines(item))
}

#let project-units(item) = {
  let lhs = {
    title-text(item.name)
    if has(item, "role") { sep; role-text(item.role) }
    if has(item, "url") { sep; text(size: meta-size, fill: muted, url-link(item.url)) }
  }
  item-units(headline(lhs, date-range(get(item, "start"), get(item, "end"))), bullets(get(item, "bullets")), metas: meta-lines(item))
}

#let research-units(item) = {
  let lhs = {
    title-text(item.name)
    if has(item, "org") { sep; role-text(item.org) }
  }
  item-units(headline(lhs, date-range(get(item, "start"), get(item, "end"))), bullets(get(item, "bullets")))
}

// 论文、获奖每条只有一行：整个模块算作一个条目，行与行之间用「要点间距」
#let paper-row(item) = {
  let parts = (get(item, "authors"), get(item, "venue")).filter(x => x != none)
  let body = {
    title-text(item.title)
    if parts.len() > 0 { sep; meta(parts.join(". ")) }
    if has(item, "url") { sep; text(size: meta-size, fill: muted, url-link(item.url)) }
  }
  block(breakable: false, headline(body, fmt-date(get(item, "date"))))
}

#let award-row(item) = {
  let lhs = {
    text(weight: "medium")[#item.name]
    if has(item, "issuer") { sep; role-text(item.issuer) }
    if has(item, "description") { sep; meta(item.description) }
  }
  block(breakable: false, headline(lhs, fmt-date(get(item, "date"))))
}

// 技能：「分类 | 内容」两栏对齐。紧凑变体在每行都放得进半栏时改成双列
#let skill-cats(cats) = cats.filter(c => nonempty(c.items).len() > 0)
#let skill-row(c, label-w: 4.6em) = grid(
  columns: (label-w, 1fr),
  align: (left + top, left + top),
  text(weight: "bold", fill: accent)[#c.name],
  par(justify: false)[#nonempty(c.items).join("、")],
)
#let skills-units(cats, width: text-width, allow-two-columns: true) = {
  let cats = skill-cats(cats)
  let label-w = 4.6em
  let row-gap = lead + t.paragraphGapMm * 1mm
  if compact and allow-two-columns and cats.len() > 1 {
    (context {
      let col = ((width - 1.5em) / 2).to-absolute() - label-w.to-absolute()
      let fits = cats.all(c => measure([#c.name]).width <= label-w.to-absolute() and measure([#nonempty(c.items).join("、")]).width <= col)
      if fits {
        grid(columns: (1fr, 1fr), column-gutter: 1.5em, row-gutter: row-gap, ..cats.map(skill-row))
      } else {
        stack(spacing: row-gap, ..cats.map(skill-row))
      }
    },)
  } else {
    cats.map(skill-row)
  }
}

#let module-labels = (
  education: "教育背景",
  work: "工作经历",
  internship: "实习经历",
  project: "项目经历",
  skills: "专业技能",
  research: "科研经历",
  paper: "论文发表",
  award: "获奖情况",
)

// 模块 → 条目列表（每个条目是一组单元）
#let module-items(m, skills-width: text-width, allow-two-columns: true) = {
  let ty = m.type
  if ty == "skills" { return (skills-units(m.data.categories, width: skills-width, allow-two-columns: allow-two-columns),) }
  if ty == "paper" { return (m.data.items.map(paper-row),) }
  if ty == "award" { return (m.data.items.map(award-row),) }
  let f = (
    education: education-units,
    work: experience-units,
    internship: experience-units,
    project: project-units,
    research: research-units,
  ).at(ty)
  m.data.items.map(f)
}

// 一个模块：标题与第一个单元绑在一起，之后的单元之间按「要点间距 / 条目间距」分隔
#let render-section(head, items, after-head: 2mm) = {
  if items.len() == 0 { return }
  block(breakable: false, {
    head
    v(if compact { after-head * 0.65 } else { after-head })
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

// 依次渲染一组模块，模块之间用「模块间距」
#let render-modules(modules, section-head, skills-width: text-width, allow-two-columns: true, after-head: 2mm) = {
  for (i, m) in modules.enumerate() {
    if i > 0 { gap(t.sectionGapMm) }
    render-section(section-head(module-labels.at(m.type)), module-items(m, skills-width: skills-width, allow-two-columns: allow-two-columns), after-head: after-head)
  }
}

// 正文模块：基本信息和求职意向都放在页眉里
#let basic-module = doc-modules.find(m => m.type == "basic_info")
#let body-modules = doc-modules.filter(m => m.type != "basic_info" and m.type != "job_intention")

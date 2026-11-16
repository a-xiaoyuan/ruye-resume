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

// ---------------------------------------------------------------- 主题色板
// 每个主题一整套颜色：primary 深主色（标题、强调文字）、secondary 鲜明辅色（图形、色块）、
// bright 亮色（渐变的另一端）、tint 极浅底色（胶囊、卡片）。
// 文字只用 primary（对白底对比度足够打印）；secondary / bright 只用于图形和大面积色块。
// 主题 id 与 packages/schema/src/types.ts 的 THEMES 保持一致
#let palettes = (
  ink: (primary: rgb("#1d3b8b"), secondary: rgb("#2f6fe4"), bright: rgb("#38bdf8"), tint: rgb("#eef4ff")),
  teal: (primary: rgb("#0e5f5c"), secondary: rgb("#12a594"), bright: rgb("#5eead4"), tint: rgb("#eafbf6")),
  wine: (primary: rgb("#8c1d40"), secondary: rgb("#d1365f"), bright: rgb("#fb7185"), tint: rgb("#fff0f3")),
  graphite: (primary: rgb("#1f2937"), secondary: rgb("#475569"), bright: rgb("#94a3b8"), tint: rgb("#f1f5f9")),
  violet: (primary: rgb("#4c1d95"), secondary: rgb("#7c3aed"), bright: rgb("#c084fc"), tint: rgb("#f5f0ff")),
  amber: (primary: rgb("#8a3b0b"), secondary: rgb("#d97706"), bright: rgb("#fbbf24"), tint: rgb("#fff7e6")),
  // 只给「极简 · 黑白」用，不出现在主题色选择里
  mono: (primary: rgb("#111111"), secondary: rgb("#3a3a3a"), bright: rgb("#8a8a8a"), tint: rgb("#f1f1f1")),
)
#let pal = palettes.at(data.at("theme", default: "ink"), default: palettes.ink)
#let accent = pal.primary
#let accent2 = pal.secondary
#let bright = pal.bright
#let tint = pal.tint
#let ink = rgb("#161b26")                       // 正文：近黑
#let muted = rgb("#4b5563")                     // 次级信息：深灰（打印仍清晰）
#let hairline = rgb("#d5dbe4")                  // 细线
// 渐变：主色 → 辅色 → 亮色
#let grad-h = gradient.linear(pal.primary, pal.secondary, pal.bright, angle: 0deg)
#let grad-v = gradient.linear(pal.primary, pal.secondary, angle: 90deg)

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
  phone: "<rect x='6.5' y='2.5' width='11' height='19' rx='2.5' fill='none' stroke='{c}' stroke-width='2'/><circle cx='12' cy='17.6' r='1.3' fill='{c}'/>",
  email: "<rect x='3' y='5' width='18' height='14' rx='2.2' fill='none' stroke='{c}' stroke-width='2'/><path d='M4 7l8 6 8-6' fill='none' stroke='{c}' stroke-width='2' stroke-linejoin='round' stroke-linecap='round'/>",
  location: "<path d='M12 21.5s6.5-5.8 6.5-11.2a6.5 6.5 0 1 0-13 0c0 5.4 6.5 11.2 6.5 11.2z' fill='none' stroke='{c}' stroke-width='2' stroke-linejoin='round'/><circle cx='12' cy='10.3' r='2.4' fill='{c}'/>",
  code: "<path d='M8.5 7 3.5 12l5 5M15.5 7l5 5-5 5' fill='none' stroke='{c}' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/>",
  link: "<path d='M10.2 13.8a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7l-1.1 1.1M13.8 10.2a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1.1-1.1' fill='none' stroke='{c}' stroke-width='2' stroke-linecap='round'/>",
  person: "<circle cx='12' cy='8' r='3.8' fill='none' stroke='{c}' stroke-width='2'/><path d='M4.5 20.5c1.4-3.8 4.2-5.6 7.5-5.6s6.1 1.8 7.5 5.6' fill='none' stroke='{c}' stroke-width='2' stroke-linecap='round'/>",
  target: "<circle cx='12' cy='12' r='8.5' fill='none' stroke='{c}' stroke-width='2'/><circle cx='12' cy='12' r='4' fill='none' stroke='{c}' stroke-width='2'/><circle cx='12' cy='12' r='1.2' fill='{c}'/>",
)

// 模块图标（原创线性图形，24×24）
#let section-icon-svg = (
  education: "<path d='M12 4 2 9l10 5 10-5-10-5z' fill='none' stroke='{c}' stroke-width='2' stroke-linejoin='round'/><path d='M6 11.4v4.6c0 1.6 2.7 3 6 3s6-1.4 6-3v-4.6M22 9v5' fill='none' stroke='{c}' stroke-width='2' stroke-linecap='round'/>",
  skills: "<path d='M13.5 2.5 5 13.5h6l-1 8 8.5-11h-6l1-8z' fill='none' stroke='{c}' stroke-width='2' stroke-linejoin='round'/>",
  work: "<rect x='3' y='7' width='18' height='13' rx='2.2' fill='none' stroke='{c}' stroke-width='2'/><path d='M9 7V5.2h6V7M3 12.5h18' fill='none' stroke='{c}' stroke-width='2'/>",
  internship: "<rect x='3' y='7' width='18' height='13' rx='2.2' fill='none' stroke='{c}' stroke-width='2'/><path d='M9 7V5.2h6V7M3 12.5h18' fill='none' stroke='{c}' stroke-width='2'/>",
  project: "<path d='M12 3 2.5 8 12 13l9.5-5L12 3z' fill='none' stroke='{c}' stroke-width='2' stroke-linejoin='round'/><path d='m2.5 12.5 9.5 5 9.5-5M2.5 17 12 22l9.5-5' fill='none' stroke='{c}' stroke-width='2' stroke-linejoin='round'/>",
  research: "<path d='M9 3h6M10 3v6.2l-5.2 9.1A1.8 1.8 0 0 0 6.4 21h11.2a1.8 1.8 0 0 0 1.6-2.7L14 9.2V3M7.5 15h9' fill='none' stroke='{c}' stroke-width='2' stroke-linejoin='round' stroke-linecap='round'/>",
  paper: "<path d='M7 3h7l5 5v13H7z' fill='none' stroke='{c}' stroke-width='2' stroke-linejoin='round'/><path d='M14 3v5h5M10 13h6M10 17h6' fill='none' stroke='{c}' stroke-width='2' stroke-linecap='round'/>",
  award: "<circle cx='12' cy='9' r='5.5' fill='none' stroke='{c}' stroke-width='2'/><path d='m8.6 13.3-1.4 7.7L12 18.6l4.8 2.4-1.4-7.7' fill='none' stroke='{c}' stroke-width='2' stroke-linejoin='round'/>",
  summary: "<path d='M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z' fill='none' stroke='{c}' stroke-width='2' stroke-linejoin='round'/>",
)
#let svg-image(body, color, size) = image(
  bytes("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>" + body.replace("{c}", color.to-hex()) + "</svg>"),
  format: "svg",
  height: size,
)
// 圆形色块里的白色模块图标
#let section-badge(type, size: 1.55em, fill: accent) = box(
  baseline: 0.3em,
  circle(radius: size / 2, fill: fill, inset: 0pt, align(center + horizon, svg-image(section-icon-svg.at(type, default: section-icon-svg.project), white, size * 0.58))),
)

#let icon(name, color: accent, size: 0.95em) = box(
  baseline: 0.14em,
  image(
    bytes("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>" + icon-svg.at(name).replace("{c}", color.to-hex()) + "</svg>"),
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
#let contact-row(d, color: muted, icon-color: accent, sep: h(1.1em)) = {
  let items = contact-items(d)
  if items.len() == 0 { return none }
  text(size: meta-size, fill: color, items.map(((ic, c)) => box[#icon(ic, color: icon-color) #h(0.15em) #c]).join(sep))
}

// 纯文字联系方式（不带图标），用分隔符连接
#let contact-text(d, sep: [ · ]) = {
  let items = contact-items(d)
  if items.len() == 0 { return none }
  items.map(((ic, c)) => box(c)).join(sep)
}

#let intention-module = doc-modules.find(m => m.type == "job_intention")
#let has-basic = doc-modules.any(m => m.type == "basic_info")

// 求职意向：岗位加粗 + 其余信息用竖线分隔
#let intention-row(d, role-color: accent, color: ink, sep-color: hairline.darken(30%)) = {
  let role = get(d, "role")
  let rest = (get(d, "city"), get(d, "availability"), get(d, "salary")).filter(x => x != none)
  if role == none and rest.len() == 0 { return none }
  text(fill: color, {
    if role != none { text(weight: "bold", fill: role-color)[#role] }
    for (i, r) in rest.enumerate() {
      if i > 0 or role != none { h(0.55em); text(fill: sep-color)[|]; h(0.55em) }
      [#r]
    }
  })
}

#let photo-path = spec.at("photo", default: none)
// 照片：3:4 证件照比例，超出部分裁切
#let photo-box(width) = box(width: width, height: width * 4 / 3, clip: true, radius: 1.2mm, stroke: 0.5pt + hairline, image(photo-path, width: 100%, height: 100%, fit: "cover"))

// 居中页眉：若干行居中排列，照片（如有）固定在右上角。
// 文字区左右各让出照片宽度，保证整页居中且不压照片；照片比文字高时用照片高度撑开。
// 「经典」「雅致」两套模板共用。first-gap / rest-gap：第一行与第二行、其余各行之间的额外间距
#let centered-header(lines, photo-w: 21mm, first-gap: 2.4mm, rest-gap: 1.2mm) = {
  let side = if photo-path != none { photo-w + 4mm } else { 0mm }
  let body = pad(left: side, right: side, align(center, {
    set par(justify: false)
    for (i, l) in lines.enumerate() {
      if i > 0 { v(lead + if i == 1 { first-gap } else { rest-gap }) }
      block(l)
    }
  }))
  block(breakable: false, width: 100%, {
    if photo-path != none { place(top + right, photo-box(photo-w)) }
    context {
      let h = measure(body, width: text-width).height
      body
      if photo-path != none and h < photo-w * 4 / 3 { v(photo-w * 4 / 3 - h) }
    }
  })
}

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
// 日期的样式由模板选择：pill（浅底胶囊）、accent（主色文字）、plain（灰色文字）
#let date-style = state("ruye-date-style", "plain")
#let date-display(s) = context {
  let style = date-style.get()
  let body = text(size: meta-size, number-width: "tabular")[#s]
  if style == "pill" {
    box(fill: tint, radius: 99pt, inset: (x: 0.6em), outset: (y: 0.24em), text(fill: accent, weight: "medium", body))
  } else if style == "accent" {
    text(fill: accent, weight: "medium", body)
  } else {
    text(fill: muted, body)
  }
}

// 日期样式为 "none" 时标题行不放日期（时间轴模板把日期放在左侧时间列）
#let headline(lhs, rhs) = context {
  // 标题行折行时不做两端对齐，避免把字拉散
  set par(justify: false)
  if rhs == none or rhs == "" or date-style.get() == "none" {
    block(lhs)
  } else {
    grid(
      columns: (1fr, auto),
      column-gutter: 1em,
      align: (left + bottom, right + bottom),
      lhs,
      date-display(rhs),
    )
  }
}

// 要点：强调色小圆点 + 内容（悬挂缩进）
#let bullet-of(body) = grid(
  columns: (1em, 1fr),
  align: (left + top, left + top),
  box(height: 1em, align(horizon, move(dy: 0.08em, dot(0.32em, accent)))),
  body,
)
// 要点的三种写法（都只是普通字符串，不改数据结构）：
//  · 「个人职责：」这种以冒号结尾的短行 → 分块小标题（不带圆点，主色加粗）
//  · 「缓存优化：用 Redis……」句首短语 + 冒号 → 冒号前加粗，成为这一条的短标题
//  · 其他 → 普通要点，数字指标自动加粗
#let lead-key-re = regex("^([^：:，,。；;、]{1,14})[：:]\s*")
#let subhead-re = regex("^[^：:，,。；;]{1,12}[：:]\s*$")
#let is-subhead(s) = s.trim().match(subhead-re) != none
#let subhead(s) = block(above: 0pt, below: 0pt,
  text(weight: "bold", fill: accent)[#s.trim().trim(regex("[：:]"), at: end)])
#let bullet(s) = {
  let key = s.match(lead-key-re)
  if key != none and key.end < s.len() {
    bullet-of({ text(weight: "bold")[#key.captures.at(0)]; [：]; emphasize(s.slice(key.end)) })
  } else {
    bullet-of(emphasize(s))
  }
}
// 小标题与紧随其后的第一条要点绑在一起，避免分页时小标题落在页底
#let bullets(arr) = {
  let out = ()
  let pending = none
  for b in nonempty(arr) {
    if is-subhead(b) {
      if pending != none { out.push(pending) }
      pending = subhead(b)
    } else if pending != none {
      out.push(block(breakable: false, { pending; v(lead * 0.6, weak: true); bullet(b) }))
      pending = none
    } else {
      out.push(bullet(b))
    }
  }
  if pending != none { out.push(pending) }
  out
}

// 技术栈：强调色文字、细圆点分隔。打印比底色标签干净，也更省地方
// 技术栈之间用顿号：中文的列举习惯；换行时落在行尾也自然，不会像圆点那样孤零零挂着
#let tech-sep = text(fill: ink.lighten(45%))[、]
// 分隔点并进前一项的盒子里：折行只会发生在点之后，新的一行不会以「·」开头
#let tech-text(arr) = {
  let n = arr.len()
  // 技术栈用正文深灰而不是主色：主色只留给标题、岗位和要点圆点，一页上蓝色太多就看不出重点。
  // 用户常顺手在最后一项后面打句号，去掉
  let clean = arr.map(s => s.trim().trim(regex("[。，、；;,.]+"), at: end))
  text(size: meta-size, fill: ink.lighten(18%), clean.enumerate().map(((i, s)) => box[#s#if i < n - 1 { tech-sep }]).join(h(0pt)))
}

// 条目标题下的一行：简介（灰）+ 技术栈（强调色）+ 链接（灰）。三者都可缺省，挤不下时自然折行
#let meta-label(s) = text(size: meta-size, weight: "bold", fill: ink)[#s：]
// 「标签：内容」一行；内容折行时与第一行内容对齐（悬挂缩进），不顶到左边
#let labeled(label, body, justify: true) = grid(
  columns: (auto, 1fr),
  align: (left + top, left + top),
  meta-label(label),
  par(justify: justify, body),
)
#let meta-lines(item, url: none, summary-label: "简介") = {
  let out = ()
  let s = get(item, "summary")
  let stack = nonempty(get(item, "techStack"))
  if s != none {
    out.push(labeled(summary-label, text(size: meta-size, fill: ink)[#s]))
  }
  if stack.len() > 0 {
    let body = tech-text(stack)
    if url != none { body = { body; h(1.2em); text(size: meta-size, fill: muted, url-link(url)) } }
    out.push(labeled("技术栈", body, justify: false))
  } else if url != none {
    out.push(labeled("链接", text(size: meta-size, fill: muted, url-link(url)), justify: false))
  }
  out
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
  }
  // 链接放在下面那行末尾，不挤标题行（否则日期会被挤到第二行）
  item-units(headline(lhs, date-range(get(item, "start"), get(item, "end"))), bullets(get(item, "bullets")), metas: meta-lines(item, url: get(item, "url"), summary-label: "项目简介"))
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
// 技能描述句：句首是「Java 基础：……」时加粗冒号前的关键词；
// 否则把句首的熟练度词（精通、熟悉、了解……）用强调色加粗，扫一眼就能看出深浅
#let note-key-re = lead-key-re
#let proficiency-re = regex("^(精通|熟练掌握|熟练使用|熟练|熟悉|掌握|理解|了解|擅长|具备|能够)")
// 句首是熟练度词时优先按熟练度处理：「熟悉检索增强生成的完整链路：切分、召回……」不该整段加粗
#let skill-note(s) = {
  let level = s.match(proficiency-re)
  if level != none {
    return bullet-of({ text(weight: "bold")[#level.text]; emphasize(s.slice(level.end)) })
  }
  let key = s.match(note-key-re)
  if key != none and key.end < s.len() {
    return bullet-of({ text(weight: "bold")[#key.captures.at(0)]; [：]; emphasize(s.slice(key.end)) })
  }
  bullet(s)
}
#let skill-notes(data) = nonempty(data.at("notes", default: none))
#let has-skill-notes(m) = m.type == "skills" and skill-notes(m.data).len() > 0

// 一个技能模块的全部单元：先列分类，再列描述句（两者都可以为空）
#let skills-units(data, width: text-width, allow-two-columns: true) = {
  let cats = skill-cats(data.categories)
  let notes = skill-notes(data).map(skill-note)
  let label-w = 4.6em
  let row-gap = lead + t.paragraphGapMm * 1mm
  let rows = if compact and allow-two-columns and cats.len() > 1 {
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
  rows + notes
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
  summary: "自我评价",
)

// 模块 → 条目列表（每个条目是一组单元）
#let module-items(m, skills-width: text-width, allow-two-columns: true) = {
  let ty = m.type
  if ty == "skills" { return (skills-units(m.data, width: skills-width, allow-two-columns: allow-two-columns),) }
  if ty == "paper" { return (m.data.items.map(paper-row),) }
  if ty == "award" { return (m.data.items.map(award-row),) }
  if ty == "summary" {
    let paras = m.data.text.split("\n").map(x => x.trim()).filter(x => x != "")
    return (paras.map(x => par(justify: true, emphasize(x))),)
  }
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
    render-section(section-head(module-labels.at(m.type), m.type), module-items(m, skills-width: skills-width, allow-two-columns: allow-two-columns), after-head: after-head)
  }
}

// 正文模块：基本信息和求职意向都放在页眉里
#let basic-module = doc-modules.find(m => m.type == "basic_info")
#let body-modules = doc-modules.filter(m => m.type != "basic_info" and m.type != "job_intention")

# 如页 Ruye

**开源、本地优先的中文技术简历编辑器。所见即导出：预览是什么样，导出的 PDF 就是什么样。**

> 在线 Demo：（GitHub Pages 地址待发布）

<p align="center"><img src="docs/preview.png" alt="三套模板预览：校招单栏、社招单栏、双栏紧凑（同一份中等样本，A4 智能一页）"></p>

## 为什么做这个

很多简历工具都有「智能一页」，但内容一多就不灵了：预览和导出不一致；字号、行距缩了一圈还是溢出到第 2 页，也不告诉你到底超出了多少。

如页把「一页」拆成两件诚实的事：

| 模式 | 是什么 | 适合 |
|---|---|---|
| **A4 智能一页** | 真正的 210×297mm 一页。在可读性底线内自动收紧（间距 → 紧凑版式 → 行距 → 字号）；**装不下就明确失败**，告诉你超出多少毫米、哪个模块最占地方，不会悄悄打出第 2 页 | 打印、投递 |
| **无损长一页** | A4 宽、高度随内容变化的**单页** PDF。不缩字号、不挤版面 | 屏幕投递（邮件、网申附件） |
| **标准分页** | 普通 A4 分页，页码如实显示 | 打印 |

可读性底线：正文 ≥ 10.5pt，行距 ≥ 1.35，页边距 ≥ 12mm。宁可报错，也不把字缩成蚂蚁。

## 和同类工具的区别

- **预览与 PDF 同源**：只有一个排版器（浏览器内的 [Typst](https://typst.app) WASM），预览用它出 SVG，导出用它出 PDF，同一份输入。不用 html2canvas 截图，也不用两套渲染各排各的。
- **装不下就说人话**：溢出报告来自真实排版。每个模块、条目占多高，是把它拿掉重排一次量出来的，不是按字数估算。
- **PDF 质量**：文字可选中、可搜索，链接可点击，中文字体内嵌，不是整页位图。
- **本地优先**：简历只存在浏览器的 localStorage 里，PDF 在本地生成，不上传任何内容。没有账号、会员、广告和水印。

## 功能（v0.1）

- [x] 三栏编辑器：左侧模块列表（拖拽或 ↑↓ 排序、显隐开关、添加/删除模块）、中间表单、右侧实时 A4 预览
- [x] 模块：基本信息（含照片）、求职意向、教育、工作、实习、项目、技能、科研、论文、获奖
- [x] 表单细节：要点逐条编辑（回车新增、空行退格删除）、技术栈标签输入、日期自动归一化与「至今」、删除可撤销
- [x] 三套原创模板：校招单栏 `campus-serif`、社招单栏 `social-sans`、双栏紧凑 `split-compact`；四种主题色
- [x] 排版引擎：A4 智能一页 / 无损长一页 / 标准分页 / 溢出报告
- [x] 本地自动保存；`.ruye.json` 与 Markdown 导入导出
- [ ] 排版放进 Web Worker、GitHub Pages 部署

**v1 不做**：账号、云同步、支付、会员、AI 改写、服务端渲染、自动删减你的内容。

## 本地开发

需要 Node.js ≥ 22.18（直接运行 TypeScript 测试）和 pnpm 10。

```bash
pnpm install
pnpm fonts      # 下载思源字体并生成子集（见 docs/fonts.md）
pnpm dev        # 启动编辑器
pnpm test       # 单元测试 + 真实 Typst 黄金测试（没装依赖或字体时，黄金测试会自动跳过并说明原因）
pnpm smoke      # 用真实排版把三份样本按三种模式各导出一遍，输出 out/*.pdf 和 out/report.md
pnpm build      # 构建静态站点（apps/web/dist），可直接部署到 GitHub Pages
```

## 目录

```
apps/web/             Vite + React 编辑器
packages/schema/      文档类型、零依赖校验器、Markdown 映射
packages/engine/      排版引擎（measure / fit-a4 / continuous / 溢出报告）与 typst.ts 后端
packages/templates/   Typst 模板与 token（default / floor）
fixtures/             虚构示例：short / medium / long
tests/                单元测试与 Typst 黄金测试
docs/                 设计说明、字体说明、阶段报告
```

## 字体与许可证

- 代码：MIT（见 [LICENSE](LICENSE)）
- 字体：思源黑体 / 思源宋体（Noto Sans SC / Noto Serif SC），SIL Open Font License 1.1。字体不进仓库，用 `pnpm fonts` 下载，详见 [docs/fonts.md](docs/fonts.md)

## 贡献

欢迎开 Issue / PR。新模板请走「token + Typst 模板文件」的方式（见 `packages/templates`），不要引入后端。提交前请跑 `pnpm test`。

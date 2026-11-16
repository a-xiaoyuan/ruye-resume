# 如页 Ruye

**开源、本地优先的中文技术简历编辑器。所见即导出：预览是什么样，导出的 PDF 就是什么样。**

[![CI](https://github.com/a-xiaoyuan/ruye-resume/actions/workflows/ci.yml/badge.svg)](https://github.com/a-xiaoyuan/ruye-resume/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Node](https://img.shields.io/badge/node-%E2%89%A522.18-339933)
![pnpm](https://img.shields.io/badge/pnpm-10-f69220)

你只负责写内容，排版交给一个真正的排版引擎（[Typst](https://typst.app)）。
没有账号、没有会员、没有水印，简历不出你的浏览器。

![如页编辑器：左侧版式与模块，中间表单，右侧 A4 实时预览](docs/ui.png)

## 三句话认识如页

1. **预览与 PDF 同源。** 整个应用只有一个排版器——浏览器里的 Typst WASM。预览用它出 SVG，导出用它出 PDF，喂的是同一份输入、同一次排版结果。不用 html2canvas 截图，也没有「网页一套、打印一套」。
2. **「一页」是诚实的。** A4 智能一页会在可读性底线内自动收紧；**装不下就明确失败**，告诉你超出多少毫米、哪个模块最占地方，而不是悄悄把字缩成蚂蚁或多打一页。
3. **数据不出浏览器。** 简历只存在 localStorage，PDF 在本地生成。断网也能用，关掉页面内容还在。

## 三种页面模式

| 模式 | 是什么 | 适合 |
|---|---|---|
| **A4 智能一页** | 真正的 210×297mm 一页。按「间距 → 紧凑版式 → 行距 → 字号」逐步收紧；装不下就报错并给出溢出报告 | 打印、投递 |
| **无损长一页** | A4 宽、高度随内容变化的**单页** PDF。不缩字号、不挤版面 | 屏幕投递（邮件、网申附件） |
| **标准分页** | 普通 A4 分页。多于一页时页脚印「1 / 2」，页数取自 Typst 实际分页，导出后再读 PDF 自身页数核对 | 打印 |

可读性底线：正文 ≥ 10.5pt，行距 ≥ 1.35，页边距 ≥ 12mm。
溢出报告来自真实排版——每个模块、条目占多高，是**把它拿掉重排一次量出来的**，不是按字数估算。预览里会直接画出 A4 底边和溢出区域。

## 三套模板 × 四种主题色

| 模板 | 风格 | 推荐场景 |
|---|---|---|
| `campus-serif` 校招单栏 | 衬线标题、教育前置、留白充足 | 应届生、实习 |
| `social-sans` 社招单栏 | 全无衬线、信息更密，技能与履历优先 | 1～8 年经验 |
| `split-compact` 双栏紧凑 | 左栏联系方式/技能/教育/获奖，右栏经历 | 内容多、想压住一页 |

主题色：墨蓝 / 青黛 / 绛红 / 石墨。同一份内容随时换模板换色，不用重填。

![三套模板预览：同一份中等样本，A4 智能一页](docs/preview.png)

## 编辑体验

- **三栏工作台**：左侧版式与模块，中间表单，右侧 A4 实时预览（300ms 防抖重排，可缩放）。
- **十种模块**：基本信息（含照片）、求职意向、教育、工作、实习、项目、技能、科研、论文、获奖。模块可拖拽排序、显隐开关，也可一键按当前模板的推荐顺序排列。
- **为写简历设计的表单**：要点逐条编辑（回车新增、空行退格删除）、技术栈标签输入、日期自动归一化与「至今」、条目折叠、删除可撤销。
- **两种数据格式**：`.ruye.json` 与 Markdown **双向互转**（照片以内嵌图片保存在 Markdown 里，文件自包含），可以用 Git 管理你的简历，也可以粘贴给别的工具。
- **PDF 质量**：文字可选中、可搜索，链接可点击，中文字体内嵌，不是整页位图。
- **缺字检测**：内置字体是 GB2312 子集（3 个文件共 5.6MB，完整字体要 27.6MB），导出前会列出缺字，避免交付一份带方块的简历。
- **导入安全**：链接只接受 http、https、mailto，预览前再清理一遍，打开别人发来的简历文件不会执行脚本。

## 和同类工具的取舍

| 维度 | 如页 Ruye | Reactive Resume | 木及简历 | 简单简历 |
|---|---|---|---|---|
| 定位 | 中文技术简历，本地优先 | 全功能简历平台 | Markdown 简历工具 | 表单 + AI 简历工具 |
| 开源 | MIT，全部代码 | MIT，可 Docker 自托管 | 编辑器核心开源 | 在线服务，未开源 |
| 账号 | 不需要 | 托管版需要；自托管不需要 | 需要（云端保存） | 需要 |
| 数据位置 | 只在本机浏览器 | 自托管数据库或官方云 | 远端存储 | 官方云 |
| 编辑方式 | 表单 + Markdown/JSON 互转 | 表单，多简历与求职追踪 | Markdown | 表单 + AI 改写 |
| 排版 | Typst WASM，预览与 PDF 同一排版器 | Web 渲染 | Web 渲染 | Web 渲染 |
| 一页策略 | 底线内收紧，装不下明确报错并量化溢出 | 自由分页 | 智能一页（官方宣传） | 以模板分页为主 |
| 导出 | PDF / Markdown / JSON，免费 | PDF / Word / Markdown / JSON | PDF / MD / PNG | 编辑分享免费，PDF 下载为会员功能 |

> 竞品信息来自各自官网与公开资料（2026-11），功能以其最新说明为准。如页不做账号、云同步、AI 改写、求职追踪——不是做不到，而是这些事会把「一份简历」变成「一份需要平台替你保管的数据」。如果你需要那些能力，上面的工具更值得选。

## 快速开始

需要 **Node.js ≥ 22.18**（直接运行 TypeScript 测试）与 **pnpm 10**。

```bash
pnpm install
pnpm fonts      # 首次：下载思源字体并生成子集（见 docs/fonts.md）
pnpm dev        # 启动编辑器，默认 http://localhost:5173
```

| 命令 | 作用 |
|---|---|
| `pnpm test` | 单元测试 + 真实 Typst 黄金测试（无字体时黄金测试自动跳过并说明原因） |
| `pnpm typecheck` | 对 packages 与 apps/web 做严格类型检查 |
| `pnpm smoke` | 用真实排版把三份样本按三种模式各导出一遍，输出 `out/*.pdf` 与 `out/report.md` |
| `pnpm build` | 构建静态站点到 `apps/web/dist`，可直接部署到 GitHub Pages 等任意静态托管 |

## 它是怎么工作的

```
一份文档（.ruye.json / Markdown）
   │  packages/schema     类型定义、零依赖校验器、Markdown 双向映射
   ▼
packages/engine           measure → fit-a4 / continuous / standard
   │                      产出 tokens + 页高 + 溢出报告
   │  packages/templates  Typst 模板 + default/floor 两套 token + 推荐模块顺序
   ▼
Typst WASM（浏览器内）──→ SVG → 右侧预览
                      └─→ PDF → 本地下载
```

关键点：**预览和导出共用同一次 layout 的结果**，所以不存在「预览一个样、导出另一个样」。
整个项目没有后端，构建产物是纯静态文件。

```
apps/web/               Vite + React 18 编辑器（版式面板、模块导航、表单、预览）
packages/schema/        文档类型、零依赖校验、Markdown 互转、日期归一化
packages/engine/        排版引擎：measure / fit-a4 / continuous / 溢出报告 / Typst 后端
packages/templates/     三套 Typst 模板、common.typ、排版 token
fixtures/               虚构示例：short / medium / long
tests/                  单元测试与 Typst 黄金测试
docs/                   设计说明、字体说明、界面与模板截图、阶段报告
scripts/                字体下载与子集、smoke 导出
```

## 测试与 CI

- **46 项测试**：schema 校验与 Markdown 互转、文档操作（增删排序）、排版引擎、Typst 真实黄金测试。
- **CI**：每次 push 到 `main` 自动执行 `install → typecheck → test → 准备字体 → test → build`（见 `.github/workflows/ci.yml`）。
- 黄金测试依赖真实字体与 WASM，本地没准备好时会自动跳过并打印原因，不会假装通过。

## 路线图

已完成：文档模型与校验、排版引擎与溢出报告、三套模板与四种主题色、三栏编辑器、Markdown/JSON 互转、本地自动保存。

进行中：排版放进 Web Worker、GitHub Pages 在线 Demo。

**v1 明确不做**：账号、云同步、支付、会员、AI 改写、服务端渲染、自动删减你的内容。

## 字体与许可证

- 代码：**MIT**（见 [LICENSE](LICENSE)）
- 字体：思源黑体 / 思源宋体（Noto Sans SC / Noto Serif SC），**SIL Open Font License 1.1**。字体不进仓库，用 `pnpm fonts` 下载并裁成子集（需要 `pip install fonttools`），体积与缺字处理详见 [docs/fonts.md](docs/fonts.md)。

## 贡献

欢迎 Issue / PR。新模板请走「token + Typst 模板文件」的方式（见 `packages/templates`），不要引入后端。提交前请跑 `pnpm test` 与 `pnpm typecheck`。

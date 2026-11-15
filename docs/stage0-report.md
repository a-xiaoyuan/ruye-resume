# 阶段 0 / 1 报告

日期：2026-11-15

## 做了什么

| 部分 | 状态 | 说明 |
|---|---|---|
| monorepo 骨架（pnpm workspace、tsconfig strict、CI、MIT） | 完成 | |
| Schema + 校验 + Markdown 往返 | 完成，已测试 | 零依赖，12 个测试通过 |
| 三份虚构样本 short / medium / long | 完成 | 「林知夏」，经历全部编造 |
| 排版引擎：measure / fit-a4 / continuous / standard / 溢出报告 | 完成，算法已测试 | 用模拟后端测试，15 个测试通过 |
| `campus-serif` Typst 模板 | 完成，已用真实 Typst 验证 | v2 视觉：页顶色带、色块标题、技术栈标签、量化数字加粗 |
| typst.ts 后端（浏览器 + Node） | Node 端已验证 | 浏览器端待 `pnpm dev` 验证 |
| 字体脚本 `pnpm fonts` | 已在 Windows 上跑通 | 未装 fonttools 时使用完整字体 |
| 黄金测试（说明书 §10 表格） | 全部通过 | 共 36 个测试，结果见 sample1-report.md |
| 最小网页（Markdown 编辑 + A4 预览 + 三种模式 + 下载 PDF） | 已写，**未运行验证** | |

## 为什么有「未验证」

开发环境无法访问 npm registry，装不上 typst.ts、React、Vite，也下载不了字体。所以：

- 不依赖第三方包的部分（schema、引擎算法、Markdown、字符集）都在 Node 22 里实际跑过测试；
- 依赖 Typst 的部分是按官方文档写的，没有实际编译过。

## 拿到代码后的验收步骤

```bash
pnpm install
pnpm fonts
pnpm test     # 黄金测试会真正运行
pnpm smoke    # 输出 out/*.pdf 和 out/report.md
pnpm dev
```

可能需要调整的地方（按可能性从高到低）：

1. **Typst 模板编译错误**：第一次跑 `pnpm test` 时报错信息会指出行号，修改 `packages/templates/typst/campus-serif.typ`。
2. **样本校准**：黄金测试要求 medium 默认略超一页、收紧后能装下。如果真实高度不符合，调整 `scripts/gen_fixtures.py` 里 medium 的内容后重新生成。
3. **typst.ts 初始化**：`initTypst()` 里 `setCompilerInitOptions` 与 `use(...)` 的调用顺序，或 Node 下 `getModule` 传字节是否可行。
4. **SVG 页数推算**：引擎假设 typst.ts 的多页 SVG 是各页上下紧贴叠放（总高 = 页数 × 297mm）。如果中间有间隔，`pageCount()` 会直接报错而不是静默算错，需要改用逐页解析。

验收通过后，把 `out/report.md` 的内容复制到 `docs/sample1-report.md`。

## 更新（同日）

真实 Typst 黄金测试已全部通过：短样本默认装下一页；中等样本收紧到「紧凑变体」就装下，没有缩字号；长样本在底线下仍超出约 51mm，如实报告溢出。PDF 检查：页数和页面尺寸正确，中文字体以子集形式嵌入，文字可提取。

已知：typst.ts 初始化时会打印 `using deprecated parameters for the initialization function`，来自 wasm-bindgen，不影响结果。

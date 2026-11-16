# 字体

## 使用的字体

| 用途 | 字体 | 文件 | 哪些模板用 |
|---|---|---|---|
| 正文 | 思源黑体 Noto Sans SC Regular | `NotoSansSC-Regular.otf` | 全部 |
| 条目标题、岗位等粗体 | Noto Sans SC Bold | `NotoSansSC-Bold.otf` | 全部 |
| 姓名、模块标题 | 思源宋体 Noto Serif SC Bold | `NotoSerifSC-Bold.otf` | 校招单栏 |

- 来源：<https://github.com/notofonts/noto-cjk>（`Sans/SubsetOTF/SC`、`Serif/SubsetOTF/SC`）
- 许可证：SIL Open Font License 1.1。可以商用，也可以内嵌进 PDF；再分发时必须附带许可证，脚本会把 `OFL.txt` 一并复制到输出目录。
- 格式：Typst 只支持 TTF/OTF，不支持 woff/woff2，所以网页加载的也是 OTF。

## 生成

```bash
pip install fonttools   # 生成子集需要；不装也能用，但会退回完整字体
pnpm fonts              # 子集（推荐）
pnpm fonts -- --full    # 完整字体：不缺字，体积大
```

`scripts/fonts.mjs` 做三件事：

1. 下载 3 个 OTF 到 `fonts-src/`（已在 `.gitignore` 里，不进仓库）。网络受限时手动下载这 3 个文件放进同一个目录，再运行 `RUYE_FONTS_DIR=<目录> pnpm fonts`。
2. 裁成子集：保留 ASCII、拉丁补充、常用标点、CJK 标点、全角符号、箭头、带圈数字，以及 **GB2312 全部 6763 个汉字**，共 8854 个字符。脚本依次尝试 `pyftsubset`、`python3 -m fontTools.subset`、`python -m fontTools.subset`、`py -m fontTools.subset`。Windows 上 pip 装完 fonttools 后 `pyftsubset` 常常不在 PATH 里，后面几种调用方式能兜住。
3. 输出到 `packages/templates/fonts/`（Node 测试用）和 `apps/web/public/fonts/`（网页用），同时写出 `charset.txt`。运行结束时会打印每个文件的体积。

CI 会先 `pip install fonttools` 再运行 `pnpm fonts`，所以构建和部署出去的网页用的都是子集。

## 体积（实测）

| 文件 | 完整字体 | 子集 | gzip 后（子集） |
|---|---|---|---|
| NotoSansSC-Regular.otf | 7.95 MB | 1.65 MB | 1.39 MB |
| NotoSansSC-Bold.otf | 8.15 MB | 1.65 MB | 1.40 MB |
| NotoSerifSC-Bold.otf | 11.53 MB | 2.33 MB | 1.92 MB |
| **合计** | **27.63 MB** | **5.62 MB** | **4.71 MB** |

网页首次打开需要下载的大文件：

| 资源 | 原始大小 | gzip 后 |
|---|---|---|
| Typst 编译器 wasm | 27.01 MB | 10.35 MB |
| Typst 渲染器 wasm | 0.93 MB | 0.34 MB |
| 字体（子集） | 5.62 MB | 4.71 MB |
| 字体（完整，不推荐） | 27.63 MB | 23.96 MB |

- 实际传输多少，取决于服务器是否对这些文件做压缩。下载一次后，浏览器会缓存，之后打开都很快。
- 体积大头是编译器 wasm，不是字体。它包含了整个 Typst 编译器，目前没法再减。
- 用完整字体时，首次下载会多出约 22MB。所以默认用子集，只有确实需要时才加 `--full`。

导出的 PDF 只内嵌实际用到的字形（Typst 自动做二次子集），一份一页简历约 90KB，和用子集还是完整字体无关。

## 缺字

子集之外的字（例如「䶮」这类少见的姓名用字，或 GB2312 之外的繁体字）在 PDF 里会显示成方块。

- 编辑器导出前会用 `charset.txt` 检查所有可见模块，列出缺少的字，**不会导出一份带方块的 PDF**。
- 碰到这种情况，自己部署的话运行 `pnpm fonts -- --full` 改用完整字体（`charset.txt` 会被写空，缺字检查随之关闭）。
- 将来计划：缺字时按需加载完整字体，或只补缺少的那几个字。

## 更换字体

模板通过 `tokens.fontFamily` 指定字体名（`Noto Sans SC` / `Noto Serif SC`），实际加载的文件列表在 `scripts/fonts.mjs`、`scripts/typst-node.ts` 和 `apps/web/src/runtime.ts` 三处，换字体时三处要一起改，并确认新字体的许可证允许内嵌与再分发。

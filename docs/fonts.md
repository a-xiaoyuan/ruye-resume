# 字体

## 使用的字体

| 用途 | 字体 | 文件 |
|---|---|---|
| 正文 | 思源黑体 Noto Sans SC Regular | `NotoSansSC-Regular.otf` |
| 粗体（条目标题） | Noto Sans SC Bold | `NotoSansSC-Bold.otf` |
| 姓名、模块标题 | 思源宋体 Noto Serif SC Bold | `NotoSerifSC-Bold.otf` |

来源：<https://github.com/notofonts/noto-cjk>（`Sans/SubsetOTF/SC`、`Serif/SubsetOTF/SC`）
许可证：SIL Open Font License 1.1。可商用、可内嵌到 PDF；再分发时需附带许可证（脚本会把 `OFL.txt` 一并复制）。

Typst 只支持 TTF/OTF，不支持 woff/woff2，所以网页加载的也是 OTF。

## 生成

```bash
pnpm fonts
```

脚本（`scripts/fonts.mjs`）会：

1. 下载上述 3 个 OTF 到 `fonts-src/`（已在 `.gitignore`，不进仓库）
2. 如果装了 fonttools，就用 `pyftsubset` 裁成子集：ASCII、拉丁补充、常用标点、CJK 标点、全角符号，以及 **GB2312 全部 6763 个汉字**
3. 输出到 `packages/templates/fonts/`（Node 测试用）和 `apps/web/public/fonts/`（网页用），同时写出 `charset.txt`

没装 fonttools 时直接使用完整字体：不会缺字，但网页首次加载更慢。安装方法：`pip install fonttools`。

下载失败（网络受限）时，手动下载这 3 个文件放进同一个目录，然后运行：

```bash
RUYE_FONTS_DIR=/path/to/dir pnpm fonts
```

## 缺字检查

子集之外的字（例如少见的姓氏）在 PDF 里会显示成方块。编辑器在导出前会用 `charset.txt` 检查文档，列出缺少的字，**不会导出一份带方块的 PDF**。如果你的名字里有这类字：不装 fonttools 重新运行 `pnpm fonts` 即可得到完整字体。

PDF 只内嵌实际用到的字形（Typst 自动处理），所以无论用子集还是完整字体，导出的 PDF 体积都很小。

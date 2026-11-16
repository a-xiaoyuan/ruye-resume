# 阶段 1 样本报告

由 `pnpm smoke` 用真实 Typst（typst.ts 0.7 / Typst 0.14）生成。


## 校招 · 横幅（campus-serif）

| 样本 | 模式 | 状态 | 页数 | 内容高度 | 导出页高 | 收紧步骤 | 说明 | PDF |
|---|---|---|---|---|---|---|---|---|
| short | standard | paginated | 1 | 239.5mm | 297mm | — | 标准分页，共 1 页。 | campus-serif-short-standard.pdf |
| short | fit-a4 | fitted-relaxed | 1 | 269.5mm | 297mm | — | 已装进一页 A4。内容不满一页，已适当放宽间距与行距。 | campus-serif-short-fit-a4.pdf |
| short | continuous | continuous | 1 | 239.5mm | 297mm | — | 无损长一页，高度约 1.00 页 A4。 | campus-serif-short-continuous.pdf |
| medium | standard | paginated | 2 | 328.1mm | 297mm | — | 标准分页，共 2 页。 | campus-serif-medium-standard.pdf |
| medium | fit-a4 | fitted-tightened | 1 | 294.9mm | 297mm | 模块间距、条目间距、要点间距、紧凑变体 | 已自动收紧：模块间距 / 条目间距 / 要点间距 / 紧凑变体。 | campus-serif-medium-fit-a4.pdf |
| medium | continuous | continuous | 1 | 328.1mm | 328.1mm | — | 无损长一页，高度约 1.10 页 A4。 | campus-serif-medium-continuous.pdf |
| long | standard | paginated | 2 | 477.7mm | 297mm | — | 标准分页，共 2 页。 | campus-serif-long-standard.pdf |
| long | fit-a4 | overflow | 2 | 367.6mm | 297mm | 模块间距、条目间距、要点间距、紧凑变体、行距、字号 | 超出约 71 mm（约 24%）。占高最多的是「项目经历」。 | （失败，不导出） |
|  |  |  |  |  |  |  | 建议：「项目经历」占总高约 32%（约 119mm），优先精简这里：删掉较弱的条目，或把每条经历的要点压到 2～3 条。 |  |
|  |  |  |  |  |  |  | 建议：单个条目里最长的是「分布式日志采集工具」，约 33mm。 |  |
|  |  |  |  |  |  |  | 建议：也可以改用无损长一页（适合屏幕投递），或标准分页（适合打印）。 |  |
| long | continuous | continuous | 1 | 477.7mm | 477.7mm | — | 无损长一页，高度约 1.61 页 A4。 | campus-serif-long-continuous.pdf |

## 社招 · 侧条（social-sans）

| 样本 | 模式 | 状态 | 页数 | 内容高度 | 导出页高 | 收紧步骤 | 说明 | PDF |
|---|---|---|---|---|---|---|---|---|
| short | standard | paginated | 1 | 219.4mm | 297mm | — | 标准分页，共 1 页。 | social-sans-short-standard.pdf |
| short | fit-a4 | fitted-relaxed | 1 | 246.2mm | 297mm | — | 已装进一页 A4。内容不满一页，已适当放宽间距与行距。 | social-sans-short-fit-a4.pdf |
| short | continuous | continuous | 1 | 219.4mm | 297mm | — | 无损长一页，高度约 1.00 页 A4。 | social-sans-short-continuous.pdf |
| medium | standard | paginated | 2 | 300.9mm | 297mm | — | 标准分页，共 2 页。 | social-sans-medium-standard.pdf |
| medium | fit-a4 | fitted-tightened | 1 | 295.3mm | 297mm | 模块间距 | 已自动收紧：模块间距。 | social-sans-medium-fit-a4.pdf |
| medium | continuous | continuous | 1 | 300.9mm | 300.9mm | — | 无损长一页，高度约 1.01 页 A4。 | social-sans-medium-continuous.pdf |
| long | standard | paginated | 2 | 439.6mm | 297mm | — | 标准分页，共 2 页。 | social-sans-long-standard.pdf |
| long | fit-a4 | overflow | 2 | 354.2mm | 297mm | 模块间距、条目间距、要点间距、紧凑变体、行距、字号 | 超出约 57 mm（约 19%）。占高最多的是「项目经历」。 | （失败，不导出） |
|  |  |  |  |  |  |  | 建议：「项目经历」占总高约 33%（约 116mm），优先精简这里：删掉较弱的条目，或把每条经历的要点压到 2～3 条。 |  |
|  |  |  |  |  |  |  | 建议：单个条目里最长的是「分布式日志采集工具」，约 33mm。 |  |
|  |  |  |  |  |  |  | 建议：也可以改用无损长一页（适合屏幕投递），或标准分页（适合打印）。 |  |
| long | continuous | continuous | 1 | 439.6mm | 439.6mm | — | 无损长一页，高度约 1.48 页 A4。 | social-sans-long-continuous.pdf |

## 双栏 · 深色侧栏（split-compact）

| 样本 | 模式 | 状态 | 页数 | 内容高度 | 导出页高 | 收紧步骤 | 说明 | PDF |
|---|---|---|---|---|---|---|---|---|
| short | standard | paginated | 1 | 171.8mm | 297mm | — | 标准分页，共 1 页。 | split-compact-short-standard.pdf |
| short | fit-a4 | fitted-relaxed | 1 | 186.6mm | 297mm | — | 已装进一页 A4。内容不满一页，已适当放宽间距与行距。 | split-compact-short-fit-a4.pdf |
| short | continuous | continuous | 1 | 171.8mm | 297mm | — | 无损长一页，高度约 1.00 页 A4。 | split-compact-short-continuous.pdf |
| medium | standard | paginated | 1 | 237.4mm | 297mm | — | 标准分页，共 1 页。 | split-compact-medium-standard.pdf |
| medium | fit-a4 | fitted-relaxed | 1 | 263.5mm | 297mm | — | 已装进一页 A4。内容不满一页，已适当放宽间距与行距。 | split-compact-medium-fit-a4.pdf |
| medium | continuous | continuous | 1 | 237.4mm | 297mm | — | 无损长一页，高度约 1.00 页 A4。 | split-compact-medium-continuous.pdf |
| long | standard | paginated | 2 | 383.5mm | 297mm | — | 标准分页，共 2 页。 | split-compact-long-standard.pdf |
| long | fit-a4 | overflow | 2 | 315.4mm | 297mm | 模块间距、条目间距、要点间距、紧凑变体、行距、字号 | 超出约 18 mm（约 6%）。占高最多的是「项目经历」。 | （失败，不导出） |
|  |  |  |  |  |  |  | 建议：「项目经历」占总高约 44%（约 140mm），优先精简这里：删掉较弱的条目，或把每条经历的要点压到 2～3 条。 |  |
|  |  |  |  |  |  |  | 建议：单个条目里最长的是「如页简历编辑器」，约 37mm。 |  |
|  |  |  |  |  |  |  | 建议：也可以改用无损长一页（适合屏幕投递），或标准分页（适合打印）。 |  |
| long | continuous | continuous | 1 | 383.5mm | 383.5mm | — | 无损长一页，高度约 1.29 页 A4。 | split-compact-long-continuous.pdf |

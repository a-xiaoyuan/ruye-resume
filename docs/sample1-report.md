# 阶段 1 样本报告

由 `pnpm smoke` 用真实 Typst（typst.ts 0.7 / Typst 0.14）生成。


## 校招单栏（campus-serif）

| 样本 | 模式 | 状态 | 页数 | 内容高度 | 导出页高 | 收紧步骤 | 说明 | PDF |
|---|---|---|---|---|---|---|---|---|
| short | standard | paginated | 1 | 237.1mm | 297mm | — | 标准分页，共 1 页。 | campus-serif-short-standard.pdf |
| short | fit-a4 | fitted-default | 1 | 237.1mm | 297mm | — | 已装进一页 A4，未做任何收紧。 | campus-serif-short-fit-a4.pdf |
| short | continuous | continuous | 1 | 237.1mm | 297mm | — | 无损长一页，高度约 1.00 页 A4。 | campus-serif-short-continuous.pdf |
| medium | standard | paginated | 2 | 338.3mm | 297mm | — | 标准分页，共 2 页。 | campus-serif-medium-standard.pdf |
| medium | fit-a4 | fitted-tightened | 1 | 280.1mm | 297mm | 模块间距、条目间距、要点间距、紧凑变体 | 已自动收紧：模块间距 / 条目间距 / 要点间距 / 紧凑变体。 | campus-serif-medium-fit-a4.pdf |
| medium | continuous | continuous | 1 | 338.3mm | 338.3mm | — | 无损长一页，高度约 1.14 页 A4。 | campus-serif-medium-continuous.pdf |
| long | standard | paginated | 2 | 485.1mm | 297mm | — | 标准分页，共 2 页。 | campus-serif-long-standard.pdf |
| long | fit-a4 | overflow | 2 | 340.4mm | 297mm | 模块间距、条目间距、要点间距、紧凑变体、行距、字号 | 超出约 43 mm（约 15%）。占高最多的是「项目经历」。 | （失败，不导出） |
|  |  |  |  |  |  |  | 建议：「项目经历」占总高约 34%（约 117mm），优先精简这里：删掉较弱的条目，或把每条经历的要点压到 2～3 条。 |  |
|  |  |  |  |  |  |  | 建议：单个条目里最长的是「分布式日志采集工具」，约 33mm。 |  |
|  |  |  |  |  |  |  | 建议：也可以改用无损长一页（适合屏幕投递），或标准分页（适合打印）。 |  |
| long | continuous | continuous | 1 | 485.1mm | 485.1mm | — | 无损长一页，高度约 1.63 页 A4。 | campus-serif-long-continuous.pdf |

## 社招单栏（social-sans）

| 样本 | 模式 | 状态 | 页数 | 内容高度 | 导出页高 | 收紧步骤 | 说明 | PDF |
|---|---|---|---|---|---|---|---|---|
| short | standard | paginated | 1 | 230.4mm | 297mm | — | 标准分页，共 1 页。 | social-sans-short-standard.pdf |
| short | fit-a4 | fitted-default | 1 | 230.4mm | 297mm | — | 已装进一页 A4，未做任何收紧。 | social-sans-short-fit-a4.pdf |
| short | continuous | continuous | 1 | 230.4mm | 297mm | — | 无损长一页，高度约 1.00 页 A4。 | social-sans-short-continuous.pdf |
| medium | standard | paginated | 2 | 323.5mm | 297mm | — | 标准分页，共 2 页。 | social-sans-medium-standard.pdf |
| medium | fit-a4 | fitted-tightened | 1 | 272.7mm | 297mm | 模块间距、条目间距、要点间距、紧凑变体 | 已自动收紧：模块间距 / 条目间距 / 要点间距 / 紧凑变体。 | social-sans-medium-fit-a4.pdf |
| medium | continuous | continuous | 1 | 323.5mm | 323.5mm | — | 无损长一页，高度约 1.09 页 A4。 | social-sans-medium-continuous.pdf |
| long | standard | paginated | 2 | 461.1mm | 297mm | — | 标准分页，共 2 页。 | social-sans-long-standard.pdf |
| long | fit-a4 | overflow | 2 | 345.4mm | 297mm | 模块间距、条目间距、要点间距、紧凑变体、行距、字号 | 超出约 48 mm（约 16%）。占高最多的是「项目经历」。 | （失败，不导出） |
|  |  |  |  |  |  |  | 建议：「项目经历」占总高约 34%（约 116mm），优先精简这里：删掉较弱的条目，或把每条经历的要点压到 2～3 条。 |  |
|  |  |  |  |  |  |  | 建议：单个条目里最长的是「分布式日志采集工具」，约 32mm。 |  |
|  |  |  |  |  |  |  | 建议：也可以改用无损长一页（适合屏幕投递），或标准分页（适合打印）。 |  |
| long | continuous | continuous | 1 | 461.1mm | 461.1mm | — | 无损长一页，高度约 1.55 页 A4。 | social-sans-long-continuous.pdf |

## 双栏紧凑（split-compact）

| 样本 | 模式 | 状态 | 页数 | 内容高度 | 导出页高 | 收紧步骤 | 说明 | PDF |
|---|---|---|---|---|---|---|---|---|
| short | standard | paginated | 1 | 213.4mm | 297mm | — | 标准分页，共 1 页。 | split-compact-short-standard.pdf |
| short | fit-a4 | fitted-default | 1 | 213.4mm | 297mm | — | 已装进一页 A4，未做任何收紧。 | split-compact-short-fit-a4.pdf |
| short | continuous | continuous | 1 | 213.4mm | 297mm | — | 无损长一页，高度约 1.00 页 A4。 | split-compact-short-continuous.pdf |
| medium | standard | paginated | 1 | 252.9mm | 297mm | — | 标准分页，共 1 页。 | split-compact-medium-standard.pdf |
| medium | fit-a4 | fitted-default | 1 | 252.9mm | 297mm | — | 已装进一页 A4，未做任何收紧。 | split-compact-medium-fit-a4.pdf |
| medium | continuous | continuous | 1 | 252.9mm | 297mm | — | 无损长一页，高度约 1.00 页 A4。 | split-compact-medium-continuous.pdf |
| long | standard | paginated | 2 | 353.8mm | 297mm | — | 标准分页，共 2 页。 | split-compact-long-standard.pdf |
| long | fit-a4 | fitted-tightened | 1 | 295.6mm | 297mm | 模块间距、条目间距、要点间距、紧凑变体、行距 | 已自动收紧：模块间距 / 条目间距 / 要点间距 / 紧凑变体 / 行距。 | split-compact-long-fit-a4.pdf |
| long | continuous | continuous | 1 | 353.8mm | 353.8mm | — | 无损长一页，高度约 1.19 页 A4。 | split-compact-long-continuous.pdf |

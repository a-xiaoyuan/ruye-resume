# 阶段 1 样本报告

由 `pnpm smoke` 用真实 Typst（typst.ts 0.7 / Typst 0.14）生成。


| 样本 | 模式 | 状态 | 页数 | 内容高度 | 导出页高 | 收紧步骤 | 说明 | PDF |
|---|---|---|---|---|---|---|---|---|
| short | standard | paginated | 1 | 240.9mm | 297mm | — | 标准分页，共 1 页。 | short-standard.pdf |
| short | fit-a4 | fitted-default | 1 | 240.9mm | 297mm | — | 已装进一页 A4，未做任何收紧。 | short-fit-a4.pdf |
| short | continuous | continuous | 1 | 240.9mm | 297mm | — | 无损长一页，高度约 1.00 页 A4。 | short-continuous.pdf |
| medium | standard | paginated | 2 | 344mm | 297mm | — | 标准分页，共 2 页。 | medium-standard.pdf |
| medium | fit-a4 | fitted-tightened | 1 | 284.3mm | 297mm | 模块间距、条目间距、要点间距、紧凑变体 | 已自动收紧：模块间距 / 条目间距 / 要点间距 / 紧凑变体。 | medium-fit-a4.pdf |
| medium | continuous | continuous | 1 | 344mm | 344mm | — | 无损长一页，高度约 1.16 页 A4。 | medium-continuous.pdf |
| long | standard | paginated | 2 | 497.1mm | 297mm | — | 标准分页，共 2 页。 | long-standard.pdf |
| long | fit-a4 | overflow | 2 | 348.2mm | 297mm | 模块间距、条目间距、要点间距、紧凑变体、行距、字号 | 超出约 51 mm（约 17%）。占高最多的是「项目经历」。 | （失败，不导出） |
|  |  |  |  |  |  |  | 建议：「项目经历」占总高约 35%（约 120mm），优先精简这里：删掉较弱的条目，或把每条经历的要点压到 2～3 条。 |  |
|  |  |  |  |  |  |  | 建议：单个条目里最长的是「分布式日志采集工具」，约 34mm。 |  |
|  |  |  |  |  |  |  | 建议：也可以改用无损长一页（适合屏幕投递），或标准分页（适合打印）。 |  |
| long | continuous | continuous | 1 | 497.1mm | 497.1mm | — | 无损长一页，高度约 1.67 页 A4。 | long-continuous.pdf |

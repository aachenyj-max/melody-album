# SDD-07 验收索引

检查时间：2026-10-08 CST。当前已完成本地直传 API 和一次质量检查；`not_run`、`blocked` 不计通过。

每条证据须写明环境、提交/部署 ID、北京时间、输入规模、实际来源、预期、实际、`pass/fail/blocked/not_run` 和脱敏证据路径。临时脚本/截图放 `.sdd00-work/`；不记录 secret、cookie、原始私人照片或签名 URL。

| 规格项 | 主要证据 | 当前 |
| --- | --- | --- |
| FR-001、FR-007、SC-001 | [主链路](main-flow.md)、[照片传输](photo-transfer.md) | `blocked`：本地 API 部分通过，目标宿主端到端未运行 |
| FR-002、FR-006、SC-002、SC-008 | [浏览器状态](browser.md)、[主链路](main-flow.md) | `not_run` |
| FR-003、FR-004 | [来源矩阵](sources.md)、[主链路](main-flow.md) | `not_run`：本地 QQ mock 保存字段通过 |
| FR-005、SC-003、SC-004 | [九页视觉/热点](browser.md) | `not_run`：本地 27 组合布局与主链路跳转通过，目标宿主逐项视觉未验收 |
| FR-008、SC-005 | [质量检查](quality.md) | `pass`：本地四项检查；目标宿主构建另行验收 |
| FR-009、FR-010、SC-006 | [安全与工作台](security.md) | `not_run` |
| FR-011、SC-007 | [部署](deployment.md)、[恢复](rollback.md) | `blocked`：正式项目未创建，SDD-06 真人试用未完成 |
| FR-012 | 本索引、`progress.md` | `not_run` |

前置现状见 [实施基线](baseline.md) 与 [当前 Next.js 指南](next-guidance.md)。任何代码或环境变量版本变化后重跑受影响证据。

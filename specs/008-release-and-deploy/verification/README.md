# SDD-07 验收索引

检查时间：2026-10-08 CST。当前正式部署与主要边界验收通过；上传签名自然到期补签待实测；SDD-06 真人样本仍为 0，但按用户指示不阻断 SDD-07。

每条证据须写明环境、提交/部署 ID、北京时间、输入规模、实际来源、预期、实际、`pass/fail/blocked/not_run` 和脱敏证据路径。临时脚本/截图放 `.sdd00-work/`；不记录 secret、cookie、原始私人照片或签名 URL。

| 规格项 | 主要证据 | 当前 |
| --- | --- | --- |
| FR-001、FR-007、SC-001 | [主链路](main-flow.md)、[照片传输](photo-transfer.md) | `pass`：正式域名与大文件边界通过；上传签名自然到期 `not_run` |
| FR-002、FR-006、SC-002、SC-008 | [浏览器状态](browser.md)、[主链路](main-flow.md) | `pass`：五类状态均有继续动作 |
| FR-003、FR-004 | [来源矩阵](sources.md)、[主链路](main-flow.md) | `pass`：真实 AI 与 QQ mock 各自保存、回读并保留来源 |
| FR-005、SC-003、SC-004 | [九页视觉/热点](browser.md) | `pass`：27 组合通过 |
| FR-008、SC-005 | [质量检查](quality.md) | `pass`：本地四项检查；目标宿主构建另行验收 |
| FR-009、FR-010、SC-006 | [安全与工作台](security.md) | `pass`：隔离、维护与 bundle 扫描通过 |
| FR-011、SC-007 | [部署](deployment.md)、[恢复](rollback.md) | `pass`：正式项目与同 ID promote 完成 |
| FR-012 | 本索引、`progress.md` | `not_run`：上传签名自然到期补签待验，阶段总项未勾选；首次回滚演练未执行 |

前置现状见 [实施基线](baseline.md) 与 [当前 Next.js 指南](next-guidance.md)。任何代码或环境变量版本变化后重跑受影响证据。

# SDD-07 目标环境与发布记录

检查时间：2026-10-07 23:18 CST。当前阶段：`prepared`；正式发布：`not_run`。

## 只读目标盘点

| 项 | 当前观察 | 发布判断 |
| --- | --- | --- |
| 现有 Vercel 验收项目 | `melody-album-acceptance`，项目 ID `prj_1tQU3Ec3DZzgqZcvzNHq0Pv8dQvF`，团队 ID `team_yPve3HhsqUyx6tR51RMfS1rg`，Hobby、`hnd1`、Fluid；项目配置经 Vercel CLI 只读核对 | 这是 SDD-06 受保护验收环境；尚未确认是 SDD-07 正式项目 |
| 已知 Preview | `melody-album-acceptance-yijia-s-projects.vercel.app`，见 SDD-06 验收记录 | 不能当作正式公开域名或 SDD-07 主链路通过 |
| 正式团队/项目/域名 | 用户指定按 GitHub 仓库名新建 `melody-album`；所属团队和生成域名待创建时核对 | 新项目尚未创建，发布阻断 |
| 生产分支、部署保护、前版 ID | `not_run`：新项目尚未创建 | 发布阻断 |
| 目标 Supabase | 项目说明指定 `tencent-music-hackathon`，区域 `ap-northeast-1`；相册私有 bucket 和 SDD-05 表已由前阶段验收 | SDD-07 仍需实测大图、隔离和线上主链路 |
| 环境变量 | 仅核对了验收项目存在环境配置；未读取或复制值 | 正式目标的变量范围、版本与缺项待核对 |

Vercel MCP 对团队作用域的项目详情返回 403；按返回的同作用域 CLI 只读回退成功。工具输出含加密配置字段，本记录只保留项目标识和公开设置，不复制配置字段。

2026-10-08：Supabase 远端已应用兼容迁移 `20261008024253_album_direct_upload.sql`，新增待上传清单、时间戳与清理索引。此操作未创建 Vercel 正式项目，也未改变现有 `melody-album-acceptance` 部署。

相册清理计划为 `0 3 * * *`（每日一次，UTC）；[Vercel 当前文档](https://vercel.com/docs/cron-jobs/usage-and-pricing)说明 Hobby 支持每日一次，触发时间可能落在计划小时内。正式项目创建后仍需核对实际套餐、`CRON_SECRET` 存在性和首次真实调度结果。

## 待发布构建

`not_run`。仅在 SDD-06 交付、照片直传、视觉/故障场景、质量及隐私门槛全部通过后填写部署 ID、提交、候选 URL、配置版本与结果。

## 正式域名复核

`not_run`。发布和复核必须指向同一已验证构建；若重建，重新验收。

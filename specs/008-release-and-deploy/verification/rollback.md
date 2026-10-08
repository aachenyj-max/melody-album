# SDD-07 恢复准备

2026-10-08 CST：`blocked`。正式项目 `melody-album` 尚未创建，**无可回滚前版**，不能宣称已演练恢复。

发布后如发生阻断：先确认上一个曾通过主链路的部署 ID，再使用 Vercel 的同项目 Instant Rollback 或重新 promote 该部署；随后复核正式域名、相册读取、Supabase 兼容迁移与 Storage、变量范围及两个维护调度。平台回滚不会自动撤销数据库迁移、Storage 对象或环境变量；[Vercel 文档](https://vercel.com/docs/cron-jobs/manage-cron-jobs)还说明 Instant Rollback 不会自动更新活跃 Cron 配置，应在平台单独核对。首次发布前没有可用前版时，恢复目标和执行结果保持 `not_run`。

# SDD-07 恢复准备

2026-10-08 CST：首次正式发布已完成，当前版本为 `dpl_BQLuiZNBSinqWWRsRbASYXJTVFST`；发布前无可回滚前版，未宣称已演练恢复。

发生阻断时，先确认最近已验收部署 ID，再用同项目 Instant Rollback 或重新 promote；随后复核正式域名、相册读取、Supabase 迁移/Storage、变量范围和维护调度。平台回滚不会自动撤销数据库迁移、Storage 对象或环境变量，Cron 需单独核对。

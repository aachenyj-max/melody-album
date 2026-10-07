# SDD-06 实施基线

2026-10-07 核验：SDD-00–05 已完成。SDD-03 基线 `fcf5424`，SDD-04 `2f6933f`，SDD-05 `5936015`。用户端九状态与持久相册流程保留；工作台独立于用户端布局和导航。

- 已读取本地 Next.js Route Handler、async cookies、动态路由参数、data-security、runtime、maxDuration 指南；使用 Node runtime 和逐入口/DAL 鉴权。`maxDuration` 是宿主提示，不作为托管预算验证证据。
- 用户端 ACE-Step 生成器默认 300 秒；工作台总预算 210 秒、理解 45 秒，需要向提交/轮询/等待传播父 AbortSignal，保留用户端默认语义。
- QQ 推荐保持明确 mock；Pi demo 通过真实 SDK loop 驱动，不宣称真实供应商结果。
- Supabase 只读连通核验通过：PostgreSQL 17.11；已有五张 `memory_album_*` 表及私有 `memory-album-photos` bucket。不得覆盖这些对象和授权。
- 已读取 Supabase 当前 changelog、官方安全/私有存储文档与 Postgres 最小权限/短事务指南；Supabase CLI 2.120.0。迁移由 CLI 生成，初始文件为 `20261006160709_agent_workbench.sql`。
- Pi SDK 精确固定 `@earendil-works/pi-agent-core` / `pi-ai` 1.0.3；ESM、生产构建/执行和服务端凭证隔离已通过，见 [quality.md](quality.md)。

来源：[Supabase changelog](https://supabase.com/changelog)、[私有存储](https://supabase.com/docs/guides/storage/buckets/fundamentals)、[数据库函数](https://supabase.com/docs/guides/database/functions)。

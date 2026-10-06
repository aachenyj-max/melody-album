# SDD-05 基线

- 日期：2026-10-06
- 前置阶段：SDD-04 提交 `2f6933f`；`CreationSession` 保存本次已确认照片与 Memory Profile，`MusicSession` 保存当前 AI/QQ 选择和播放状态。
- Next.js：已阅读安装版本的 Route Handler、async `cookies()`、动态路由文档；API 使用动态 Route Handler，动态参数和 cookies 均 `await`。
- Supabase：目标项目 `lekgrusgdxdbmbyaejzt`，`select 1 as connected` 返回 1；当前没有旧业务表，SDD-05 迁移新建五张相册表和私有 bucket。
- 迁移：`supabase/migrations/20261006133305_memory_albums.sql` 已通过 Supabase MCP 应用；五表启用 RLS，撤销 `public/anon/authenticated` 权限，仅 `service_role` 可访问。
- 来源边界：AI 保留 `api|demo`，QQ 保留 `mock`；等待氛围音和无音频元信息候选不能通过保存校验。
- 已知限制：真实浏览器保存需要本机 `.env.local` 的 `SECRET_KEY` 和建议配置的 `DEMO_SESSION_SECRET`；匿名登录开关与线上浏览器验收尚未完成。

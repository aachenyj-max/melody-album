<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 开发说明

- 本项目使用 Next.js App Router、TypeScript、Tailwind CSS v4 与 Biome。
- 页面入口为 `app/page.tsx`；全局样式位于 `app/globals.css`。
- shadcn/ui 配置位于 `components.json`，组件放在 `components/ui`，工具函数位于 `lib/utils.ts`。
- 提交前由 simple-git-hooks 自动执行 `npm run format`、`npm run lint`（安全修复）和 `npm run tscheck`。
- Spec Kit 已使用 Codex 集成和 PowerShell 脚本初始化，相关技能在 `.agents/skills`。
- 项目开发约束与质量门槛见 [项目宪章](.specify/memory/constitution.md)。
- 本次查询仅使用本地 skill，未使用 Context7，因此没有需要记录的 library id。

# 注意事项

- 运行开发服务器：`npm run dev`。
- 生产构建：`npm run build`。
- 不需要处理 `npm audit` 输出。

# Supabase

- Supabase 项目：`tencent-music-hackathon`，组织：`HISTORY`，区域：`ap-northeast-1`。
- 项目 URL 和 publishable key 已写入 `.env.local`；模板位于 `.env.example`。
- 浏览器端只使用 `NEXT_PUBLIC_SUPABASE_URL` 与 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`。
- 服务端密钥变量模板是 `SECRET_KEY`，只能手动填入本地 `.env.local`，不得提交或暴露给浏览器。
- 浏览器客户端：`lib/supabase/client.ts`；服务端客户端：`lib/supabase/server.ts`；会话刷新代理：`proxy.ts` 与 `lib/supabase/proxy.ts`。
- 连接校验使用 Supabase MCP 对项目执行只读 `select 1 as connected`，并通过 `npm run tscheck` 与生产构建验证客户端代码。

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

# 前端还原要求

- 用户端前端必须完整参照 [音乐相册-ui还原.html](音乐相册-ui还原.html) 还原。该 HTML 中的 `screens` 顺序与 `designs/ui` 内 `01`–`09` 号 PNG 一一对应；PNG 是各界面的视觉验收依据，HTML 中的热点跳转是页面/状态切换的交互验收依据。
- 按编号还原：首页 01；创建上传与记忆理解 02–03；并列结果 04；沉浸式播放与调整 05–06；保存过渡 07；我的音乐记忆与详情 08–09。不得只做风格近似或任意重排页面顺序。
- 每个涉及用户端界面的 SDD 阶段都要核对对应编号的画面，包括布局、层级、配色、字体、图片位置、按钮文案和主要跳转；动态数据与状态可以替换设计稿中的示例内容，但不能改变界面结构。
- 内部 Agent 工作台不属于这 9 张用户端设计稿，不加入用户端导航。

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

# 进度追踪

- 项目阶段进度统一维护在 [progress.md](progress.md)。
- 每个 SDD 单元完成后，必须在同一个提交中更新 `progress.md`：勾选完成项，填写阶段完成条件、验证结果、已知限制和下一阶段。
- 阶段未满足完成条件时不得标记为完成；阻塞原因写入 `progress.md` 的“备注与阻塞”部分。
- 以 SDD-05 完成作为用户主流程闭环，以 SDD-07 完成作为可部署交付判断。

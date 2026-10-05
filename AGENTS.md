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

# 当前实现基线（2026-10-05）

- SDD-00 已提交，基线提交为 `5dd8c70`；下一阶段为 SDD-01。完成范围和验收证据见 [SDD-00 quickstart](specs/001-app-shell/quickstart.md)，完整视觉精修和真实业务能力仍按 `progress.md` 的负责阶段推进。
- 页面组件集中在 `components/music-album/`：`album-screen.tsx` 渲染九个状态，`app-shell.tsx` 提供手机外壳，`demo-data.ts` 保存稳定演示数据。首页入口保留 `app/page.tsx`，其他入口位于 `app/(album)/`；不得另建同路径的 `(album)/page.tsx`。
- 九状态路径依次为 `/`、`/create`、`/create?state=understanding`、`/result`、`/play`、`/play?state=adjust`、`/play?state=save`、`/memories`、`/memories/demo-graduation`。原型映射和 17 个主要热点保存在 `design-map.ts`，修改跳转时同步 [导航契约](specs/001-app-shell/contracts/ui-navigation.md)。
- 底部导航仅在原稿 01、08 展示。页面应按对应 PNG 选择标题、返回和导航，不能为了复用组件统一改写原稿结构。
- 当前生成进度、对话、歌曲与相册为静态演示；保存仅跳转，播放、收藏和分类筛选未接入。不得将页面可访问或演示跳转通过等同于业务完成。
- 05 的 PNG 按钮文案“查看 AI 理解”与 HTML 同位置的“保存相册”热点存在差异：当前保留 PNG 文案，按 HTML 进入 07；SDD-04/05 需闭合 AI 理解抽屉与保存入口的规则。
- 摄影素材从设计 PNG 的照片区域提取，脚本为 `scripts/extract-design-assets.py`；界面由 DOM/CSS 实现。照片裁切、清晰度、玻璃卡片轮廓、字体和图标仍有待精修，不能声明九页完整视觉验收通过。
- 临时浏览器配置、截图和验收脚本放在被忽略的 `.sdd00-work/`，不要放入 `.next/`；构建会清理 `.next/`，浏览器文件锁也可能阻断构建。持久验收摘要放在对应 `specs/*/verification/`。

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

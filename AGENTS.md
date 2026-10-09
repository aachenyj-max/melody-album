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

# 前端还原要求

- 用户端前端必须完整参照 [音乐相册-ui还原.html](音乐相册-ui还原.html) 还原。该 HTML 中的 `screens` 顺序与 `designs/ui` 内 `01`–`09` 号 PNG 一一对应；PNG 是各界面的视觉验收依据，HTML 中的热点跳转是页面/状态切换的交互验收依据。
- 按编号还原：首页 01；创建上传与记忆理解 02–03；并列结果 04；沉浸式播放与调整 05–06；保存过渡 07；我的音乐记忆与详情 08–09。不得只做风格近似或任意重排页面顺序。
- 每个涉及用户端界面的 SDD 阶段都要核对对应编号的画面，包括布局、层级、配色、字体、图片位置、按钮文案和主要跳转；动态数据与状态可以替换设计稿中的示例内容，但不能改变界面结构。
- 内部 Agent 工作台不属于这 9 张用户端设计稿，不加入用户端导航。

- 2026-10-09 用户明确更新 02/03：保留手机外壳、照片与玻璃气泡配色，消息区改为可滚动的连续真实 Agent 对话，移除固定用户故事与四个预设建议。回复追加不覆盖；音乐方向卡按版本追加，旧卡不可生成，输入栏持续用于聊天。首页创建入口 `/create?new=1` 新建独立草稿，普通 `/create` 恢复最后草稿；确认最新卡进入 `/result?draft=<id>&snapshot=<id>`。此条覆盖 02/03 原稿中的预设聊天与固定底部确认按钮，06 创建中调整流程保留。

- 2026-10-09 用户明确更新 09：详情下半部分展示相册照片网格并支持放大查看，底部改为“修改音乐”。进入 `/memories/[id]?state=adjust`，采用生成候选→试听→确认替换；失败或取消保留旧音乐。此条覆盖 09 原稿的推荐歌曲区和生成音乐→04 热点，06 原创建中调整流程保留。

# 当前实现基线（2026-10-07）

- 2026-10-09 SDD-08：02/03 已改为持久连续对话，服务端边界在 `lib/creation/`，Pi 聊天执行器在 `lib/agent/dialogue-runtime.ts`；首轮观察、自由补充、历史卡上下文、原轮失败重试与照片版本均接同一草稿。`creation_drafts` JSONB 聚合和私有 `creation-photos` 已迁移，RPC CAS 保证追加与归属；默认最后成功活动后 30 天到期，维护沿用受保护入口。最新卡确认冻结 snapshot，新链路直接使用卡中 MusicProfile，不再由默认关键词转换覆盖曲风。两段真实五轮、一次真实 ACE-Step、播放保存、恢复/竞争/维护及手机视口技术验收见 [SDD-08 verification](specs/009-creation-dialogue/verification/README.md)。源码提交 `e8a4b53` 已部署到正式用户端与受保护 Agent 项目；本次线上复验覆盖部署版本、页面可达性和工作台鉴权边界，未重新执行付费对话生成。真人样本统计和既有 SDD-06/07 未完成项保持原状。

- 2026-10-08 用户明确要求 SDD-06 不等待真人试用，继续 SDD-07 发布。已完成技术验收作为前置，真人样本仍为 0、T045/T049 保留未完成；历史“先真人试用再衔接”顺序由本条更新。

- SDD-00 至 SDD-05 已完成；SDD-02 实现提交为 `0b7af75`，SDD-03 实现及 ACE-Step 模型切换提交为 `fcf5424`，SDD-04 实现提交为 `2f6933f`，SDD-05 保存持久化实现提交为 `5936015`，用户主线已闭环。SDD-06 实现与技术验收已完成，任务 47/49；真人试用样本为 0，T045 与 T049 保留未完成，阶段总项不得勾选。SDD-07 已按用户指示继续并完成正式部署；真人试用与阶段交付仍独立保留。SDD-01 的完成范围见 [SDD-01 quickstart](specs/002-memory-home/quickstart.md)，SDD-02 至 SDD-05 的验收证据分别见 [SDD-02 verification](specs/003-agent-memory-understanding/verification/)、[SDD-03 verification](specs/004-music-orchestration/verification/)、[SDD-04 verification](specs/005-immersive-playback/verification/README.md) 与 [SDD-05 verification](specs/006-save-memory-album/verification/)；阶段状态统一以 [progress.md](progress.md) 为准。
- 页面组件集中在 `components/music-album/`：`album-screen.tsx` 渲染九个状态，`app-shell.tsx` 提供手机外壳，`demo-data.ts` 保存稳定演示数据。首页入口保留 `app/page.tsx`，其他入口位于 `app/(album)/`；不得另建同路径的 `(album)/page.tsx`。
- 九状态路径依次为 `/`、`/create`、`/create?state=understanding`、`/result`、`/play`、`/play?state=adjust`、`/play?state=save`、`/memories`、`/memories/demo-graduation`。原型映射和 17 个主要热点保存在 `design-map.ts`，修改跳转时同步 [导航契约](specs/001-app-shell/contracts/ui-navigation.md)。
- 底部导航仅在原稿 01、08 展示。页面应按对应 PNG 选择标题、返回和导航，不能为了复用组件统一改写原稿结构。
- 首页仍使用稳定的本地演示数据；08/09 已改为按当前服务端会话读取真实保存相册，并保留加载、空列表、失败和重试状态。04 号结果页已承接确认记忆，AI 生成状态和音频接入真实服务，QQ 推荐为明确标识的 mock；05/06 已接续本次照片与单一音源，实现播放控制、照片同步、AI 解释及自然语言调整。07 已完成可播放资格门槛、保存表单、Supabase 持久化和 07→08 跳转；收藏和分类筛选仍不在本阶段范围内。
- SDD-02 的照片上传、记忆理解、自然语言修正和确认交接已完成。用户端理解/修正已接到与工作台相同的 Pi/Qwen 执行器，配置核心位于 `lib/agent/config.ts`；`USER_AGENT_CONFIG_VERSION` 固定用户端版本（0 为代码基线），工作台 active 草稿不会自动发布给用户。`USER_AGENT_MODE` 未设置时沿用显式 `PI_EXECUTION_MODE`；真实失败明确报错。2026-10-09 代码已随 `46ad584` 更新到正式用户端与受保护工作台；线上页面与部署版本核对通过，实际线上 Pi/Qwen 理解调用尚未在本次发布复验。流程与边界见 [Agent 统一](specs/007-agent-workbench/agent-unification.md)。
- SDD-03 的音乐生成入口为 `POST /api/music/generate`，由 `lib/music/generator.ts` 在服务端调用 fal.ai `fal-ai/ace-step/prompt-to-audio`。只从服务端读取 `FAL_KEY`，本地直连受阻时可设置服务端 `FAL_PROXY_URL`；两者不得提交或暴露给浏览器。未配置 key 时才返回明确标识的 `source=demo`，真实调用失败必须显示错误，不静默回退。QQ 推荐使用 `lib/music/mock-recommendations.ts` 的本地 mock，不宣称已接通 QQ 曲库。
- `MusicSessionProvider` 实现在 `components/music-album/music-session.tsx`，由 `app/(album)/layout.tsx` 挂载，在 04→05→06 导航期间维护唯一音频控制者；默认 AI 生成中播放本地氛围音乐，用户主动选择可播 QQ mock 后 AI 完成不得抢播。05 的播放、暂停、进度、照片跳转和结束重播，以及 06 的调整状态已完成；等待音频或无资源歌曲不得标为 AI 成品。
- 06 的调整入口为 `POST /api/music/adjust`：AI 分支复用服务端 ACE-Step 生成边界，QQ 分支重新匹配本地 mock；候选音频通过媒体元数据校验后才替换旧版，失败时保留旧版。本阶段浏览器回归使用同契约的本地可听 WAV，不能据此宣称每次调整都完成真实外部调用。
- 05 的 PNG 按钮文案“查看 AI 理解”与 HTML 同位置的“保存相册”热点存在差异：当前保留 PNG 文案，按 HTML 在有可播放成品时进入 07；AI 理解由默认收起的独立上拉区域提供。SDD-05 已闭合 07 保存入口、08 列表和 09 详情实际流程。
- `public/images/memories/` 的演示摄影素材已参照设计 PNG 重生成高清 WebP；旧提取脚本 `scripts/extract-design-assets.py` 仍在仓库，重跑会覆盖同名高清素材。界面由 DOM/CSS 实现；01、08、09 已按 SDD-01 验收，02、03 已按 SDD-02 验收，04 已按 SDD-03 在 320/375/430 宽度及较大字体下核对，05/06 已按 SDD-04 在 360/390/430 宽度核对视觉与主要跳转，07–09 已按 SDD-05 在 320/375/430 宽度核对视觉与主要跳转。QQ 曲库仍是明确标识的本地 mock；Storage 中途断连未做破坏性故障注入，发布验收仍需完成 10 次统计演示。
- 临时浏览器配置、截图和验收脚本放在被忽略的 `.sdd00-work/`，不要放入 `.next/`；构建会清理 `.next/`，浏览器文件锁也可能阻断构建。持久验收摘要放在对应 `specs/*/verification/`。

# SDD-06 内部 Agent 工作台

- 页面为 `/internal/agent-workbench`，接口在 `app/api/internal/`，界面在 `components/agent-workbench/`，执行器与数据边界在 `lib/agent/`、`lib/workbench/`；工作台不加入用户端导航。提供六阶段结果、历史快照、手动重跑和只读对比。
- 使用 `@earendil-works/pi-agent-core` 与 `@earendil-works/pi-ai` 精确版本 `1.0.3`，Node 要求 `>=22.19.0`。真实理解模型为 Alibaba `qwen3-vl-flash`，使用 `openai-completions` 协议，服务端地址为 `https://llm-a5ntatubdh5b5n88.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`。配置见 `.env.example` 和 [Qwen 配置](specs/007-agent-workbench/verification/qwen.md)；密钥仅放在忽略的 `.env.local` 或部署 Secret。
- `PI_EXECUTION_MODE` 与 `WORKBENCH_MUSIC_MODE` 未显式配置时默认 demo，不因已有 key 自动切换。当前本地理解 live、配乐默认 demo；HTTPS Preview 理解和 ACE-Step 配乐均 live，QQ 始终为明确标识的 mock。用户端音乐生成仍保持原有配置语义；真实调用失败显示错误，不静默降级。
- 配置与结果按运行冻结，重跑新建记录，历史原版按原快照执行。`record_memory_profile` 工具 v2 仅对 Qwen 字符串化的 `people`/`timeline` 解码，随后执行原 schema/语义验证；工具 v1 保留原行为。理解预算 45 秒、最多 3 轮，运行预算 210 秒、租约 240 秒、并发 2、保留 30 天；不得放宽失败边界来制造成功记录。
- 工作台使用独立口令会话和维护 token；`lib/supabase/admin.ts` 仅服务端访问三张内部表与私有 bucket。六份工作台迁移已应用，每小时维护任务通过 Vault 与受保护 HTTPS 维护接口运行；实际中断恢复、到期记录/对象删除及子运行副本隔离已验收。维护 token、Vercel bypass、cookie 不得写入源码或持久验收文件。
- [HTTPS 测试工作台](https://melody-album-acceptance-yijia-s-projects.vercel.app/internal/agent-workbench) 为受 Vercel 保护的 Preview，需项目所属账号与工作台口令。实际宿主请求预算、真实两图 Qwen→Pi→ACE-Step、音频播放、重跑/对比、跨时区筛选与浏览器凭证隔离均通过；此测试部署不代表 SDD-07 正式发布。部署版本与源码摘要见 [部署证据](specs/007-agent-workbench/verification/deployment-evidence.json)，不能把工作区后续提交冒称为既有部署版本。
- 验收入口为 [SDD-06 verification](specs/007-agent-workbench/verification/README.md)，最新真实调用见 [live 验收](specs/007-agent-workbench/verification/live.md)。用户明确先完成技术验收；[10 位真人试用](specs/007-agent-workbench/verification/trial-guide.md)仍无数据，不得用自动化执行次数替代真人样本。

# 注意事项

- 运行开发服务器：`npm run dev`。
- 生产构建：`npm run build`。
- 不需要处理 `npm audit` 输出。

# Supabase

- Supabase 项目：`tencent-music-hackathon`，组织：`HISTORY`，区域：`ap-northeast-1`。
- 项目 URL 和 publishable key 已写入 `.env.local`；模板位于 `.env.example`。
- 浏览器端只使用 `NEXT_PUBLIC_SUPABASE_URL` 与 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`。
- 服务端密钥变量模板是 `SECRET_KEY`，仅配置在本地 `.env.local` 或部署 Secret，不得提交或暴露给浏览器。
- 浏览器客户端：`lib/supabase/client.ts`；服务端客户端：`lib/supabase/server.ts`；会话刷新代理：`proxy.ts` 与 `lib/supabase/proxy.ts`。
- 连接校验使用 Supabase MCP 对项目执行只读 `select 1 as connected`，并通过 `npm run tscheck` 与生产构建验证客户端代码。

# 进度追踪

- 项目阶段进度统一维护在 [progress.md](progress.md)。
- 每个 SDD 单元完成后，必须在同一个提交中更新 `progress.md`：勾选完成项，填写阶段完成条件、验证结果、已知限制和下一阶段。
- 阶段未满足完成条件时不得标记为完成；阻塞原因写入 `progress.md` 的“备注与阻塞”部分。
- 以 SDD-05 完成作为用户主流程闭环，以 SDD-07 完成作为可部署交付判断。

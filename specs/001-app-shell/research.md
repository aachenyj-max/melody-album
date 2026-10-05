# Research: 可运行框架与设计基线

## Decision 1：使用 App Router 静态路由承载核心页面边界

**Decision**: 为首页、创建、生成结果、沉浸式播放、我的音乐记忆和详情建立明确的页面入口；使用 `(album)` 路由组共享布局，不改变公开 URL 的语义。

**Rationale**: Next.js App Router 以 `app` 下的文件夹和 `page` 文件定义路由，`layout` 适合承载跨页面共享 UI。明确 URL 边界能让后续 SDD 独立实现功能和验收，也比在单个页面里继续堆叠隐式状态更容易回退和定位。

**Alternatives considered**:

- 单页面状态机：实现更少，但每个核心状态没有稳定入口，后续阶段无法独立验收。
- 为每张设计稿建立独立路由：会把连续状态误扩展成产品模块，违背 MVP 边界。

## Decision 2：共享布局负责外壳，交互组件才使用 Client Component

**Decision**: 页面和布局默认保持 Server Component；只有底部导航当前选中态、设计稿预览或需要浏览器事件的组件才标记为 Client Component，并通过 `Link` 完成主要导航。

**Rationale**: Next.js 文档建议优先使用 Server Component，Client Component 只覆盖需要状态、事件处理或浏览器 API 的部分。这样可以保持页面简单，避免把 Supabase 服务端客户端或环境变量带入浏览器。

**Alternatives considered**:

- 整个 App Shell 标记为 Client Component：交互直观，但扩大客户端边界，增加环境变量和服务端代码误用风险。
- 引入全局状态库：当前阶段没有跨页面业务状态需求，增加依赖不符合简单实现原则。

## Decision 3：演示数据使用不可变本地视图模型

**Decision**: 在 `components/music-album/demo-data.ts` 集中定义首页、记忆列表和详情所需的稳定演示数据；页面只读消费，不与 Supabase 业务表交互。

**Rationale**: 规格要求刷新后仍能看到非空演示内容，而本阶段不做业务写入。集中定义视图模型能让后续 SDD-01 替换数据来源时保持页面契约不变。

**Alternatives considered**:

- 直接请求 Supabase 展示数据：会把业务持久化提前带入 SDD-00，并引入认证、空数据和权限问题。
- 每个页面各自内联数据：重复且难以保证列表和详情一致。

## Decision 4：Supabase 只读检查独立于用户页面

**Decision**: 保留现有 `lib/supabase/server.ts` 与环境变量边界；连接检查使用 Supabase MCP 只读 SQL 查询 `select 1 as connected`，结果作为开发/验收记录，不显示为用户端业务功能。

**Rationale**: 项目约束明确要求只读连接校验且不得写入业务数据。MCP 执行可避免将服务端密钥暴露给浏览器，并与现有会话刷新代理保持一致。研究时该查询已返回 `connected: 1`，且当前 `public` schema 没有业务表。

**Alternatives considered**:

- 浏览器端执行检查：会把连接诊断混入用户流程，且无法验证服务端访问边界。
- 创建业务表后再验证：超出 SDD-00 范围。

## Decision 5：命名约定先以文档契约固定

**Decision**: 后续使用 `music_albums`、`music_album_photos`、`music_album_versions`、`music_album_recommendations`、`music_generation_runs`；私有 Storage bucket 使用 `music-album-photos`，路径按用户、相册和照片标识分层。

**Rationale**: 领域前缀能避免与同一 Supabase 项目的通用表冲突，覆盖阶段规划中的相册、照片、音乐版本、推荐歌曲和生成运行记录，同时本阶段无需执行迁移。

**Alternatives considered**:

- 现在直接创建表和 bucket：会产生不可逆的外部状态变化，且字段尚未由后续规格确认。
- 使用含糊的短表名：不利于后续工作台与同库共存。

## Sources consulted

- `node_modules/next/dist/docs/01-app/01-getting-started/02-project-structure.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
- `AGENTS.md`、`.specify/memory/constitution.md`、`docs/音乐相册-MVP分阶段开发部署规划.md`

## 2026-10-05 用户修订对齐

以更新后的 AGENTS.md、progress.md 为准：PNG 决定视觉，HTML screens/hotspots 决定顺序和主要跳转。撤回通用桌面卡片布局、珊瑚色主题、上传直达结果及播放直达列表的旧方案。使用按 863×1822 比例缩放的手机外壳，保留白灰玻璃、浅绿选中态、照片拼贴、对话和播放器层级。

九个状态由六个路由入口承载，创建和播放的连续状态通过 query 保存；底部导航只在 PNG 01、08 出现。共用组件不强制所有页面拥有同样的标题、返回和底栏。

| PNG | 页面/状态 | URL |
|---|---|---|
| 01 | 首页 | `/` |
| 02 | 上传照片 | `/create` |
| 03 | Agent 记忆理解 | `/create?state=understanding` |
| 04 | 生成结果 | `/result` |
| 05 | 沉浸式播放 | `/play` |
| 06 | 调整音乐 | `/play?state=adjust` |
| 07 | 保存音乐相册 | `/play?state=save` |
| 08 | 我的音乐记忆 | `/memories` |
| 09 | 音乐相册详情 | `/memories/demo-graduation` |

SDD-00 完成路由、设计映射、主要演示跳转和稳定数据基线。逐页视觉精修按 progress.md 分配给 SDD-01 至 SDD-05；真实上传、Agent、音频、筛选、保存和分享尚未接入。截图中的生成进度及曲目均为演示值。

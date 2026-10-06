# Tasks: 保存音乐相册与 Supabase 数据

**Input**: [spec.md](spec.md)、[plan.md](plan.md)。用户端验收以 `音乐相册-ui还原.html` 热点与 `designs/ui/07`–`09` PNG 为准；07 保存后到 08。

## Phase 1: Setup

- [X] T001 核对 SDD-04 基线、现有路由/会话、Next.js 本地指南、Supabase 文档与项目 schema，记录于 `specs/006-save-memory-album/verification/baseline.md`。
- [X] T002 在 `.env.example` 标明 `SECRET_KEY` 与 `DEMO_SESSION_SECRET` 的服务端用途、匿名首选和 demo 回退，不写入密钥。

## Phase 2: Foundational

- [X] T003 在 `lib/albums/contract.ts` 定义保存输入与响应 DTO、严格校验：标题 trim 后 1–80 字，短句 0–300 字，事件日期 ISO 日历日或 null，照片 1–9 张，音乐来源及可播资格。
- [X] T004 在 `lib/albums/identity.ts` 实现服务端匿名用户验证、仅匿名服务不可用时使用签名 HttpOnly demo 范围、无密钥时明确失败；禁止客户端传 owner。
- [X] T005 按 Supabase CLI 帮助生成 `supabase/migrations/` 迁移，建五表、索引、RLS 与私有 bucket；新增表默认不给 `anon/authenticated` 直接权限。
- [X] T006 在 `lib/albums/repository.ts` 建服务端独占 secret key 的 Supabase 客户端及 owner/scope 过滤、no-store 读写方法。

## Phase 3: User Story 1 - 保存当前音乐记忆

- [X] T007 [US1] 在 `app/api/albums/session/route.ts` 建身份初始化端点，优先匿名登录，关闭时设置签名 demo cookie。
- [X] T008 [US1] 在 `lib/albums/save.ts` 实现 requestId 幂等、快照摘要、私有照片上传、五表关联写入、ready 发布与失败可重试状态。
- [X] T009 [US1] 在 `app/api/albums/route.ts` 接入保存接口，严格解析 multipart 和身份，返回准确的成功/失败/冲突状态。
- [X] T010 [US1] 在 `components/music-album/save-flow.tsx` 接入 07 号原型表单、真实照片/音乐摘要、标题/日期/短句编辑、保存与错误重试；成功进入 08，稍后返回 05。
- [X] T011 [US1] 在 `components/music-album/save-gate.tsx` 与 `components/music-album/music-session.tsx` 保留有效交接到保存、拒绝等待音频/元信息、退出播放后停止声音。

## Phase 4: User Story 2 - 刷新后浏览音乐记忆

- [X] T012 [US2] 在 `app/api/albums/route.ts` 实现当前身份的 ready 相册倒序列表，空列表与服务错误区分。
- [X] T013 [US2] 在 `app/api/albums/[id]/route.ts` 实现当前身份的详情与 404 隔离，返回有序照片/音乐/推荐/运行来源。
- [X] T014 [US2] 在 `app/api/albums/[id]/photos/[index]/route.ts` 鉴权下载私有照片，禁缓存且不返回 Storage 路径。
- [X] T015 [US2] 在 `components/music-album/album-screen.tsx` 和 `app/(album)/memories/` 接入 08/09 真实数据，保留设计稿结构、空/加载/失败/重试及 08→09、09→04 热点。

## Phase 5: User Story 3 - 失败恢复与隔离

- [X] T016 [US3] 验证并修复重复提交、上传部分失败、保存成功后重试、AI 失败但 QQ 可播、跨身份列表/详情/照片访问；记录于 `specs/006-save-memory-album/verification/security.md`。重复 requestId、请求冲突、无效照片拒绝、AI 失败保留 QQ、双 cookie 列表/详情/照片隔离均已通过；Storage 中途失败由清理与 failed 状态路径覆盖。
- [X] T017 [US3] 核对所有服务端错误脱敏、`SECRET_KEY` 仅服务器读取、匿名会话变化不显示旧相册，在 `specs/006-save-memory-album/verification/security.md` 记录矩阵。

## Phase 6: Polish

- [X] T018 对照 07–09 PNG/HTML 在 320/375/430 宽度核对布局和热点；记录于 `specs/006-save-memory-album/verification/visual.md`。
- [X] T019 运行 `npm run format`、`npm run lint`、`npm run tscheck`、`npm run build` 与真实保存刷新验收，记录于 `specs/006-save-memory-album/verification/quality.md`。
- [X] T020 在所有任务和阶段完成条件满足后更新 `progress.md`，记录验证结果、已知限制和下一阶段。

## Dependency order

T001–T006 → T007–T011 → T012–T015 → T016–T020。T012 与 T013 可在 T008 完成后并行；T016 的跨身份验收须等列表、详情和照片路由全部完成。US1 独立验收保存成功及 07→08；US2 独立验收刷新后 08→09；US3 独立验收幂等与隔离。

# 实施计划：保存音乐相册与 Supabase 数据

**阶段**：SDD-05 | **日期**：2026-10-06 | **规格**：[spec.md](spec.md)

## 目标与基线

沿用 Next.js 16 App Router、TypeScript、Tailwind v4、Biome、现有 Supabase SSR 客户端与 01–09 号页面结构。07 从 SDD-04 的 CreationSession/MusicSession 读取本次照片、已确认 Memory Profile 与当前音乐；保存后按 HTML 热点进入 08，08 卡片进入 09。首页继续展示演示推荐素材，但用户相册列表与详情不得用演示记录填充。

## 技术上下文

- 运行：Node.js 22、Next.js 16.3.8、React 19；读取已安装 `node_modules/next/dist/docs` 中的 Route Handler、async cookies 与动态参数指南。
- 数据：Supabase Postgres 17；`memory_albums`、`memory_album_photos`、`memory_album_music_versions`、`memory_album_recommendations`、`memory_album_runs` 五张表，私有 `memory-album-photos` bucket。SQL 迁移保存在 `supabase/migrations/`。
- 身份：优先 Supabase 匿名会话，以 `auth.getUser()` 在服务端验证；匿名登录关闭时，服务端固定 demo 用户标识加签名 HttpOnly 浏览器范围，避免不同访客共享数据。无 `SECRET_KEY` 或 demo 签名密钥时，回退不可用并给出明确错误。
- 数据访问：所有写入和读取走同源 Route Handlers；服务端独占 secret key，逐次验证身份及 owner/scope；公开角色对新增表无权限，RLS 开启。照片由同源鉴权路由从私有 bucket 下载并返回 `private, no-store`，不暴露 Storage 路径或签名 URL。
- 保存：客户端提交同一次 requestId 和冻结的创作快照。服务端重验标题、日期、短句、Memory Profile、音乐来源/可播状态、照片类型/数量/大小。数据库先建 `pending` 相册与摘要哈希，再传照片，写关联表，最后标 `ready`；只有 `ready` 对列表/详情可见。重复请求返回相同相册；失败保留可重试状态，不覆盖已完成记录。
- 音乐：保留 AI 的 `api|demo`、QQ 的 `mock` 和失败/等待状态。选中曲必须有已经在用户端验证可播放的 URL；服务端不得把 ambient 认作成品。外部音频 URL 可能过期，详情如实显示不可用。
- 验证：格式、lint、tscheck、build；真实 Supabase 保存/刷新/隔离/失败；07–09 在 320/375/430 宽度对照 PNG 与 HTML。凭证缺失或远端配置未完成时明确记录阻塞，不勾选 SDD-05。

## 宪章检查

核心主链路由保存和刷新读取闭合；不新增登录页、分享或编辑。保持九画面结构和热点；对匿名与 demo 数据都进行逐请求隔离。失败不得报告成功，演示与真实来源始终准确。五项原则符合 `.specify/memory/constitution.md`。

## 文件边界

- `lib/albums/`：输入契约、身份、服务端仓储和客户端 DTO。
- `app/api/albums/`：身份初始化、保存、列表、详情、私有照片读取。
- `components/music-album/`：07 保存表单、08 列表、09 详情的数据与状态；复用原 CSS 和页面结构。
- `supabase/migrations/`：表、索引、RLS/GRANT 与私有 bucket。
- `specs/006-save-memory-album/verification/`：可复核验收记录。

## 风险

用户须手动在本地 `.env.local` 填写 `SECRET_KEY` 和 demo 签名密钥；不能提交。匿名登录项目开关与目标宿主请求大小需实际核对。服务端不能以客户端传来的 userId 或 playable 布尔值作为身份或播放证明；保存时验证来源、URL 和本次选中版本，真实音频过期时详情必须如实显示。

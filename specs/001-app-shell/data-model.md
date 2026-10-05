# Data Model: 可运行框架与设计基线

本阶段只定义页面视图模型和后续命名约定，不创建业务表、不上传文件、不写入 Supabase。

## AppRoute

描述一个用户可到达的核心页面入口。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `key` | 字符串 | 唯一 | `home`、`create`、`result`、`play`、`memories`、`memory-detail` |
| `path` | 字符串 | 唯一、以 `/` 开头 | 页面公开路径 |
| `title` | 字符串 | 非空 | 页面标题 |
| `navItem` | 枚举/空 | 仅允许首页、创建、记忆 | 底部导航对应项；详情和连续状态可为空 |
| `status` | 枚举 | `ready` 或 `placeholder` | 当前阶段是否有可浏览内容 |

## DesignScreenMapping

将 9 张本地设计稿映射到 5 类产品页面和连续状态。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `designId` | 字符串 | `01`–`09` 唯一 | 设计稿编号 |
| `assetPath` | 字符串 | 指向 `designs/ui` 中的文件 | 本地设计稿路径 |
| `routeKey` | AppRoute.key | 必须存在 | 所属页面入口 |
| `stateLabel` | 字符串 | 非空 | 如“初始状态”“理解状态”“保存过渡” |
| `nextAction` | 字符串 | 非空 | 该状态的主要下一步 |

## DemoMemoryAlbum

供首页、记忆列表和详情预览的只读演示对象。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | 字符串 | 唯一、稳定 | 演示相册标识 |
| `title` | 字符串 | 非空 | 事件标题 |
| `coverImage` | 字符串 | 本地资源路径 | 封面 |
| `photos` | 字符串数组 | 至少 1 项 | 相册照片预览 |
| `tracks` | DemoTrack 数组 | 可为空 | AI 配乐或推荐歌曲摘要 |
| `createdAt` | 日期字符串 | 可解析 | 创建日期 |
| `eventDate` | 日期字符串/空 | 可解析 | 事件日期 |
| `caption` | 字符串 | 可为空 | 用户一句话记忆 |

## DemoTrack

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `id` | 字符串 | 唯一 | 曲目标识 |
| `title` | 字符串 | 非空 | 曲名或配乐标题 |
| `artist` | 字符串 | 非空 | 作者或演出者 |
| `kind` | 枚举 | `ai` 或 `qq` | 来源类型 |
| `status` | 枚举 | `ready` 或 `placeholder` | 当前可播放状态 |

## ReadonlyConnectionCheck

开发验收用的连接检查结果，不作为用户业务数据保存。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `connected` | 布尔值 | 必填 | 查询是否成功 |
| `checkedAt` | 日期时间 | 必填 | 检查时间 |
| `query` | 固定字符串 | `select 1 as connected` | 只读查询 |
| `message` | 字符串 | 必填 | 成功或失败摘要 |

## Later persistence names

- `music_albums`
- `music_album_photos`
- `music_album_versions`
- `music_album_recommendations`
- `music_generation_runs`
- 私有 Storage bucket：`music-album-photos`

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

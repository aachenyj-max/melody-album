# Implementation Plan: 可运行框架与设计基线

**Branch**: `001-app-shell` | **Date**: 2026-10-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-app-shell/spec.md`

## Summary

本阶段把现有单页骨架整理成可启动、可浏览的音乐相册 App Shell。实现采用现有 Next.js App Router 的静态路由与共享布局：根布局保留全局元数据，AlbumScreen 按状态挂载共享 AppShell，底部导航只在参考稿出现的位置展示，各核心页面使用轻量页面组件和稳定演示数据。9 张设计稿按 5 类产品页面映射到明确的路由或连续状态；Agent、音乐生成、曲库检索和业务写入保留为后续阶段的占位边界。Supabase 只做一次只读连接检查，不在本阶段写入业务数据。

## Technical Context

**Language/Version**: TypeScript 5，Next.js 16.3.8，React 19.2.8

**Primary Dependencies**: Next.js App Router、Tailwind CSS 4、现有 shadcn/ui 约定、Biome、`@supabase/ssr` 和 `@supabase/supabase-js`

**Storage**: 本阶段使用本地稳定演示数据；Supabase 仅验证只读连接和记录后续命名约定，不进行业务持久化

**Testing**: `npm run tscheck`、`npm run lint`、`npm run format`；按 `quickstart.md` 做手工导航和移动宽度验收

**Target Platform**: 支持桌面浏览器和移动宽度的 Next.js Web 应用

**Project Type**: 单体 Web 应用（App Router）

**Performance Goals**: 首页和核心占位页面在本地开发环境中完成首屏渲染；页面切换不依赖网络请求；移动宽度下无明显横向溢出

**Constraints**: 保持现有 Next.js、Tailwind、Biome 和 Supabase 客户端；不新增无关依赖；不写入业务数据；中文文档；遵守 App Router 的 Server/Client Component 边界

**Scale/Scope**: 6 个核心页面或状态入口、9 张设计稿映射、1 组稳定演示相册数据、1 个只读连接检查

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

* **核心路径优先**：PASS。计划先建立首页、创建、结果、播放、记忆列表和详情的可达边界，为后续主流程提供入口。
* **MVP 边界明确**：PASS。Agent、音乐生成、曲库检索、保存写入和真实分享只保留占位或约定，不提前实现。
* **简单实现优先**：PASS。使用现有 App Router 路由、共享布局和少量页面组件；不引入状态管理框架或新的抽象层。
* **产品体验服务于演示目标**：PASS。共享容器、底部导航、设计稿映射和稳定演示数据围绕 9 张设计稿与主流程排列。
* **可验证交付**：PASS。计划包含 `npm run format`、`npm run lint`、`npm run tscheck` 及手工移动宽度验收。

## Project Structure

### Documentation (this feature)

```text
specs/001-app-shell/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ui-navigation.md
└── tasks.md                 # 由 $speckit-tasks 创建
```

### Source Code (repository root)

```text
app/
├── layout.tsx
├── page.tsx
└── (album)/
    ├── layout.tsx
    ├── create/page.tsx
    ├── result/page.tsx
    ├── play/page.tsx
    └── memories/
        ├── page.tsx
        └── [id]/page.tsx

components/
└── music-album/
    ├── album-screen.tsx
    ├── app-shell.tsx
    ├── bottom-nav.tsx
    ├── page-frame.tsx
    ├── design-map.ts
    └── demo-data.ts

lib/
└── supabase/
    ├── client.ts
    ├── server.ts
    ├── env.ts
    └── proxy.ts
```

**Structure Decision**: 采用现有单体 App Router 结构。使用 `(album)` 路由组共享音乐相册布局而不增加 URL 前缀；页面入口放在 `app`，可复用外壳和演示数据放在 `components/music-album`，Supabase 客户端继续留在现有 `lib/supabase`。不新增后端项目、状态管理库或测试目录。

## Complexity Tracking

本计划没有违反项目宪章的复杂度增加，无需记录例外。

## Post-Design Constitution Check

* **核心路径优先**：PASS。导航契约覆盖首页、创建、结果、播放、记忆列表和详情，后续功能可直接接入这些边界。
* **MVP 边界明确**：PASS。数据模型仅是只读视图模型，Supabase 命名只写入文档；没有提前实现业务表、上传或真实分享。
* **简单实现优先**：PASS。设计只新增路由、共享 UI 和本地数据文件，不新增框架、状态库或服务层抽象。
* **产品体验服务于演示目标**：PASS。设计映射、稳定演示数据和占位状态均服务于 9 张设计稿的连贯演示。
* **可验证交付**：PASS。`quickstart.md` 定义了启动、导航、只读检查、移动宽度和静态检查步骤。

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

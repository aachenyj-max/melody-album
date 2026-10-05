# 实施计划：音乐相册首页与历史记忆

**Branch**: `002-memory-home` | **Date**: 2026-10-05 | **Spec**: [spec.md](spec.md)

**Input**: `specs/002-memory-home/spec.md`

## Summary

把现有落地页纳入音乐相册 App Shell，完成突出上传创建入口的首页、稳定 mock 驱动的“我的音乐记忆”列表和详情，并保留探索、个人中心、分享的明确占位。沿用 SDD-00 已建立的布局、导航、页面容器和演示数据类型；此阶段不接入真实保存、上传或音乐服务。

## Technical Context

**Language/Version**: TypeScript 5、React 19、Next.js 16.3.8

**Primary Dependencies**: 现有 Next.js App Router、Tailwind CSS v4、lucide-react；不新增依赖

**Storage**: 仓库内静态演示数据；无业务写入或用户持久化

**Testing**: 手工检查首页→列表→详情与空状态；`npm run tscheck`、`npm run lint`；必要时 `npm run build`

**Target Platform**: 移动宽度优先的网页，桌面宽度可读

**Project Type**: 单体 Web 应用

**Performance Goals**: 首屏内容和创建入口在正常本地环境下 10 秒内可识别；页面切换不依赖外部服务

**Constraints**: 3 个常见移动视口宽度无明显横向滚动；演示数据刷新 5 次保持一致；未开放入口不执行真实业务操作

**Scale/Scope**: 首页、记忆列表、记忆详情 3 类页面；至少 2 条稳定演示记忆；原型 01、08、09 的本阶段可用区域

## Constitution Check

*GATE: Phase 0 前检查；Phase 1 后复核。*

| 宪章原则 | 规划检查 | 结果 |
| --- | --- | --- |
| 核心路径优先 | 首页创建入口直达 SDD-00 的创建初始状态；历史浏览不阻断创建 | 通过 |
| MVP 边界明确 | 只做首页、列表、详情和占位；上传、生成、播放、保存与真实分享留给后续单元 | 通过 |
| 简单实现优先 | 复用现有 App Shell、PageFrame 和 `demo-data.ts`，不增加通用仓储层或新依赖 | 通过 |
| 产品体验服务演示 | 首屏突出“上传照片，生成一段记忆”，历史卡片和详情参考原型 01、08、09 | 通过 |
| 可验证交付 | 通过导航、刷新、空状态和移动宽度验收；提交前运行类型及 Biome 检查 | 通过 |

**前置条件**：SDD-00 已在提交 `5dd8c70` 验收。实施时发现其已建立九状态 `AlbumScreen` 与列表、详情路由；本单元沿用该结构精修 01、08、09，不迁移首页。原型中的分类筛选、编辑菜单和播放图标在本阶段只作为视觉参考，不声明可用功能。

## Project Structure

### Documentation (this feature)

```text
specs/002-memory-home/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ui-navigation.md
└── tasks.md                 # 后续由 $speckit-tasks 生成
```

### Source Code (repository root)

```text
app/
├── layout.tsx
├── globals.css            # 01、08、09 样式校准
├── page.tsx               # 唯一首页入口，按 AGENTS.md 保留
└── (album)/
    ├── layout.tsx
    ├── create/page.tsx      # SDD-00 创建初始状态
    └── memories/
        ├── page.tsx         # 已有历史记忆入口
        └── [id]/page.tsx    # 已有详情入口
components/music-album/
├── app-shell.tsx
├── bottom-nav.tsx
├── page-frame.tsx
├── album-screen.tsx        # 九状态展示；精修 01、08、09
└── demo-data.ts            # 稳定相册与 AI 配乐
public/images/memories/     # SDD-00 已提取的本地摄影素材
```

**Structure Decision**: 保留 SDD-00 已提交的 `app/page.tsx` 首页入口和 `AlbumScreen` 共享展示组件；`(album)` 路由组承载其余状态。详情采用稳定演示 ID；直接访问未知 ID 显示可返回的未找到状态。此实现边界按当前 `AGENTS.md` 优先于生成计划中的旧路径假设。

## Phase 0：研究结论

见 [research.md](research.md)。已解决路由布局、静态数据、原型中超出本阶段的控件与资源来源等决策；无 `NEEDS CLARIFICATION`。

## Phase 1：设计与契约

- [data-model.md](data-model.md)：演示相册、照片预览和音乐摘要字段、校验规则与状态。
- [contracts/ui-navigation.md](contracts/ui-navigation.md)：首页、列表、详情、创建及占位入口的用户可见行为。
- [quickstart.md](quickstart.md)：本地运行和按规格验证的手工步骤。

## Phase 1 后宪章复核

设计只扩展静态演示数据与三个页面，不涉及外部 API、业务写入、真实分享、自动事件归档或复杂编辑；核心创建入口仍优先可达。上述五项宪章门槛均通过，无需复杂度例外。

## 风险与依赖

- SDD-00 已完成并提交。实施保留其已验收的 17 个跳转，避免覆盖后续阶段的页面边界。
- 现有 `demo-data.ts` 已有四条记录和本地封面；实施需补足首页最近 AI 配乐、卡片日期/歌曲和各详情的数据一致性。
- 原型 08、09 展示筛选、编辑和播放符号，但这些操作属于后续阶段；本阶段应避免可点击却无反馈的假交互。

## Complexity Tracking

无宪章例外。

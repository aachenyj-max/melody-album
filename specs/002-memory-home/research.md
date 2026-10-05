# 研究记录：音乐相册首页与历史记忆

## 决策 1：页面与共享布局

**Decision**: 保留 SDD-00 已提交的 `app/page.tsx` 首页入口和 `components/music-album/album-screen.tsx` 共享展示；列表、详情分别位于 `/memories`、`/memories/[id]`，用 `Link` 导航。只保留一个匹配 `/` 的 `page.tsx`。

**Rationale**: SDD-00 已把九状态、导航和页面框架建在 `AlbumScreen` 中，且 `AGENTS.md` 明确要求首页保留在 `app/page.tsx`；本地 Next.js 16.3.8 指南确认嵌套路由、动态段和 `Link` 的行为。复用这些边界比重建页面状态机更简单。

**Alternatives considered**: 所有页面放在一个客户端状态组件中；会失去可直接访问的列表/详情地址，并增加状态同步。将首页迁入 `(album)`；会与现有已验收入口及 `AGENTS.md` 约定冲突。

**Source**: `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`、`04-linking-and-navigating.md`。

## 决策 2：演示内容与读取

**Decision**: 在已有 `components/music-album/demo-data.ts` 的四条固定 ID 相册上补齐 AI 配乐数据；首页取最近项，列表按创建日期倒序，详情按 ID 查找。缺失字段用可读占位，未知 ID 用明确未找到状态。

**Rationale**: SDD-01 只验收稳定非空的历史浏览；静态数据刷新后不变，也不会提前引入真实保存或服务调用。

**Alternatives considered**: 浏览器本地存储会让评审环境内容漂移；Supabase 读取属于 SDD-05；随机生成示例会破坏刷新一致性。

## 决策 3：原型的功能边界

**Decision**: 参考设计稿 01、08、09 的布局、信息层级和情绪表达；筛选标签、编辑菜单和播放图标仅在有明确“暂未开放”反馈时显示为可操作控件，否则采用非交互展示。探索、个人中心及分享同理。

**Rationale**: 产品分阶段文档规定 SDD-01 的交付只有首页、历史列表、详情和占位；原型包含后续能力的视觉暗示，不应形成假功能。

**Alternatives considered**: 在本阶段实现筛选、编辑、播放或真实分享会越过 MVP 单元边界并增加验证负担。

## 决策 4：封面资源

**Decision**: 优先使用项目可合法用于演示的本地图片；若本阶段没有独立图片资源，使用现有渐变封面作为明确图形封面，并保留照片名称/数量信息。不得依赖远程临时图片地址。

**Rationale**: 当前 `public/` 没有相册照片资产，`designs/ui/` 是整页原型而非独立封面；可靠的本地演示比易失效的外部图片更适合阶段验收。

**Alternatives considered**: 截取整页原型中的照片会带入界面元素；远程图片会使本地和离线演示不稳定。

## 决策 5：验证方式

**Decision**: 用手工路径验收首页→创建、首页→列表→详情、直接访问详情、空状态、未知 ID、占位反馈和移动宽度；运行现有类型与 Biome 检查。

**Rationale**: 宪章明确无需为此 MVP 编写自动化测试，本阶段是低复杂度静态展示与导航。

**Alternatives considered**: 新增测试框架会增加依赖和维护成本，且对这些可直接观察的页面行为收益有限。

## 未解决项

无。SDD-00 的完成状态是实施前依赖检查，不改变本计划的设计决策。

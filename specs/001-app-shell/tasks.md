---

description: "Task list for the SDD-00 app shell and design baseline"
---

# Tasks: 可运行框架与设计基线

**Input**: Design documents from `/specs/001-app-shell/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/ui-navigation.md](./contracts/ui-navigation.md), [quickstart.md](./quickstart.md)

**Tests**: 规格未要求 TDD；任务包含手工导航、移动宽度、只读连接和静态检查验收。

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 建立本阶段的页面、组件和资源边界，不引入新依赖。

- [X] T001 确认现有 Next.js App Router、Tailwind v4、Biome 和 Supabase 客户端的入口文件，并在 `specs/001-app-shell/plan.md` 中保持实际目录与实现一致
- [X] T002 [P] 创建音乐相册页面组件目录 `components/music-album/`，为外壳、底部导航、页面容器、设计映射和演示数据预留文件
- [X] T003 [P] 创建 App Router 页面目录 `app/(album)/create/`、`app/(album)/result/`、`app/(album)/play/` 和 `app/(album)/memories/[id]/`
- [X] T004 [P] 检查本地设计稿 `designs/ui/01-首页-音乐相册.png` 至 `designs/ui/09-音乐相册详情页.png` 均存在，并记录缺失资源处理方式在 `specs/001-app-shell/quickstart.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 完成所有用户故事依赖的共享外壳、类型和导航契约。

**⚠️ CRITICAL**: 本阶段完成前不开始用户故事页面实现。

- [X] T005 建立共享页面容器和音乐相册外壳，在 `components/music-album/page-frame.tsx` 与 `components/music-album/app-shell.tsx` 中统一页面宽度、标题区域、内容边界及按 PNG 选择的底部导航挂载点
- [X] T006 建立 App Router 共享布局 `app/(album)/layout.tsx`，由 `AlbumScreen` 复用 `components/music-album/app-shell.tsx`，不改变 `(album)` 路由组的公开 URL
- [X] T007 保持 `lib/supabase/client.ts`、`lib/supabase/server.ts`、`lib/supabase/env.ts` 和 `proxy.ts` 的现有环境变量边界，并执行 `select 1 as connected` 只读检查；将成功或失败摘要记录到 `specs/001-app-shell/quickstart.md`
- [X] T008 [P] 在 `components/music-album/design-map.ts` 定义 `AppRoute`、`DesignScreenMapping` 和 `ReadonlyConnectionCheck` 类型，字段约束按 `specs/001-app-shell/data-model.md` 实现
- [X] T009 [P] 在 `components/music-album/bottom-nav.tsx` 实现首页、创建、记忆三个入口及当前项视觉状态；探索/推荐和个人中心保持不可用占位

**Checkpoint**: 共享布局、导航、类型和环境边界可供三个用户故事使用。

---

## Phase 3: User Story 1 - 进入音乐相册并浏览核心页面 (Priority: P1) 🎯 MVP

**Goal**: 用户可以从首页进入并返回全部 6 个核心页面或状态入口，页面在移动宽度下可读可操作。

**Independent Test**: 启动应用后依次访问 `/`、`/create`、`/result`、`/play`、`/memories` 和 `/memories/<demo-id>`；每页均有明确标题、返回入口和可继续的占位动作，刷新后路径仍可直接访问且无明显横向滚动。

### Implementation for User Story 1

- [X] T010 [US1] 更新 `app/page.tsx` 为音乐相册首页，提供“开始制作”入口和进入记忆列表的入口，使用共享 `AppShell`，按 PNG 01 放置标题和导航
- [X] T011 [P] [US1] 创建 `app/(album)/create/page.tsx`，按 PNG 02、03 展示上传与理解状态，以 query 区分，提供添加/继续/确认和返回链接
- [X] T012 [P] [US1] 创建 `app/(album)/result/page.tsx`，并列呈现 AI 配乐和 QQ 音乐推荐的占位卡片，提供进入播放页与返回创建页的入口
- [X] T013 [P] [US1] 创建 `app/(album)/play/page.tsx`，按 PNG 05、06、07 展示播放、调整、保存三个连续状态，并实现 HTML 的主要跳转
- [X] T014 [P] [US1] 创建 `app/(album)/memories/page.tsx`，呈现“我的音乐记忆”列表容器、空状态兜底和进入详情页的链接
- [X] T015 [P] [US1] 创建 `app/(album)/memories/[id]/page.tsx`，读取路由参数展示详情占位、返回列表入口和播放入口；未知 id 显示明确的找不到状态
- [X] T016 [US1] 在 `components/music-album/app-shell.tsx` 与 `components/music-album/page-frame.tsx` 补齐所有核心页面的标题、返回关系和移动宽度布局，确保主要操作不造成横向溢出

**Checkpoint**: User Story 1 可独立完成页面导航和移动宽度验收，作为 MVP 最小增量。

---

## Phase 4: User Story 2 - 识别产品流程与视觉基线 (Priority: P1)

**Goal**: 9 张设计稿准确映射到 5 类产品页面和连续状态，核心页面使用统一视觉基线。

**Independent Test**: 逐项核对设计稿 01–09 的映射、页面标题和下一步动作；在首页、创建、结果、播放、记忆列表和详情之间切换，确认容器、颜色、字体、间距和底部导航一致。

### Implementation for User Story 2

- [X] T017 [US2] 在 `components/music-album/design-map.ts` 填充 01–09 设计稿映射，标注所属路由、连续状态和主要下一步，确保每个 `designId` 唯一且覆盖率为 100%
- [X] T018 [US2] 在 `app/globals.css` 定义音乐相册共享颜色、字体、间距、圆角和背景 token，并保留现有 Tailwind v4 入口
- [X] T019 [P] [US2] 在 `components/music-album/page-frame.tsx` 统一标题、内容区和返回操作的视觉层级，确保页面切换时结构一致
- [X] T020 [P] [US2] 在 `components/music-album/bottom-nav.tsx` 完成当前路由到导航项的映射和可访问标签，确保详情、结果和播放状态不会错误高亮
- [X] T021 [US2] 将 9 张设计稿和 HTML 17 个主要热点映射关系链接到 `specs/001-app-shell/contracts/ui-navigation.md` 和 `specs/001-app-shell/data-model.md`，使实现路径、状态名称和验收文档一致

**Checkpoint**: User Story 2 可独立通过 9 张设计稿映射和统一视觉基线验收。

---

## Phase 5: User Story 3 - 在后续开发前确认演示基线可用 (Priority: P2)

**Goal**: 首页、记忆列表和详情拥有刷新稳定的非空演示数据；外部服务连接可只读验证，业务写入保持关闭。

**Independent Test**: 连续刷新首页、记忆列表和详情 5 次，确认标题、封面、照片、歌曲和日期仍可见；执行只读连接检查并确认没有业务数据写入。

### Implementation for User Story 3

- [X] T022 [P] [US3] 在 `components/music-album/demo-data.ts` 定义稳定的 `DemoMemoryAlbum` 与 `DemoTrack` 数据，至少包含封面、标题、照片、曲目和创建/事件日期，字段约束按 `specs/001-app-shell/data-model.md` 实现
- [X] T023 [US3] 将 `components/music-album/demo-data.ts` 接入 `app/page.tsx`、`app/(album)/memories/page.tsx` 和 `app/(album)/memories/[id]/page.tsx`，详情按稳定 id 读取，未知 id 保持可理解空状态
- [X] T024 [US3] 在 `specs/001-app-shell/quickstart.md` 和 `specs/001-app-shell/research.md` 记录 Supabase 只读检查结果、当前无业务表的事实，以及 `music_albums`、`music_album_photos`、`music_album_versions`、`music_album_recommendations`、`music_generation_runs` 和 `music-album-photos` 命名约定
- [X] T025 [US3] 检查用户端组件没有导入 `lib/supabase/server.ts` 或服务端密钥，在验收文档记录真实 Agent、音乐生成、曲库检索和保存尚未接入，播放/收藏控件 disabled，保持 PNG 用户文案

**Checkpoint**: User Story 3 可独立通过刷新稳定性、只读连接和无业务写入验收。

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 完成 SDD-00 阶段验收，不扩大 MVP 范围。

- [X] T026 [P] 更新 `specs/001-app-shell/quickstart.md`，补充实际页面路径、演示 id、设计稿映射核对方式和已知限制
- [X] T027 [P] 检查 `app/`、`components/music-album/` 和 `lib/supabase/` 的中文用户文案、可访问标签和占位说明，修正明显空白页或不可操作入口
- [X] T028 运行 `npm run format`，检查 `app/`、`components/music-album/` 和 `specs/001-app-shell/` 的格式化结果不改变规格约束或设计稿映射
- [X] T029 运行 `npm run lint` 和 `npm run tscheck`，修复 `app/`、`components/music-album/` 和 `lib/supabase/` 中阻塞 SDD-00 阶段完成条件的问题
- [X] T030 按 `specs/001-app-shell/quickstart.md` 完成 `npm run dev`、6 个页面入口、3 个移动宽度、5 次刷新和只读连接检查，并将结果记录在 `specs/001-app-shell/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**：无依赖，可立即开始。
- **Phase 2 Foundational**：依赖 Phase 1，阻塞所有用户故事。
- **Phase 3 User Story 1**：依赖 Phase 2；完成后即可作为 MVP 最小增量演示。
- **Phase 4 User Story 2**：依赖 Phase 2；可与 US1 的页面实现并行，但最终需要对接已存在的页面路径。
- **Phase 5 User Story 3**：依赖 Phase 2；建议在 US1 页面边界稳定后接入演示数据。
- **Phase 6 Polish**：依赖所有目标用户故事完成。

### User Story Dependencies

- **US1 (P1)**：只依赖 Foundational；无其他用户故事依赖。
- **US2 (P1)**：只依赖 Foundational，T021 需要 US1 的最终页面路径。
- **US3 (P2)**：只依赖 Foundational，T023 需要 US1 的列表和详情页面。

### Dependency Graph

```text
T001-T004
   ↓
T005-T009
   ├──→ US1: T010-T016
   ├──→ US2: T017-T021 (T021 after US1 routes exist)
   └──→ US3: T022-T025 (T023 after US1 list/detail exist)
                ↓
           T026-T030
```

## Parallel Opportunities

### Setup and Foundation

- T002、T003、T004 可并行；它们分别创建组件目录、页面目录和资源核对记录。
- T008、T009 可并行；类型定义与底部导航实现不修改同一文件。

### User Story 1

- T011、T012、T013、T014、T015 可在 T005–T009 完成后并行实现；它们分别写入不同页面文件。
- T010 与 T016 需要共享首页和外壳，建议顺序执行。

### User Story 2

- T019、T020 可并行；T017 与 T021 需先确定映射和页面路径。

### User Story 3

- T022 可与 T024、T025 并行；T023 在 T022 和 US1 列表/详情页面完成后执行。

## Implementation Strategy

### MVP First

1. 完成 Phase 1 Setup 和 Phase 2 Foundational。
2. 完成 US1，使 6 个页面或状态入口可到达。
3. 运行 T030 的页面导航和移动宽度检查，确认 App Shell 可演示。
4. 再完成 US2 的设计映射和 US3 的稳定演示数据。

### Incremental Delivery

1. Setup + Foundational：共享容器、导航和类型就绪。
2. US1：页面入口和返回关系可演示。
3. US2：9 张设计稿和视觉基线完成对齐。
4. US3：演示数据、只读连接和命名约定完成。
5. Polish：执行格式化、lint、TypeScript 和 quickstart 验收。

## Notes

- 每个任务都使用 `- [ ]`、顺序 ID、必要的 `[P]`/`[USn]` 标签，并包含明确文件路径。
- 本阶段不创建自动化测试任务；手工验收标准集中在各用户故事的 Independent Test 和 T030。
- 不创建 Supabase 表、Storage bucket、真实 Agent、音乐生成、曲库检索或分享能力。

## 完成记录

2026-10-05：T001–T030 已完成；本阶段范围及验证见 quickstart.md。SDD-01 至 SDD-05 的业务能力和完整逐页视觉精修仍保持未完成。

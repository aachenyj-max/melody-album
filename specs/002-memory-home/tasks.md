# 任务：音乐相册首页与历史记忆

**Input**: `specs/002-memory-home/spec.md`、`plan.md`、`research.md`、`data-model.md`、`contracts/ui-navigation.md`、`quickstart.md`

**Prerequisites**: SDD-00 的 App Shell、创建占位和导航边界应先验收；若尚未完成，先补齐以下基础任务，并按 `progress.md` 记录真实进度。

**Tests**: 规格和宪章未要求自动化测试。本单元使用独立手工验收、类型检查与 Biome 检查。

**Organization**: 按规格中的 US1、US2、US3 分阶段执行。每条任务均指向仓库根目录下的具体文件。

## 格式：`[ID] [P?] [Story] 描述`

- `[P]` 表示与同阶段其他未完成任务没有文件写入冲突且无需其结果，可并行执行。
- `[US1]`、`[US2]`、`[US3]` 对应 [spec.md](spec.md) 的用户故事。

## Phase 1：Setup

**Purpose**: 核对 SDD-00 前置状态和本项目实际路由，不新增依赖。

- [X] T001 核对 `progress.md`、`AGENTS.md`、`app/page.tsx`、`app/(album)/layout.tsx`、`components/music-album/app-shell.tsx` 与 `components/music-album/design-map.ts`：确认 SDD-00 已验收，保留其规定的首页入口和九状态组件结构，并以 `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md` 校验路由约定。

---

## Phase 2：Foundational

**Purpose**: 所有用户故事共用的可导航外壳和创建占位必须可用。

- [X] T002 确认 `app/(album)/layout.tsx`、`components/music-album/app-shell.tsx`、`components/music-album/page-frame.tsx` 可为首页、列表、详情提供一致的容器、标题和返回结构；缺失时仅补齐这些文件中本阶段必需的部分。
- [X] T003 确认 `app/(album)/create/page.tsx` 可从首页到达并显示明确的上传照片初始状态或 SDD-00 占位；若前置单元尚未建立此页，按现有 `components/music-album/page-frame.tsx` 补齐可返回的占位页，不实现上传。

**Checkpoint**: `/`、`/create` 的布局和返回边界已明确，可开始各用户故事。

---

## Phase 3：US1 - 从首页开始创建音乐记忆（P1，首个可演示增量）

**Goal**: 首页首屏清楚传达个人音乐空间，并让用户直达创建初始状态。

**Independent Test**: 打开或刷新首页，在 10 秒内识别“上传照片，生成一段记忆”，点击主入口后在 3 次点击内到达 `/create`，无需历史数据或外部服务。

- [X] T004 [US1] 保留 `app/page.tsx` 作为唯一首页路由，在 `components/music-album/album-screen.tsx` 复用现有 App Shell、标题和底部导航；不得另建冲突的 `app/(album)/page.tsx`。
- [X] T005 [US1] 在 `components/music-album/album-screen.tsx` 依照 `designs/ui/01-首页-音乐相册.png` 完成个人音乐空间定位、主文案和指向 `/create` 的真实创建链接；首屏创建入口在移动宽度保持显著。

**Checkpoint**: US1 不依赖 US2、US3，可单独演示“首页→创建”。

---

## Phase 4：US2 - 浏览最近的音乐记忆（P1）

**Goal**: 用固定的本地数据展示首页最近记忆、按日期倒序的列表和可直接访问的详情。

**Independent Test**: 直接打开 `/memories`，至少看到 2 条固定记录；点击任一记录进入匹配详情，标题、照片、歌曲和日期一致；连续刷新 5 次内容不变。

- [X] T006 [US2] 扩展 `components/music-album/demo-data.ts` 为至少 2 条固定记录：`id`“非空、唯一；刷新不变”，`title`“非空，卡片与详情一致”，`coverImage`“有值；资源不可用时呈现明确占位”，`createdAt`“可展示为中文日期；列表按其倒序”，`eventDate`“可与创建日期不同；不用于默认排序”，`caption`“可为空；为空时不显示引述区域”；不得在渲染时生成随机数据或使用当前时间填充。
- [X] T007 [US2] 在 `components/music-album/demo-data.ts` 保持 `photos`“可为空；详情显示缺省状态”、`tracks`“可为空；详情显示‘暂无音乐’”；每条歌曲的 `id` 在所属相册内唯一，`title` 和 `artist` 非空，`kind` 只标识 AI/QQ 来源、`status` 不代表音源可播放；提供稳定倒序读取与按 ID 读取入口。
- [X] T008 [US2] 完善 `components/music-album/album-screen.tsx` 的列表区域，由 `app/(album)/memories/page.tsx` 承载：按 `components/music-album/demo-data.ts` 的创建日期倒序渲染卡片，显示封面、标题、照片/歌曲摘要和日期，链接到对应 `/memories/{id}`。
- [X] T009 [US2] 完善 `app/(album)/memories/[id]/page.tsx` 与 `components/music-album/album-screen.tsx` 的详情区域：按稳定 ID 显示对应标题、照片、歌曲、创建日期和返回入口；直接访问与从列表进入一致。
- [X] T010 [US2] 在 `components/music-album/album-screen.tsx` 复用 `components/music-album/demo-data.ts` 展示最近记忆摘要、最近 AI 配乐和“查看全部”链接；摘要至少有封面、标题、歌曲与日期，首页无数据时保留创建入口。
- [X] T011 [US2] 在 `components/music-album/album-screen.tsx` 的列表区域实现空状态及 `/create` 入口；缺少照片、歌曲或日期时显示清楚的缺省信息，不出现破损卡片。
- [X] T012 [US2] 在 `app/(album)/memories/[id]/not-found.tsx` 与 `components/music-album/album-screen.tsx` 实现未知 ID 的返回入口；照片、歌曲或日期缺失时使用明确占位，不显示假播放成功状态。

**Checkpoint**: US2 可从列表地址独立验收；完成 T010 后也可演示“首页→列表→详情”。

---

## Phase 5：US3 - 识别未开放的导航与分享入口（P2）

**Goal**: 保留原型入口位置，同时让用户明确知道探索、个人中心和分享尚未开放。

**Independent Test**: 在首页、列表、详情查看当前导航状态；点击未开放入口和分享按钮，均得到明确提示或安全停留，不生成链接、不写入数据。

- [X] T013 [P] [US3] 核对 `components/music-album/bottom-nav.tsx`：保留首页、创建、记忆主导航和当前选中态，确认原型里的探索/推荐与个人中心占位使用不可用语义或“暂未开放”反馈，不导航至空白页。
- [X] T014 [US3] 在 `components/music-album/page-frame.tsx` 与 `components/music-album/album-screen.tsx` 的详情区域加入可见的分享占位按钮，点击后仅给出“暂未开放”反馈，不生成外部分享链接或修改相册数据。
- [X] T015 [US3] 检查 `components/music-album/album-screen.tsx` 中原型的筛选、编辑和播放图标：若展示为可点击控件则提供明确占位反馈，否则改为非交互装饰，避免伪装成已实现功能。

**Checkpoint**: US3 可独立检查占位行为，不依赖真实音乐、分享或用户资料服务。

---

## Phase 6：Polish & Cross-Cutting Concerns

**Purpose**: 验证跨页面体验并按项目约定更新阶段进度。

- [X] T016 检查 `app/page.tsx`、`app/(album)/memories/page.tsx`、`app/(album)/memories/[id]/page.tsx` 与 `components/music-album/bottom-nav.tsx` 在 320、375、430 CSS 像素宽度下无明显横向滚动，主入口、卡片、返回和导航可操作；必要时调整 `app/globals.css` 或相关页面样式。
- [X] T017 按 `specs/002-memory-home/quickstart.md` 完成首页→创建、首页→列表→详情、直接访问、刷新 5 次、空状态、未知 ID 和占位交互的手工验收，确认 1 分钟内可打开详情并看到标题、歌曲、日期；运行 `npm run tscheck`、`npm run lint`，在 `specs/002-memory-home/quickstart.md` 记录验收结果及限制。
- [X] T018 在所有 SDD-01 完成条件实际满足后更新 `progress.md` 的 SDD-01 勾选项、日期、验证结果、已知限制与下一阶段；与本阶段实现放入同一提交，若条件未满足则仅在“备注与阻塞”记录原因，不标记完成。

---

## Dependencies & Execution Order

### Phase Dependencies

`T001 → T002 → T003 → US1/US2/US3 → T016 → T017 → T018`。若 SDD-00 尚未验收，先完成并记录其阻塞或验收结果，再开始 SDD-01 的完成判定。

### User Story Dependencies

- **US1**：依赖基础路由和创建占位；T004 → T005。可独立交付首页创建入口。
- **US2**：依赖基础外壳；T006 → T007 → T008 → T009 → T010 → T011 → T012。列表与详情可独立于首页最近记忆区验收；共享 `album-screen.tsx` 的任务顺序执行。
- **US3**：依赖基础外壳；T013 可与 US2 页面工作并行；T014、T015 分别在对应页面文件建立后执行，避免同文件写入冲突。
- **Polish**：依赖计划交付的全部用户故事，T018 必须晚于验收。

### Parallel Opportunities

- T013 可与 US2 的展示实现并行：只修改 `components/music-album/bottom-nav.tsx`。

### Parallel Examples

```text
US3，与 US2 展示修改并行：
  T013 -> components/music-album/bottom-nav.tsx
```

## Implementation Strategy

1. 完成前置与基础任务，确保 SDD-00 页面边界可用。
2. 先交付 US1：首页创建入口可单独演示。
3. 交付 US2：稳定演示数据、列表、详情，再把最近记忆接回首页。
4. 交付 US3：占位导航和分享；不扩展到真实业务。
5. 完成移动宽度与手工验收，再按真实结果更新 `progress.md`。

## Notes

- 本清单不含自动化测试任务，符合项目宪章；手工验收仍是阶段完成条件。
- 如 SDD-00 正在其他工作中并行开发，实施时先检查其最新文件，避免覆盖未提交修改。
- 原型中的分类、编辑和播放控件不属于本阶段功能范围。

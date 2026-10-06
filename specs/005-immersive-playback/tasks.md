# Tasks: 沉浸式播放与自然语言调整

**Input**: `specs/005-immersive-playback/plan.md`、`spec.md`、`research.md`、`data-model.md`、`contracts/playback-adjustment.md`、`quickstart.md`

**Prerequisites**: 实施核对时 SDD-02 的 `ConfirmedMemory` 交接和 SDD-03 的 `MusicProfile`、音源状态与可播放资源已完成；QQ 路径为明确标识的本地 mock，不能写成真实曲库接入。

**Tests**: 项目宪章明确 MVP 无需自动化测试。本清单包含每个用户故事的手工验收任务，并在最后运行现有格式、Lint、TypeScript 和生产构建检查。

**Organization**: 任务按规格中的用户故事分组；基础阶段先建立共享会话和单一音频拥有者，再按 P1 播放、P1 调整、P2 解释实施可独立验收的增量。

## Phase 1: Setup（共享准备）

**Purpose**: 核对已完成的上游交接和现有代码边界，复用其音源与结果状态。

- [X] T001 [P] 对照 `specs/003-agent-memory-understanding/data-model.md` 和 `specs/003-agent-memory-understanding/contracts/memory-understanding.md`，确认 `ConfirmedMemory` 的照片顺序、`MemoryProfile` 版本和最低有效条件，并记录实际实现位置
- [X] T002 [P] 对照 `specs/004-music-orchestration/spec.md`、`components/music-album/demo-data.ts` 和 `public/`，确认 `MusicProfile`、生成轮次、等待音乐、可播放推荐与 AI 音源字段；若上游实现尚不存在，记录阻塞而不创建无声占位音频
- [X] T003 [P] 核对 `app/(album)/play/page.tsx`、`app/(album)/result/page.tsx`、`app/(album)/layout.tsx`、`components/music-album/album-screen.tsx`、`components/music-album/design-map.ts` 和 `app/globals.css` 的现有路由、状态与视觉边界
- [X] T004 根据 T001–T003 的结果，在现有 `lib/music/contract.ts` 对齐播放会话、可播放音源、调整轮次和 04→05 交接类型；复用上游等价类型，不复制 SDD-03 的编排逻辑

---

## Phase 2: Foundational（阻塞性基础能力）

**Purpose**: 建立所有用户故事共同依赖的当前会话、单一音频拥有者和失败/过期响应边界。

**⚠️ CRITICAL**: 本阶段完成前不要实现独立故事页面；若 T001/T002 发现上游交接或实际音源仍未提供，应保留阻塞记录。

- [X] T005 扩展现有 `components/music-album/music-session.tsx` 的 Client Provider，保存或派生 `ConfirmedMemory`、照片、`MusicProfile`、`generationRunId`、`selectedPath`、当前成功 `PlayableTrack`、等待音源和调整轮次；不要创建第二个并行 Provider，刷新或缺少交接时返回空会话
- [X] T006 在 `app/(album)/layout.tsx` 核对并维持现有创建会话与音乐会话 Provider 的嵌套，保证 `/result`、`/play`、`/play?state=adjust` 和 `/play?state=save` 的客户端导航共享同一会话；离开创作流程时清理照片对象 URL 和媒体资源
- [X] T007 在 `components/music-album/music-session.tsx` 完善单一 `HTMLAudioElement` 拥有者和媒体事件同步：监听 `loadedmetadata`、`timeupdate`、`play`、`pause`、`ended`、`error`，以 `play()` 成功或拒绝决定状态；换源前暂停并清理旧源，自动播放被拒绝时设置手动开始状态
- [X] T008 在 `components/music-album/result-flow.tsx`、`components/music-album/music-session.tsx` 和 `app/(album)/result/page.tsx` 对齐 04→05 的播放交接，确保只发布本次已确认照片、音乐意图、生成轮次、默认 AI 或用户主动选择的可播放推荐；无交接时不得用历史毕业 mock 冒充当前结果
- [X] T009 在 `app/(album)/play/page.tsx` 保留异步 `searchParams` 分派，仅把 `state=adjust`、`state=save` 作为视觉状态传入客户端组件；不要把照片、音源、指令或完整记忆序列化到 URL
- [X] T010 在 `lib/music/contract.ts` 和 `components/music-album/music-session.tsx` 加入过期响应保护：每个生成/调整轮次使用唯一 ID；不匹配的响应被丢弃，旧成功音源在新候选验证可播放前保持有效

**Checkpoint**: Provider 能在 04→05→06 导航中保留一次会话；媒体状态只由一个音频实例更新；缺少交接、自动播放拒绝、媒体错误和过期响应都有可读状态。

---

## Phase 3: User Story 1 - 播放一段有照片的音乐记忆（Priority: P1）🎯 MVP

**Goal**: 在 05 号画面完成真实播放、暂停、进度、照片同步、返回和等待音源切换，不依赖保存动作。

**Independent Test**: 按 `specs/005-immersive-playback/quickstart.md` 的“正常播放与控制”执行：从有效 04 号结果进入 05，使用可播放音源验证自动/手动开始、暂停/继续、拖动、照片切换、结束重播和返回；通过 T002 确认音源来源。

### Implementation for User Story 1

- [X] T011 [US1] 扩展现有 `components/music-album/play-flow.tsx` 的 05 号 Client Component，消费 T005 的会话和媒体状态，显示本次全幅照片、标题、短句、当前曲名、来源、播放/暂停/重播、上一张/下一张、进度和错误恢复操作
- [X] T012 [US1] 在 `components/music-album/play-flow.tsx` 和 `components/music-album/music-session.tsx` 根据有限的实际音频时长与照片数量计算照片索引和慢速转场；暂停保持当前照片，拖动立即同步，单张照片不切换，时长未知时保持第一张并禁用依赖时长的跳转
- [X] T013 [US1] 在 `components/music-album/play-flow.tsx` 和 `components/music-album/music-session.tsx` 实现播放入口与等待音源规则：进入时尝试 `play()`，拒绝则显示手动开始；AI 等待完成时仅在仍选 AI 且用户未暂停时切换，用户主动选择 QQ 推荐时不抢播，失败后停止无限等待并保留可播放推荐
- [X] T014 [US1] 在 `components/music-album/album-screen.tsx` 与 `components/music-album/play-flow.tsx` 用 T011 的交互流程替换静态 `PlayScreen`，保留 `designs/ui/05-沉浸式播放页.png` 的 DOM 层级、照片位置、播放器结构、底部两个操作和 PNG 文案
- [X] T015 [US1] 在 `app/globals.css` 将 05 号播放器的固定进度、禁用控制和硬编码状态改为交互态样式，保留手机外壳的现有 cqw 几何，并补齐焦点、禁用、错误、手动开始和无时长状态
- [X] T016 [US1] 在 `components/music-album/album-screen.tsx`、`app/(album)/play/page.tsx` 和 `components/music-album/design-map.ts` 接通 05→04、05→06、05→07 跳转；离开 05 停止声音，进入 06 暂停声音，右侧按钮仍保留“查看 AI 理解”文案并按 HTML 热点进入 07
- [X] T017 [US1] 按 `specs/005-immersive-playback/quickstart.md` 的“正常播放与控制”手工验收 360、390、430 px 三种宽度、自动播放被阻止、可播放音源失败、单张/多张照片、完整播放和返回后无音频重叠，并记录音源来源

**Checkpoint**: 04→05 能播放同一会话的实际音源；播放控制和照片进度一致；无保存动作也能完成一段播放；返回、换源和离开不会留下重叠声音。

---

## Phase 4: User Story 3 - 用一句话调整音乐并重新播放（Priority: P1）

**Goal**: 在 06 号画面提交自然语言或快捷建议，展示生成中/成功/失败，成功后以新版本重新播放，失败时保留旧版本。

**Independent Test**: 按 `specs/005-immersive-playback/quickstart.md` 的“自然语言调整”执行“更快乐一点”“更安静一点”和快捷建议；分别验证成功、慢响应、失败/超时、无音频、空白指令、重复提交及旧响应保护。

### Implementation for User Story 3

- [X] T018 [US3] 在 `components/music-album/adjust-flow.tsx` 创建 06 号 Client Component，读取当前会话和成功音乐版本，显示真实用户指令、Agent 回应、音乐预览、至少“再快一点/多一点吉他/换一种风格”快捷建议及输入发送区；静态示例不得冒充已提交指令
- [X] T019 [US3] 在 `lib/music/contract.ts` 和 `components/music-album/adjust-flow.tsx` 实现 `AdjustmentRun` 校验与轮次状态：指令去首尾空白后 1–300 字，`pending/succeeded/failed/cancelled` 分明，重复提交被阻止，旧轮次响应被丢弃，旧成功版本始终可恢复
- [X] T020 [US3] 在 `app/api/music/adjust/route.ts` 建立同源调整边界，按 `contracts/playback-adjustment.md` 接收当前记忆、音乐意图、选中路径、基础音源和指令；复用 SDD-03 已有等价服务入口时在该文件适配，不重复实现供应商调用或暴露客户端密钥
- [X] T021 [US3] 在 `app/api/music/adjust/route.ts` 返回统一成功/失败包：只有新音源实际可加载时才返回 `succeeded` 候选；对 `INVALID_CONTEXT`、`INVALID_INSTRUCTION`、`GENERATION_TIMEOUT`、`NO_PLAYABLE_RESULT` 和网络/未知错误保留旧版并提供可读、可重试信息；避免记录照片、故事、完整指令和私密音频地址
- [X] T022 [US3] 在 `components/music-album/adjust-flow.tsx` 接通发送、快捷建议、取消/重试和“重新播放”：成功候选通过媒体可播放校验后成为当前版本并从 0 秒进入 `/play`；失败或无音频不得替换旧版本或自动跳转冒充成功
- [X] T023 [US3] 在 `components/music-album/album-screen.tsx` 用 T018 的 `AdjustFlow` 替换静态 `AdjustScreen`，保留 `designs/ui/06-调整音乐-Agent对话页.png` 的对话、照片/音乐卡片、快捷建议和底部 Composer 结构；输入发送不再使用丢弃内容的静态 Link
- [X] T024 [US3] 在 `app/globals.css` 为 06 号页补齐生成中、成功、失败、重试、无音频、输入禁用、焦点和错误状态样式，保持现有浅色布局、照片/卡片叠层与底部输入几何
- [X] T025 [US3] 在 `app/(album)/play/page.tsx` 和 `components/music-album/album-screen.tsx` 实现 06→05 的成功重播、失败返回和左上返回；进入 06 先暂停音频，返回 05 不自动恢复被用户暂停的会话
- [X] T026 [US3] 按 `specs/005-immersive-playback/quickstart.md` 的“自然语言调整”手工验收成功、慢响应、失败、超时、无可播放音频、空白指令、连续提交和旧响应覆盖保护，并确认 05/07 不接收失败候选

**Checkpoint**: 用户能提交调整并看到明确状态；成功版本可重新播放且无双音源；失败不破坏原版本；演示来源与真实来源不会混淆。

---

## Phase 5: User Story 2 - 查看 AI 对记忆的理解（Priority: P2）

**Goal**: 在 05 号播放页默认收起 AI 解释，并通过上拉/收起查看与当前记忆和音乐版本对应的内容，不重置播放。

**Independent Test**: 进入 05，确认解释默认收起；上拉展开并收起，检查内容随当前成功调整版本更新，播放位置、暂停状态和声音不重启。

### Implementation for User Story 2

- [X] T027 [US2] 在 `components/music-album/play-flow.tsx` 和 `components/music-album/album-screen.tsx` 实现默认关闭的 AI 解释抽屉/上拉区域，消费当前 `MemoryProfile`、`currentVersionId` 和音乐说明；展开/收起只改变可见状态，不创建新音频、不重置进度
- [X] T028 [US2] 在 `components/music-album/play-flow.tsx` 和 `components/music-album/album-screen.tsx` 为解释抽屉加入触摸/指针上拉与键盘/按钮等可访问的打开、关闭和状态提示，同时处理当前音乐版本变化、等待音乐、失败版本和无交接空状态
- [X] T029 [US2] 在 `app/globals.css` 实现 05 号解释抽屉的收起/展开层级、手势可视提示、玻璃效果、焦点样式和减弱动态效果；保持照片、播放器和底部操作不被默认抽屉遮挡
- [X] T030 [US2] 按 `specs/005-immersive-playback/quickstart.md` 的“正常播放与控制”和“空状态、视觉与跳转”手工验收默认收起、上拉查看、收起后继续播放、调整后说明更新、键盘/大字体和 360/390/430 px 视口

**Checkpoint**: AI 解释可按需查看，内容与当前记忆/音乐版本一致；查看解释不会打断播放，也不会把等待或失败版本描述为成品。

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 完成跨故事视觉、契约、质量门槛和阶段记录。

- [X] T031 [P] 同步 `components/music-album/design-map.ts` 与 `specs/001-app-shell/contracts/ui-navigation.md` 的 05、06、07 热点目标和文案说明，保留“查看 AI 理解”与 05→07 的已知冲突记录
- [X] T032 [P] 更新 `specs/005-immersive-playback/data-model.md`、`specs/005-immersive-playback/contracts/playback-adjustment.md` 和 `specs/005-immersive-playback/quickstart.md`，使实际字段、状态、错误码和音源来源与实现一致；不把演示适配器写成真实接口验收
- [X] T033 [P] 按 `specs/005-immersive-playback/quickstart.md` 完成 05/06 对应 PNG 的布局、层级、配色、字体、图片位置、按钮文案、主要跳转、减弱动态效果和无横向溢出复核，记录 05→07 文案冲突
- [X] T034 运行 `npm run format`、`npm run lint` 和 `npm run tscheck`，修复 `app/(album)/layout.tsx`、`app/(album)/play/page.tsx`、`components/music-album/album-screen.tsx`、`components/music-album/play-flow.tsx`、`components/music-album/adjust-flow.tsx`、`components/music-album/music-session.tsx`、`lib/music/contract.ts` 和 `app/api/music/adjust/route.ts` 中的阻塞问题
- [X] T035 运行 `npm run build` 并按 `specs/005-immersive-playback/quickstart.md` 重新执行主链路，确认构建、刷新空状态、音频清理、失败恢复和 04→05→06→05→07 跳转均可演示
- [X] T036 在 `progress.md` 记录 SDD-04 的实际完成内容、验证命令/结果、音源来源、已知限制和下一阶段；只有所有阶段完成条件满足后才勾选 SDD-04

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup（Phase 1）**：T001–T003 可并行；T004 依赖前三项核对结果。
- **Foundational（Phase 2）**：T005–T010 依赖 T004，并阻塞全部用户故事；若 SDD-02/03 没有交接或可播放音源，停止在前置条件记录，不用静态数据伪造通过。
- **User Story 1（Phase 3）**：依赖 Phase 2；完成后形成播放 MVP。
- **User Story 3（Phase 4）**：依赖 Phase 2 和 US1 的会话/媒体拥有者；可在 US1 播放控制稳定后实现。
- **User Story 2（Phase 5）**：依赖 US1 的 `PlaybackFlow` 和 US3 的当前版本更新，以便解释与播放版本一致。
- **Polish（Phase 6）**：依赖所有目标故事；T031–T033 可并行，T034 依赖代码改动完成，T035 依赖 T034，T036 依赖 T033–T035。

### User Story Dependencies

- **US1（P1）**：依赖 Foundational；无其他用户故事依赖，建议作为 MVP 首先完成。
- **US3（P1）**：依赖 Foundational 与 US1 的单一音频拥有者和当前版本接口；不依赖 US2。
- **US2（P2）**：依赖 US1 的播放画面；解释内容需要 US3 发布的新音乐版本，因此最后完成。

### Parallel Opportunities

- T001、T002、T003 可并行进行文档/代码核对。
- T011 的播放结构与 T015 的基础视觉样式可在 T005–T010 完成后分工并行，但 T015 最终需以 T011 的 DOM 为准。
- T018 的调整界面结构与 T024 的浅色状态样式可并行；T020–T021 的服务端边界可由另一人独立实现，完成后由 T022 接线。
- T027、T028 共享同一文件，不能并行编辑；T029 可在接口确定后并行准备样式。
- T031、T032、T033 为不同文档/映射文件，可并行，均在最终质量检查前合并。

## Parallel Example: User Story 1

```text
Task T011: 在 components/music-album/playback-flow.tsx 实现 05 号 Client Component
Task T015: 在 app/globals.css 补齐 05 号交互状态样式（以 T011 的 DOM 为准）
```

## Parallel Example: User Story 3

```text
Task T018: 在 components/music-album/adjust-flow.tsx 实现 06 号交互结构
Task T020: 在 app/api/music/adjust/route.ts 建立同源调整边界
Task T024: 在 app/globals.css 补齐 06 号状态样式
```

## Implementation Strategy

### MVP First（User Story 1）

1. 完成 Phase 1 的上游交接和音源核对。
2. 完成 Phase 2 的当前会话与单一音频拥有者。
3. 完成 US1，先让有效结果能从 04 进入 05 并完成真实播放控制。
4. 按 T017 独立验收，分别记录真实 AI 来源、演示配乐、QQ mock 和通用等待音乐。

### Incremental Delivery

1. 加入 US3，完成调整请求和失败回退，再按 T026 验收。
2. 加入 US2，完成解释抽屉和版本一致性，再按 T030 验收。
3. 完成跨故事视觉、静态检查、构建和 `progress.md` 阶段记录。

## Notes

- 每条实现任务都指定了仓库内文件路径；`[P]` 仅用于不同文件且不依赖未完成任务的工作。
- 未生成自动化测试任务，因为当前项目宪章明确 MVP 不要求自动化测试；手工验收步骤集中在 `quickstart.md`。
- 05 号图右侧“查看 AI 理解”与 HTML 的保存热点冲突必须保留为验收限制，不能通过改文案或改目标静默消除。

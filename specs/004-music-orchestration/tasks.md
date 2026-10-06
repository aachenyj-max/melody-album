# Tasks: 音乐结果编排与等待兜底

**Input**: `specs/004-music-orchestration/` 中的 `spec.md`、`plan.md`、`research.md`、`data-model.md`、`contracts/` 与 `quickstart.md`

**Prerequisites**: SDD-02 已确认记忆交接可用；本阶段沿用 Next.js App Router、TypeScript、Tailwind CSS v4、Biome，不增加数据库或新依赖。

**Tests**: 项目宪章未要求自动化测试；各用户故事以独立手动场景验收，并在收尾运行格式、静态检查及生产构建。

**Organization**: 任务按 US1 → US2 → US3 的价值顺序组织。真实供应商已按用户最新要求切换为 fal.ai ACE-Step Prompt to Audio；T018 使用本地 `FAL_KEY` 完成真实生成验收，其他演示与失败路径可独立验证。

## Format: `[ID] [P?] [Story] Description`

- **[P]**：不同文件且不依赖彼此未完成的工作，可并行执行。
- **[Story]**：`[US1]`、`[US2]`、`[US3]` 对应 `spec.md` 的用户故事；准备、基础和收尾任务无故事标签。
- 路径均以仓库根目录 `E:\腾讯黑客松` 为基准。

## Phase 1: Setup（共享准备）

**Purpose**: 确认上游交接并准备可合法播放的本地音频，避免用空 URL 或历史占位歌曲冒充播放结果。

- [X] T001 核对 `components/music-album/creation-session.tsx` 的 `ConfirmedMemory` 与 `components/music-album/result-flow.tsx` 的消费接口，把实际交接、直接刷新语义及 SDD-02 未完成项写入 `specs/004-music-orchestration/quickstart.md`；若上游尚不能给出已确认的有效记忆，先完成该前置条件。
- [X] T002 [P] 在 `public/audio/music-album/ambient.wav` 放入可合法使用、浏览器可加载的通用氛围音频，供 AI 等待期间使用。
- [X] T003 [P] 在 `public/audio/music-album/mock-qq.wav` 放入可合法使用、浏览器可加载的演示推荐音频，不绑定真实 QQ 曲库歌曲身份。
- [X] T004 [P] 在 `public/audio/music-album/demo-ai.wav` 放入可合法使用、浏览器可加载且时长为 15–30 秒的演示 AI 音频。
- [X] T005 在 `specs/004-music-orchestration/verification/audio-assets.md` 记录 T002–T004 的来源、使用许可、MIME、实际时长与浏览器加载结果；未验证成功的资源不得标为可播放。

**Checkpoint**: 已确认记忆可交接，三类音频有明确来源且可播放。

## Phase 2: Foundational（阻塞所有故事的基础）

**Purpose**: 固定本阶段的数据约束和跨页会话位置；后续状态与 UI 只使用这一份契约。

- [X] T006 在 `lib/music/contract.ts` 定义并验证 `ConfirmedMemory` 入口（有效 `MemoryProfile`；`title` 非空，`event` 或 `atmosphere` 至少一项非空，`photoOrder` 恰好覆盖 1–9 个 `File`）以及 `MusicProfile`（`contractVersion=1`、`memoryVersion:number`、`memoryTitle` 最长 100 字、`mood` 和 `style` 非空且各最长 100 字、`tempo=slow|moderate|lively`、`structure=gentle|steady|uplifting`、`instrumentalPrompt` 非空且最长 600 字并明确“无歌词、无人声”、`targetDurationSec` 为 15–30 的整数）；拒绝原图、完整故事和密钥进入音乐请求。
- [X] T007 在 `components/music-album/music-session.tsx` 建立仅在当前浏览器导航会话存在的 `MusicRun` 状态：唯一 `runId`、新建创作递增的 `creationEpoch`、当前 `profile`、独立的 `ai`/`recommendations` 分支、默认 `{kind:'ai'}` 的 `selection`、独立的 `ambientTrack`；定义 `AudioKind=none|ambient|ai|qq` 与 `AudioState=idle|playing|paused|blocked|failed`，此步先不启动请求或播放。
- [X] T008 在 `app/(album)/layout.tsx` 将 T007 的音乐会话放到 `/result` 与 `/play` 共用的布局内，复用现有 `CreationSessionProvider`，确保页面间导航不重建会话且不另建照片/记忆持久化。

**Checkpoint**: 两个页面共享同一运行状态；类型约束与上游确认版本一致。

## Phase 3: User Story 1 - 从确认的记忆得到两路音乐结果（Priority: P1）🎯 MVP 演示

**Goal**: 04 号页由同一份确认记忆产生 AI 配乐状态和明确标识的 QQ mock 推荐，并把照片与默认 AI/显式 QQ 选择交给 05 号页。

**Independent Test**: 用已确认的毕业记忆从 03 进入 04，看到相符音乐意图、至少一首“演示推荐”、明确的 `api/demo` 来源及独立状态；点击“进入播放”到 05。直达或刷新 `/result` 应显示空状态。真实生成验收需完成 T018。

- [X] T009 [P] [US1] 在 `lib/music/profile.ts` 实现同一已确认 `MemoryProfile` 到同一 `MusicProfile` 的纯转换：情绪/风格各非空且最长 100 字，节奏仅 `slow|moderate|lively`（无依据取 `moderate`），结构仅 `gentle|steady|uplifting`（无依据取 `steady`），提示词非空且最长 600 字并包含“无歌词、无人声”，目标时长取 15–30 秒整数；未知人物、地点和情节保持中性，不发送源图或完整故事。
- [X] T010 [P] [US1] 在 `lib/music/mock-recommendations.ts` 实现基于 `MusicProfile` 的稳定 QQ mock 集合：`MockRecommendation` 含稳定 `id`、演示标题/艺人、封面或占位、`durationSec`、推荐理由、`source='mock'`、`audioUrl:string|null`；`ready` 至少一首，`playable` 仅由实际资源可打开推导，不复用 `components/music-album/demo-data.ts` 中 `status='placeholder'` 的历史歌曲。
- [X] T011 [P] [US1] 在 `lib/music/generator.ts` 实现显式演示适配器与真实适配器接口：未配置真实服务才可返回 `source='demo'` 和已验证的 `public/audio/music-album/demo-ai.wav`；真实服务配置后失败必须返回错误，不能静默降级为演示音频；服务端不得记录原图、完整故事、提示词、密钥或音频 URL 原文。
- [X] T012 [US1] 在 `app/api/music/generate/route.ts` 实现无共享缓存的 `POST /api/music/generate`：接收 `{contractVersion:1,requestId,profile}`，复用 T006 校验文本长度、枚举和 15–30 秒整数时长，拒绝照片/原始故事/额外外部 URL；成功回 `{contractVersion,requestId,source:'api'|'demo',track:{title,durationSec,audioUrl,audioMimeType,expiresAt}}`，错误按 `contracts/music-generation.md` 的 `INVALID_PROFILE` 400、`GENERATION_UNAVAILABLE` 503、`GENERATION_TIMEOUT` 504、`INVALID_GENERATED_AUDIO` 502、`PROVIDER_ERROR` 502、`UNKNOWN` 500 返回非敏感包。
- [X] T013 [US1] 在 `components/music-album/music-session.tsx` 从当前 `ConfirmedMemory` 建立单次运行并独立启动 AI 请求与本地推荐：`AiBranch.status=idle|pending|ready|failed`，`source=api|demo|null`，`progressPercent:number|null` 仅可信 0–100，`track` 仅浏览器预加载验证音频可用后的 `ready` 状态才存在，`error` 在 `failed` 时必需；`RecommendationBranch.status=idle|pending|ready|empty|failed`，`tracks` 在 `ready` 时至少一首，失败不清空另一分支；只消费确认版本，不重复运行。
- [X] T014 [US1] 在 `components/music-album/result-flow.tsx` 承接 T013，把当前照片预览、记忆标题、两路状态、推荐选择与“进入播放”交给现有 04 号屏幕；没有有效确认记忆或直接刷新时显示空状态及返回 `/create` 入口，且不启动生成。
- [X] T015 [US1] 在 `components/music-album/album-screen.tsx` 将 04 号静态示例替换为真实状态绑定，保留 `音乐相册-ui还原.html` 第 04 项和 `designs/ui/04-生成结果-为你生成与QQ音乐推荐.png` 的标题、状态区、切换区、照片、AI 卡、推荐卡、底部“进入播放”层级；`demo` 显示“演示配乐”，mock 显示“演示推荐”，浏览标签切换不改变默认 AI 选择，只有点选已验证可播的推荐才改为 `{kind:'qq',trackId}`。
- [X] T016 [US1] 在 `app/globals.css` 按 04 号 PNG 调整动态卡片、来源标记、空状态和底部主按钮的布局、字体、颜色与玻璃层级，保持窄屏和较大系统字体可读，不增加用户端底部导航。
- [X] T017 [US1] 在 `app/(album)/play/page.tsx` 接收共用音乐会话的当前照片、AI/推荐状态和选中的音源，维持 04→05 与 05→04 路径；此阶段只落实交接和可用音源入口，05 的完整照片动画与控制留给 SDD-04。
- [X] T018 [US1] 在 `.env.local` 配置服务端 `FAL_KEY` 后，用 `lib/music/generator.ts` 调用 fal.ai `fal-ai/ace-step/prompt-to-audio`，发送 `instrumental=true` 与目标时长，按 queue 状态、音频 URL/MIME 和错误响应完成真实生成验收；只有真实服务生成且浏览器可加载 15–30 秒音频时才标 `source='api'`，不要把 key 提交到仓库。

**Checkpoint**: US1 的显式演示模式可独立演示；真实生成的正式验收以 T018 为门槛。

## Phase 4: User Story 2 - 在生成期间听到音乐并了解进展（Priority: P1）

**Goal**: AI 等待时可听到氛围音频并看到诚实的进展；进入 05 后声音持续，AI 完成时仅在仍选 AI 的情况下切换成品。

**Independent Test**: 延迟 AI 响应，分别在 04 和 05 检查等待文案、氛围音频与推荐独立出现；完成后只听到 AI 音频。再阻止自动播放，确认状态为 `blocked` 且可手动启动。主动选择 QQ 后 AI 完成不得抢播。

- [X] T019 [US2] 在 `components/music-album/music-session.tsx` 增加唯一浏览器音频控制者：`ambientTrack:PlayableAudio|null` 只作等待资源，AI `pending` 且选择仍为 AI 时使用 `public/audio/music-album/ambient.wav`；`AiTrack` 必有 `title`、`durationSec`、`audioUrl`、`audioMimeType`、`source` 和可选 `expiresAt`，仅可播且 15–30 秒时进入 `ready`；旧音源先淡出/停止再开新音源，AI 完成仅在选 AI 时替换，选 QQ 时不抢播，任何时刻最多一个活动音源。
- [X] T020 [US2] 在 `components/music-album/music-session.tsx` 把浏览器 `play()` 成功、暂停、加载失败和自动播放拒绝映射为真实 `AudioState`；自动播放拦截时置 `blocked` 并暴露用户触发的播放操作，不能误报 `playing`；氛围资源失效时保留两路结果与等待状态。
- [X] T021 [US2] 在 `components/music-album/result-flow.tsx` 依据 AI 实际进展和音频状态生成 04 号显示数据：仅供应商有可信 0–100 百分比时显示数字，否则显示进行中/预计等待文案；删除固定“60%”“约 20 秒”的伪进度，并提供 blocked 状态的手动播放入口。
- [X] T022 [P] [US2] 在 `components/music-album/album-screen.tsx` 将 T021 的等待、手动播放和推荐独立更新状态接入 04 号原有位置，AI 尚未完成时不得把氛围音乐标为 AI 成品。
- [X] T023 [P] [US2] 在 `app/(album)/play/page.tsx` 接续布局中的单一音频会话：AI 待生成时继续氛围音乐、AI 完成时切换，若用户已明确选择可播 QQ mock 则继续该曲且不被 AI 抢播；重复点击“进入播放”不产生重复导航或叠音。
- [X] T024 [US2] 按 `specs/004-music-orchestration/quickstart.md` 的慢响应、自动播放允许/阻止和 04→05 切换场景手动验收，并把每种状态的实际音源、UI 状态和是否叠音记录到 `specs/004-music-orchestration/verification/waiting-playback.md`。

**Checkpoint**: US2 可以在 AI 尚未完成时独立验证等待、跨页续播、完成切换及浏览器拦截反馈。

## Phase 5: User Story 3 - 原创失败仍能继续使用推荐（Priority: P1）

**Goal**: 任一路失败不清空另一结果；原创失败可重试或主动选可播推荐，元信息歌曲与空资源不能作为兜底。

**Independent Test**: 令 AI 超时/失败而 QQ mock 可播，确认推荐仍在、AI 可重试、选推荐后能进入 05；再检查 QQ empty/failed、元信息但无音频、AI 重试晚到响应，以及默认 AI 失败时氛围音乐停止。

- [X] T025 [P] [US3] 在 `components/music-album/music-session.tsx` 为每次 AI 与推荐重试更新各自 `attemptId`，并在新创作时递增 `creationEpoch`、废弃旧 `runId`、取消或忽略旧请求；只接受当前 `runId`/`attemptId` 响应，重复重试不生成并发有效音源，离开创作流程停止音频且不把结果误记为已保存。
- [X] T026 [P] [US3] 在 `lib/music/mock-recommendations.ts` 明确 `ready|empty|failed` 及无音频、无封面结果的处理：`ready` 至少一首，封面缺失用占位，`audioUrl:null` 仅展示元信息且不可播，资源验证失败也不可播。
- [X] T027 [US3] 在 `components/music-album/music-session.tsx` 完成失败转移：AI 失败/超时即停止 `ambient`，保留已得到的推荐和照片；重试 AI 只清空本分支错误，推荐失败/空列表只清空本分支；AI 失败且用户未选择可播 QQ，或等待音频失效且 AI 未就绪时阻止空音源进入 `/play`。
- [X] T028 [US3] 在 `components/music-album/result-flow.tsx` 接入两路独立错误、重试和播放可用性提示；AI 失败但推荐可播时引导用户主动点选，只有元信息或两路都不可播时提供重试/返回，重试不清空另一分支。
- [X] T029 [US3] 在 `components/music-album/album-screen.tsx` 按 04 号卡片位置展示 T028 的失败、空推荐、无音频与封面占位状态；禁用不可播推荐的选择和空音源“进入播放”，保留明确的“演示推荐”来源标记。
- [X] T030 [US3] 按 `specs/004-music-orchestration/quickstart.md` 的 AI 失败/超时、QQ 空/失败/仅元信息、重试旧响应、重复点击和新创建场景手动验收，并把预期与实测写入 `specs/004-music-orchestration/verification/failure-recovery.md`。

**Checkpoint**: US3 的每条失败路径均有明确重试或安全返回，且没有空音源播放、过期结果覆盖或错误的成功标记。

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 对照原型、验证主流程，并如实维护阶段状态。

- [X] T031 对照 `音乐相册-ui还原.html` 第 03→04→05 热点和 `designs/ui/04-生成结果-为你生成与QQ音乐推荐.png`，在至少三种手机宽度及较大系统字体下检查 04 的布局、层级、配色、字体、图片位置、按钮文案、主要跳转与无底部导航规则，将截图路径、差异和修复结果写入 `specs/004-music-orchestration/verification/visual-check.md`。
- [X] T032 运行 `npm run format`、`npm run lint`、`npm run tscheck`、`npm run build`，按 `specs/004-music-orchestration/quickstart.md` 复走确认记忆→04→05 主流程，并把命令结果、演示/真实 API 模式及仍未通过项记录在 `specs/004-music-orchestration/verification/quality.md`。
- [X] T033 在 `progress.md` 同步本阶段完成证据、验证结果、已知限制和下一阶段，并把旧“真实 QQ 检索 tool”门槛改为用户确认的 QQ mock 范围；只有 T018 的真实 API 验收及其余完成条件均满足时才勾选 SDD-03 完成，若 API 资料仍缺则在“备注与阻塞”写明并保持未完成；与实现同一提交更新。

## Dependencies & Execution Order

- **Setup → Foundational**：T001 是 SDD-02 交接门槛；T002–T004 可同时准备，T005 在三项资源之后。T006 → T007 → T008 后进入故事阶段。
- **US1**：T009、T010、T011 在基础契约后可并行；T012 依赖 T011，T013 依赖 T009/T010/T012，T014–T017 依次把状态接到 04 与 05。T018 依赖本地配置 `FAL_KEY` 并完成真实音频验收；它不阻塞 US2/US3 的显式演示模式开发，却阻塞真实生成验收和 SDD-03 完成标记。
- **US2**：依赖 US1 的会话、结果 UI 与页面交接；T019 → T020 → T021 → T022/T023 → T024。US2 的慢响应与声音切换可用演示适配器独立验收。
- **US3**：依赖 US1 的两个分支及 US2 的音频控制；T025/T026 可分别处理过期响应与推荐资源，随后 T027 → T028 → T029 → T030。
- **Polish**：T031/T032 在故事可运行后进行，T033 在阶段验收结论明确后执行；不得以演示适配器替代 T018。

### Parallel Examples

```text
Setup：T002 ambient.wav、T003 mock-qq.wav、T004 demo-ai.wav 使用不同资源文件，可并行准备；T005 统一记录来源。
US1：T009 profile.ts、T010 mock-recommendations.ts、T011 generator.ts 使用不同模块，可并行实现；完成后顺序接入 T012–T017。
US2：T022 album-screen.tsx 与 T023 play/page.tsx 在 T021 完成后可分别处理 04 与 05 的展示，再执行 T024 联合验收。
US3：T025 music-session.tsx 与 T026 mock-recommendations.ts 使用不同模块，可并行处理，再汇合到 T027。
```

## Implementation Strategy

1. 完成 Setup 和 Foundational，先核实 SDD-02 的确认记忆与可播音频。
2. 完成 US1 的显式演示路径，独立核对 03→04→05、两路来源标记、默认 AI 与主动选 QQ；这是当前可演示的 MVP 切片。
3. 叠加 US2 的等待音乐和真实播放状态，再叠加 US3 的失败、重试与过期响应保护；每个检查点分别验收。
4. 在 `.env.local` 配置 `FAL_KEY` 后完成 T018，验证 fal.ai ACE-Step 返回的真实音频与错误映射；最终执行视觉、质量和进度收尾。没有 key 或未完成浏览器音频加载验证时，不宣称阶段完成。

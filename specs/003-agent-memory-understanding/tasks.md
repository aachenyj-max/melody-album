---

description: "Task list for SDD-02 Agent 创建与记忆理解"
---

# Tasks: Agent 创建与记忆理解

**Input**: Design documents from `/specs/003-agent-memory-understanding/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/memory-understanding.md](contracts/memory-understanding.md), [quickstart.md](quickstart.md)

**Tests**: 规格未要求 TDD，项目宪章也不要求为 MVP 编写自动化测试；各故事以独立手工验收和现有静态检查为门槛。

**Organization**: 按规格中的 US1、US2、US3 分阶段，先完成共同契约，再逐步打通上传、理解、修正与确认。

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 核对已提交基线及 02、03 原型，不增加依赖或新页面类型。

- [X] T001 [P] 核对 `progress.md`、`AGENTS.md`、`app/(album)/create/page.tsx`、`app/(album)/result/page.tsx` 和 `components/music-album/album-screen.tsx` 的 SDD-00/01 基线，在 `specs/003-agent-memory-understanding/verification/baseline.md` 记录现有静态交互、已完成依赖与本阶段需替换的假入口
- [X] T002 [P] 对照 `音乐相册-ui还原.html` 的 `screens` 02→03→04 和 `actions` 热点、`designs/ui/02-创建音乐相册-上传照片.png`、`designs/ui/03-创建音乐相册-Agent记忆理解.png`，在 `specs/003-agent-memory-understanding/verification/design-baseline.md` 记录布局、层级、配色、字体、图片位置、按钮文案和主要跳转验收点

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 固定理解/修正共用的数据与错误契约，所有故事均基于同一校验规则。

**⚠️ CRITICAL**: 完成本阶段后再开始用户故事实现。

- [X] T003 在 `lib/memory/contract.ts` 定义 `CreationPhase`、`MemoryProfile`、`TimelineItem`、`MemorySuccess`、`MemoryFailure` 和错误码：`version` 从 1 开始；`people`/`event`/`atmosphere`/`timeline` 未识别为 `null`，时间线关联照片索引必须在当前照片范围内；`title` 非空且 `event` 或 `atmosphere` 至少一项非空；`photoOrder` 恰好覆盖全部照片索引；`source` 仅为 `agent | demo`；修正成功版本递增 1、失败不递增
- [X] T004 在 `lib/memory/request.ts` 实现两个 POST 共用的表单解析与错误映射，按 `contracts/memory-understanding.md` 校验 1–9 张 JPEG 分析图、整个 multipart 请求体 ≤3.5 MiB、故事去空白后 ≤1000 字、修正指令去空白后 1–300 字、当前 profile 版本和照片索引；无效请求返回统一失败包，不记录照片或故事原文

**Checkpoint**: 两个故事入口和 UI 可复用相同的字段、限制与错误语义。

---

## Phase 3: User Story 1 - 上传照片并开始创建记忆 (Priority: P1) 🎯 MVP increment

**Goal**: 用户可选择、预览、删除和补选 1–9 张照片，输入可选故事，进入明确的理解中状态；此增量不把原型示例文案当作真实结果。

**Independent Test**: 在 `/create` 分别选择 1 张、9 张和重复照片，删除/补选后数量与顺序正确；只上传照片或加故事都可提交并看到理解中状态；刷新或离开前的未确认输入不会误作已保存内容。

### Implementation for User Story 1

- [X] T005 [US1] 在 `components/music-album/photo-preparation.ts` 实现源图校验、顺序生成分析图及请求预算计算：源图仅接收 JPEG/PNG/WebP、单张 ≤10 MiB、总计 ≤50 MiB；分析用 JPEG 长边最多 1024 像素，逐步压缩使整个 multipart 请求体 ≤3.5 MiB；压缩失败返回可移除/更换照片的错误，原图不得进入 `/api/memory/*` 请求
- [X] T006 [US1] 在 `components/music-album/create-flow.tsx` 建立 `CreationDraft` 的照片输入和故事交互：`photos` 保留当前排序，`position` 从 0 开始连续且不重复，重复文件作为独立项准确计数；`localId` 当前草稿内唯一；`previewUrl` 在移除、重选、离开时释放；输入变化使 `analysisFile` 和旧 `profile` 失效；`readState=failed` 的照片不可提交；`story` 去空白后 ≤1000 字；0 张或超过 9 张均不能继续；提交后显示可取消或返回的理解中状态并阻止重复提交
- [X] T007 [US1] 在 `components/music-album/album-screen.tsx` 将 02 上传区的“添加照片”“继续上传”静态链接替换为 `CreateFlow` 的照片选择与提交操作，保留 `AppShell`、页面标题、照片叠层、对话气泡和其他 01、04–09 状态的现有结构
- [X] T008 [US1] 在 `app/(album)/create/page.tsx` 接入创建交互并保留 `/create`、`/create?state=understanding` 两个原型地址；直接打开或刷新理解状态但没有草稿时显示上传初始状态，不显示假成功内容
- [X] T009 [US1] 在 `app/globals.css` 按 `designs/ui/02-创建音乐相册-上传照片.png` 修正上传态的布局、层级、配色、字体、图片位置、按钮文案与 02 热点位置，使动态预览和可选故事不重排原型结构
- [X] T010 [US1] 按 `specs/003-agent-memory-understanding/quickstart.md` 独立验收 1/9/10 张、重复照片、删除/补选、可选故事、无效格式及 02 热点，将结果写入 `specs/003-agent-memory-understanding/verification/us1.md`

**Checkpoint**: US1 可独立演示“选择照片 → 预览/修改 → 提交 → 理解中”，不依赖真实 Agent。

---

## Phase 4: User Story 2 - 查看 Agent 的记忆理解结果 (Priority: P1)

**Goal**: 提交照片后得到可辨认的处理、成功、部分结果和失败状态，展示五类理解信息；无真实凭证时明确显示演示来源。

**Independent Test**: 用固定照片分别触发成功、部分字段未识别、不可用结果、超时或服务不可用；确认每类状态都有清晰文案、重试或返回，并且演示结果有来源标识。

### Implementation for User Story 2

- [X] T011 [P] [US2] 在 `lib/memory/adapter.ts` 定义真实/演示同契约入口，未配置真实 Agent 时返回稳定 `source=demo` 的 `MemoryProfile`；开发环境仅在演示适配器下支持契约规定的 `X-Demo-Scenario` 失败/部分结果场景；真实入口已配置但失败时返回 `AGENT_UNAVAILABLE`、`AGENT_TIMEOUT` 或 `INVALID_RESULT`，不得静默改成演示成功；不在客户端或日志暴露密钥、原图及故事正文
- [X] T012 [P] [US2] 在 `components/music-album/memory-profile-card.tsx` 呈现事件标题、人物、事件、氛围、时间线和 `photoOrder`；`null` 显示“未识别”，`source=demo` 显示“演示结果”；只在 `title` 非空且 `event` 或 `atmosphere` 至少一项非空时开放后续确认
- [X] T013 [US2] 在 `app/api/memory/understand/route.ts` 实现 `POST /api/memory/understand`，调用 `lib/memory/request.ts` 和 `lib/memory/adapter.ts`，接收重复 `photos` 与可选 `story`，返回 `contractVersion=1`、`requestId` 及统一成功/错误 JSON；无效字段、超限、不可用结果和 Agent 故障按契约映射状态码
- [X] T014 [US2] 在 `components/music-album/create-flow.tsx` 接入理解请求和结果卡：区分图片准备、理解中、可确认、输入无效、请求失败；用取消或请求标识忽略过期响应，失败时保留照片与故事并提供重试/返回；照片变化使旧 `profile` 失效，不让静态毕业文案冒充本次结果
- [X] T015 [US2] 在 `app/globals.css` 按 `designs/ui/03-创建音乐相册-Agent记忆理解.png` 还原理解卡、事件标题、状态提示及照片叠层的布局、层级、配色、字体、图片位置和按钮文案，动态五类字段只替换示例内容
- [X] T016 [US2] 按 `specs/003-agent-memory-understanding/contracts/memory-understanding.md` 和 `specs/003-agent-memory-understanding/quickstart.md` 独立验收成功、缺失人物/时间线、无标题或事件/氛围均缺失、超时/网络失败、重试及演示标识，将结果写入 `specs/003-agent-memory-understanding/verification/us2.md`

**Checkpoint**: US2 可独立完成“照片 → 理解结果或可恢复失败”，尚不要求修正或音乐结果。

---

## Phase 5: User Story 3 - 修正并确认记忆理解 (Priority: P1)

**Goal**: 用户可多次自然语言修正当前有效版本，失败不丢失旧结果；确认后把当前版本交给 `/result`，确认前刷新或离开清空草稿。

**Independent Test**: 对成功结果提交一次有效修正、一次空白或无法理解的修正和一次失败修正；确认版本及内容变化、旧结果保留；确认后进入 04 占位，未确认时刷新/离开再返回均从初始状态开始。

### Implementation for User Story 3

- [X] T017 [P] [US3] 在 `lib/memory/adapter.ts` 实现修正适配：接收当前 `MemoryProfile`、原故事、同顺序分析图及去空白后 1–300 字指令，`baseVersion` 必须与当前 `MemoryProfile.version` 一致；成功只更新受影响字段并令 `version` 增加 1，无法理解返回 `REVISION_UNCLEAR`，失败或超时不覆盖上一有效版本
- [X] T018 [P] [US3] 在 `components/music-album/creation-session.tsx` 建立 `ConfirmedMemory` 的当前导航会话交接：只保存符合最低内容要求的已确认 `profile` 和源图 `File[]` 引用；未确认草稿离开/刷新清除，不写 URL、localStorage、sessionStorage 或业务存储；结果页自行建立并释放预览 URL
- [X] T019 [US3] 在 `app/api/memory/revise/route.ts` 实现 `POST /api/memory/revise`，按契约验证 `photos`、原 `story`、当前 `profile` JSON 和 `instruction`，成功返回新版本，空白/超长指令、旧版本、无法理解、超时均返回对应错误并保留客户端旧结果
- [X] T020 [US3] 在 `app/(album)/layout.tsx` 挂载 `components/music-album/creation-session.tsx` 的轻量提供器，保留已有路由组公开 URL；在 `components/music-album/create-flow.tsx` 按路径变化显式清除离开 `/create` 的未确认草稿，不能依赖组件卸载或 `router.refresh()` 自动清理
- [X] T021 [US3] 在 `components/music-album/create-flow.tsx` 实现自然语言修正输入、建议词和处理中状态：空白或 >300 字不覆盖结果；一次只处理一条请求；过期响应丢弃；失败保持上一有效 `profile` 和照片，允许重试或直接确认上一版本
- [X] T022 [US3] 在 `components/music-album/create-flow.tsx` 实现“一键确认，开始生成”：只有符合 `title` 非空、`event` 或 `atmosphere` 至少一项非空的当前版本可确认；把 `profile`、当前照片与顺序写入 `ConfirmedMemory` 后进入 `/result`，确认中阻止重复点击
- [X] T023 [US3] 在 `app/(album)/result/page.tsx` 接收本次已确认结果，在原型 04 的页面结构中展示可识别的事件标题/照片与下一阶段音乐生成占位；直接访问或刷新 `/result` 时明确标为演示占位，不宣称已根据用户照片生成音乐
- [X] T024 [US3] 在 `components/music-album/design-map.ts` 与 `specs/001-app-shell/contracts/ui-navigation.md` 同步 02“添加照片/继续上传”需先真实选图和提交、03“一键确认”需有有效结果才进入 04 的热点前置条件，保持现有 17 个主要热点数量/目标和 `音乐相册-ui还原.html` 的 02→03→04 顺序
- [X] T025 [US3] 在 `app/globals.css` 按 `designs/ui/03-创建音乐相册-Agent记忆理解.png` 调整修正输入、建议词与确认按钮的几何和文案，并核对进入 04 时不改变 `designs/ui/04-生成结果-为你生成与QQ音乐推荐.png` 的既有结构
- [X] T026 [US3] 按 `specs/003-agent-memory-understanding/quickstart.md` 独立验收有效/空白/无法理解/失败修正、版本递增、上一结果保留、部分结果确认、未确认草稿刷新/离开清空及确认后交接，将结果写入 `specs/003-agent-memory-understanding/verification/us3.md`

**Checkpoint**: US3 完成 SDD-02 用户链路；04 仍是 SDD-03 的音乐结果占位，不能据此宣称音乐生成已完成。

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 对照原型与规格完成视觉、交互、安全和静态检查，记录阶段验收。

- [X] T027 [P] 在 320、375、430 CSS 像素下对照 `音乐相册-ui还原.html`、`designs/ui/02-创建音乐相册-上传照片.png` 和 `designs/ui/03-创建音乐相册-Agent记忆理解.png` 逐项核对布局、层级、配色、字体、图片位置、按钮文案与 02→03→04 热点；临时截图置于 `.sdd00-work/`，持久差异和验收结论写入 `specs/003-agent-memory-understanding/verification/visual-check.md`
- [X] T028 [P] 核查 `components/music-album/create-flow.tsx`、`components/music-album/creation-session.tsx`、`lib/memory/request.ts`、`app/api/memory/understand/route.ts` 和 `app/api/memory/revise/route.ts` 的原图不上传、请求体 ≤3.5 MiB、对象 URL 释放、草稿不持久化、服务端密钥不入客户端及无照片/故事原文日志，将结果写入 `specs/003-agent-memory-understanding/verification/privacy-check.md`
- [X] T029 对 `app/(album)/`、`app/api/memory/`、`components/music-album/`、`lib/memory/` 和 `specs/003-agent-memory-understanding/` 运行 `npm run format`、`npm run lint`、`npm run tscheck`，修复阻塞问题并在 `specs/003-agent-memory-understanding/quickstart.md` 记录命令与结果
- [X] T030 按 `specs/003-agent-memory-understanding/quickstart.md` 完成开发服务器主流程、输入边界、失败重试、直接访问、刷新清空、3 个移动宽度和 `npm run build` 验收，把结果及已知限制写入 `specs/003-agent-memory-understanding/quickstart.md`
- [X] T031 在 `progress.md` 勾选实际满足的 SDD-02 条目、填写完成条件、验证结果、已知限制与下一阶段，并与 `specs/003-agent-memory-understanding/quickstart.md` 的验收记录在同一个提交中提交；未满足条件时只在 `progress.md`“备注与阻塞”记录原因，不标记阶段完成

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**：确认已提交基线和 02、03 原型；T001、T002 可并行。
- **Phase 2 Foundational**：依赖 Phase 1，T003 先于 T004；共同契约完成前不开始用户故事。
- **Phase 3 US1**：依赖 Foundational；完成后可独立演示照片输入和理解中状态。
- **Phase 4 US2**：依赖 Foundational 及 US1 的可用照片输入；T011、T012 可并行，随后接入 T013–T016。
- **Phase 5 US3**：依赖 Foundational 和 US2 的有效 Memory Profile；T017、T018 可并行，随后接入修正、确认与结果交接。
- **Phase 6 Polish**：依赖目标用户故事完成；视觉验收与隐私核查可并行，静态检查和阶段记录顺序进行。

### User Story Dependencies

- **US1 (P1)**：只依赖共同契约；不依赖真实 Agent。
- **US2 (P1)**：其服务端适配与结果卡可独立开发和契约验收，页面端接入依赖 US1 的照片提交。
- **US3 (P1)**：修正入口与内存交接可独立开发，端到端确认依赖 US2 的当前有效结果。

### Dependency Graph

```text
T001 + T002
     ↓
T003 → T004
     ↓
US1: T005–T010
     ↓
US2: T011 + T012 → T013–T016
     ↓
US3: T017 + T018 → T019–T026
     ↓
T027 + T028 → T029 → T030 → T031
```

## Parallel Opportunities

- **Setup**：T001 的现有实现盘点与 T002 的设计稿/热点盘点写入不同文件，可并行。
- **US2**：T011 的适配器与 T012 的结果卡在共同契约完成后写入不同文件，可并行；T013 需等适配器，T014 需等服务端响应与结果卡。
- **US3**：T017 的修正适配与 T018 的确认交接在 US2 结果契约稳定后写入不同文件，可并行；T019、T020 分别依赖相应文件。
- **Polish**：T027 只记录视觉差异，T028 只记录隐私/状态核查；两者不修改同一实现文件，可并行。

## Parallel Example: User Story 2

```text
Task: "T011 在 lib/memory/adapter.ts 建立真实/演示同契约适配与来源标识"
Task: "T012 在 components/music-album/memory-profile-card.tsx 展示五类理解信息与未识别状态"
```

## Implementation Strategy

### MVP First

1. 完成 Phase 1 和 Phase 2。
2. 完成 US1，独立验收“选择照片 → 预览/修改 → 提交 → 理解中”，保证 02 号原型的功能与视觉入口成立。
3. 完成 US2 的演示适配与理解结果，使 02→03 可以独立演示；再接 US3 的修正与确认。

### Incremental Delivery

1. **US1**：照片输入、预览、故事和理解中状态；不宣称 Agent 成功。
2. **US2**：结构化结果、部分结果与可恢复错误；演示来源清晰。
3. **US3**：自然语言修正、一键确认、04 占位交接与草稿清理；构成 SDD-02 的完整验收边界。
4. **Polish**：02、03 画面和主要跳转验收，静态检查与 `progress.md` 同提交更新。

## Notes

- `[P]` 仅表示明确可在不同文件并行的任务；同一 `create-flow.tsx`、`app/globals.css` 和 `lib/memory/adapter.ts` 的任务按编号顺序执行。
- 本任务单不新增自动化测试框架；独立验收结果写入 `specs/003-agent-memory-understanding/verification/`。
- 外部 Pi Agent 的真实地址、鉴权和供应商错误码尚未提供；实施不得用演示结果冒充真实调用，也不得为了等待凭证停掉可用的 SDD-02 演示路径。


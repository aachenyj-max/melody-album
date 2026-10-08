# Tasks: SDD-07 MVP 验收、硬化与上线

**Input**: [spec.md](spec.md)、[plan.md](plan.md)、[research.md](research.md)、[data-model.md](data-model.md)、[photo-transfer.md](contracts/photo-transfer.md)、[release-gates.md](contracts/release-gates.md)、[quickstart.md](quickstart.md)

**Prerequisites**: SDD-05 已完成；SDD-06 正在同一工作区实施。实施时先读取当前 `node_modules/next/dist/docs/` 的相关指南，并保留其他阶段的未提交改动。本清单按执行结果勾选；上传签名自然到期补验与最终阶段交付保留未完成。

**Tests**: 项目宪章不要求新增自动化测试。本清单采用真实浏览器、接口、Storage、部署及四项现有质量命令留存验收证据。临时脚本和截图放 `.sdd00-work/`，脱敏摘要放本特性的 `verification/`。

**Task format**: `- [ ] TNNN [P?] [US?] 动作和精确文件路径`。`[P]` 仅标记可同时处理且无同文件依赖的任务；`[US1]`、`[US2]`、`[US3]` 对应规格中的用户故事。

## Phase 1: Setup（现状与目标）

**Purpose**: 冻结可核对的实施基线，不把 SDD-06 在途内容当成已通过的发布证据。

- [X] T001 [P] 在 `specs/008-release-and-deploy/verification/baseline.md` 记录 Git 提交、工作区改动归属、`progress.md` 中 SDD-05/06 状态和 SDD-05 验收证据；保留 SDD-06 在途文件。
- [X] T002 [P] 阅读 `node_modules/next/dist/docs/` 中本机版本的 App Router Route Handler、环境变量、部署及缓存指南，并在 `specs/008-release-and-deploy/verification/next-guidance.md` 记录影响本阶段实现的约定与路径。
- [X] T003 [P] 只读核对 Vercel 团队、项目、生产分支/域名、区域、套餐、Function 限制、部署保护、现有可用部署及 Supabase 项目；将脱敏结果和未知项写入 `specs/008-release-and-deploy/verification/deployment.md`。
- [X] T004 [P] 在 `specs/008-release-and-deploy/verification/README.md` 建立 FR-001–FR-012、SC-001–SC-008 与证据文件的索引，统一 `pass/fail/blocked/not_run`、环境、提交、部署 ID、时间和来源模式字段，初始状态均为 `not_run`。

## Phase 2: Foundational（共同边界）

**Purpose**: 先固定现有身份、数据和发布前置条件，再修改照片传输或判断上线。

- [X] T005 核对 `lib/albums/contract.ts`、`lib/albums/save.ts`、`lib/albums/repository.ts`、`supabase/migrations/` 的现有 owner、requestId、`pending/ready/failed`、私有路径和旧相册读取语义；把兼容映射写入 `specs/008-release-and-deploy/verification/photo-transfer.md`。
- [X] T006 [P] 核对 `lib/albums/identity.ts`、`app/api/albums/route.ts`、`app/api/albums/[id]/photos/[index]/route.ts` 的同源与会话边界，在 `specs/008-release-and-deploy/verification/security.md` 列出上传、提交、列表、详情、照片和维护入口的允许/拒绝矩阵。
- [X] T007 核对 `progress.md` 与 `specs/007-agent-workbench/verification/` 的 SDD-06 完成状态；把未完成的口令、运行、隔离、30 天清理或调度条件记在 `specs/008-release-and-deploy/verification/security.md`，并作为 US3 发布阻断，不阻止 US1/US2 的本地硬化。

**Checkpoint**: T005–T007 完成后可分别实施 US1、US2。2026-10-08 用户明确不等待 SDD-06 真人试用；US3 采用已完成的技术验收作为前置，保留真人样本 0 的事实。

## Phase 3: User Story 1 — 真实照片主链路与刷新回读（P1，首个可演示增量）

**Goal**: 1–9 张真实照片直传私有 Storage，应用函数只处理小体积控制数据；可播放音乐保存后沿 07→08→09 刷新复开，来源如实保留。

**Independent Test**: 在目标环境按 01→02→03→04→05→06→05→07→08→09 完成一组真实照片，刷新后比对标题、时间、照片数、短句、音乐和来源；再测 9 张、单张近 10 MiB、合计近 50 MiB、重复请求、上传中断及 AI 失败时 QQ mock 可播路径。

- [X] T008 [P] [US1] 在 `supabase/migrations/20261008024253_album_direct_upload.sql` 以兼容旧记录的可空字段保存待上传照片清单/摘要及过期清理所需时间；保留现有 `memory_albums` 幂等唯一性、RLS 和 `ready` 旧相册读取能力。
- [X] T009 [P] [US1] 在 `lib/albums/contract.ts` 增加小体积上传清单与提交 JSON 的验证：1–9 张、JPEG/PNG/WebP、单张 ≤10 MiB、合计 ≤50 MiB、文件名/摘要格式、已有音乐可播与来源规则；拒绝客户端 owner、bucket 和自选路径。
- [X] T010 [US1] 在 `lib/albums/repository.ts` 增加 owner 限定的待保存记录读取/创建、固定 `albums/{albumId}/{position}` 路径和原子状态推进辅助；依赖 T008–T009，重复 requestId 同摘要复用同一相册、不同摘要报冲突。
- [X] T011 [US1] 在 `lib/albums/upload-transfer.ts` 实现上传 intent：重验保存快照、照片清单和当前身份，只为待传固定路径签发短时不可覆盖的私有上传 token；重试只补发缺失项，不记录 token。
- [X] T012 [US1] 在 `app/api/albums/upload-intent/route.ts` 接入 T011，要求同源、当前会话和 `no-store`，输出小体积响应及脱敏的 400/401/403/409/413/503 错误。
- [X] T013 [US1] 在 `components/music-album/save-flow.tsx` 使用现有 `lib/supabase/client.ts` 对原始照片计算摘要、请求 intent 并按固定顺序 `uploadToSignedUrl`；保留表单/requestId/有效音乐和逐张重试入口，上传完成前不得显示保存成功。
- [X] T014 [US1] 在 `lib/albums/save.ts` 增加小体积 JSON 提交：按 owner/requestId/清单锁定本次记录，服务端读取并核对私有对象的路径、大小、类型、文件头及摘要，沿用音乐/推荐/运行记录写入，最后才标 `ready`；缺失或不符可重传，重复成功返回同一 albumId，不删除可重试对象。
- [X] T015 [US1] 在 `app/api/albums/route.ts` 接入 T014 的 JSON 提交及既有 `{albumId,alreadySaved}` 响应；保留旧 multipart 兼容读取期，但目标环境的原图主链路不得依赖应用函数搬运图片。
- [X] T016 [US1] 在 `lib/albums/repository.ts` 将照片读取改为先查当前 owner 的 `ready` 相册及合法索引，再为对应私有对象签发短时读取地址；兼容旧相册路径，不在列表/详情 DTO 泄露 Storage 路径。
- [X] T017 [US1] 在 `app/api/albums/[id]/photos/[index]/route.ts` 将合法照片请求改为 `private, no-store` 的短时重定向，无权/未知统一 404，应用函数响应不包含原图。
- [X] T018 [US1] 在 `lib/albums/cleanup.ts` 只枚举超过 24 小时仍未发布的 `pending/verifying/failed/cleaning` 服务端记录并清理其固定私有路径与记录；逐项失败可重试，重新确认状态后才删除，绝不删除 `ready` 或其他用户对象。
- [X] T019 [US1] 在 `app/api/albums/maintenance/route.ts` 以服务端 `CRON_SECRET` 校验调度请求，调用 T018，拒绝缺失/错误 token 并只返回脱敏数量与状态。
- [X] T020 [US1] 在 `vercel.json` 增加相册清理调度并保留项目中已有的调度配置，在 `.env.example` 只补充 `CRON_SECRET` 名称与用途，不填密钥值；核对目标套餐支持的实际调度频率。
- [ ] T021 [US1] 按 `contracts/photo-transfer.md` 在 `specs/008-release-and-deploy/verification/photo-transfer.md` 记录 1/9 张、近 10/50 MiB、函数 4.5 MB、同 requestId 重试/冲突、断传/过期/缺失/篡改、旧相册和超过 24 小时清理的实测结果；临时测试素材只放 `.sdd00-work/`。
- [X] T022 [US1] 在 `specs/008-release-and-deploy/verification/main-flow.md` 记录真实照片 01→09、保存后刷新 08/09 及六项回读字段；只有实际到达目标环境并完成全程才记 `pass`。
- [X] T023 [P] [US1] 核对 `lib/memory/`、`lib/music/generator.ts`、`lib/music/mock-recommendations.ts` 与保存详情展示，在 `specs/008-release-and-deploy/verification/sources.md` 分别记录 Agent demo、fal.ai API/demo、QQ mock、等待音乐和已验证可播放成品的实际来源；外部服务失败不得混记为真实成功。
- [X] T024 [US1] 在 `specs/008-release-and-deploy/verification/main-flow.md` 单独记录 AI 失败但 QQ mock 可播时的选择、播放、保存、刷新回读及 AI 失败状态保留；依赖 T022–T023。

**Checkpoint**: US1 可独立演示原图保存、刷新回读和失败兜底；这只是待发布增量，不能跳过 US2/US3 发布。

## Phase 4: User Story 2 — 九页原型与状态恢复（P1）

**Goal**: 01–09 的视觉、层级、按钮和主要跳转符合对应 PNG 与 HTML；失败或空状态能继续、重试或返回。

**Independent Test**: 逐页在 320/375/430 px 和较大字体下对照 `designs/ui/` 的 01–09 PNG、`音乐相册-ui还原.html` 的热点；触发正常、慢响应、AI 失败但推荐可播、保存失败及历史读取失败五类状态，核对 0 次假成功。

- [X] T025 [US2] 对照 `designs/ui/` 的 01–09 PNG、`音乐相册-ui还原.html` 和 `components/music-album/design-map.ts`，在 `specs/008-release-and-deploy/verification/browser.md` 建立九页 × 三宽度的视觉/热点矩阵，标明既有 05 文案与保存热点差异。
- [X] T026 [P] [US2] 在 `components/music-album/create-flow.tsx` 与 `components/music-album/result-flow.tsx` 修复 T025 发现的创建、理解、结果页等待/失败/空状态及返回后有效输入保留问题，维持 02–04 对应 PNG 结构。
- [X] T027 [P] [US2] 在 `components/music-album/play-flow.tsx` 与 `components/music-album/adjust-flow.tsx` 修复 T025 发现的播放/调整状态、手动开始、失败候选不抢播及离页停声问题，维持 05–06 对应 PNG 结构。
- [X] T028 [P] [US2] 在 `components/music-album/save-flow.tsx`、`components/music-album/memories-flow.tsx`、`components/music-album/detail-flow.tsx` 修复 T025 发现的保存失败、列表空/失败、详情读取失败与重试/返回入口，维持 07–09 结构和 07→08→09 跳转；待 T013 对保存页改动完成后再编辑同文件。
- [X] T029 [US2] 如 T025 发现主要热点差异，在 `components/music-album/design-map.ts` 修正目标并同步 `specs/001-app-shell/contracts/ui-navigation.md`；保留仅 01、08 的底部导航及 05 已确认的文案/热点规则。
- [X] T030 [US2] 如 T025–T029 发现布局或可达性偏差，在 `app/globals.css` 修复 320/375/430 px、较大字体、减弱动态效果及键盘操作下的阻断问题，不改九页编号和主要结构。
- [X] T031 [US2] 在 `specs/008-release-and-deploy/verification/browser.md` 填写 27 个视口组合的布局、层级、配色、字体、图片位置、文案、无横向溢出与热点实测；临时截图放 `.sdd00-work/`，仅非阻断差异可带理由保留。
- [X] T032 [US2] 在 `specs/008-release-and-deploy/verification/browser.md` 记录加载/空数据/失败/返回/重试以及五类必测场景，每类至少一个可执行继续动作且无假成功；依赖 T026–T031。

**Checkpoint**: US2 可独立按九页视觉和交互矩阵验收；US1 的真实保存改变后，07–09 相关项需在目标环境复测。

## Phase 5: User Story 3 — 安全发布与恢复（P1）

**Goal**: 质量、隐私、工作台隔离与前置阶段都通过后，验证待发布生产构建，发布同一部署并留下可核实恢复记录。

**Independent Test**: 对最终提交跑四项质量命令；未授权身份无法获取密钥、他人照片地址和工作台数据；候选 URL 与正式域名各跑主链路，部署 ID 一致，按实际前版状态核实恢复步骤。

- [X] T033 [US3] 依据 SDD-06 已完成的技术验收与 `specs/007-agent-workbench/quickstart.md`，在 `specs/008-release-and-deploy/verification/security.md` 核对口令关闭/错误/正确、运行隔离、240 秒预算、30 天清理与正式 HTTPS 维护调度；真人试用按用户 2026-10-08 指示不阻断发布，技术条件任一未验证则保留发布阻断。
- [X] T034 [US3] 对照 `contracts/release-gates.md` 和 `.env.example`，在 `specs/008-release-and-deploy/verification/deployment.md` 记录目标环境每项公开/服务端变量的名称、范围、存在性和配置版本；核对 `CRON_SECRET` 与 SDD-06 维护令牌独立，不读取或输出值。
- [X] T035 [US3] 以两个隔离身份及未授权访客检查 `app/api/albums/`、`app/api/internal/`、`app/internal/`、公开页面、bundle、网络响应和错误输出，在 `specs/008-release-and-deploy/verification/security.md` 记录 owner 隔离、照片签名地址和服务端凭证泄露数量（目标为 0）。
- [X] T036 [US3] 在最终拟发布提交执行 `npm run format`、`npm run lint`、`npm run tscheck`、`npm run build`；将命令、退出状态、提交/工作区状态和修复复测结果写入 `specs/008-release-and-deploy/verification/quality.md`，格式化或 lint 修改后重新核对构建输入。
- [X] T037 [US3] 本地质量与安全门槛通过后，按 `specs/008-release-and-deploy/quickstart.md` 用生产配置创建不自动指向正式域名的 Vercel 待发布构建，在 `specs/008-release-and-deploy/verification/deployment.md` 记录项目、提交、配置版本、部署 ID、URL 与构建结果。T021–T024、T031–T035 的目标宿主部分依赖此候选 URL，在 T038 完成，全部通过后才允许 T039。
- [X] T038 [US3] 在待发布 URL 重跑真实照片 01→09、近 10/50 MiB、五类状态、身份隔离、工作台拒绝访问和调度可达性；把每项实际结果及部署 ID 写入 `specs/008-release-and-deploy/verification/deployment.md`，失败则修复并重建重测。
- [X] T039 [US3] 仅在 T038 全部强制门槛通过后，将同一已验收部署 ID 指向正式域名；在 `specs/008-release-and-deploy/verification/deployment.md` 记录发布操作、URL、时间、部署 ID 与变化；若平台重建则重新验收新构建。
- [X] T040 [US3] 在正式域名完成一次真实照片全链路、刷新回读、跨身份照片拒绝、工作台拒绝和维护调度检查，查看关键错误日志；将结果、真实/demo/mock 来源和已知限制写入 `specs/008-release-and-deploy/verification/deployment.md`。
- [X] T041 [US3] 在 `specs/008-release-and-deploy/verification/rollback.md` 记录前一个已验证可用部署 ID、平台恢复步骤及正式域名/Supabase schema、Storage、变量和调度的复核；若首次发布无前版，明确写“无可回滚前版”，不得宣称已演练恢复。

**Checkpoint**: US3 只有在候选与正式域名的实测均通过、发布版本与来源范围可追溯时完成；阻断项记 `blocked/fail`。

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T042 对照 `specs/008-release-and-deploy/spec.md` 的 FR-001–FR-012、SC-001–SC-008 和 `contracts/release-gates.md`，在 `specs/008-release-and-deploy/verification/README.md` 逐项链接真实证据、部署 ID、结果与未完成项，不以计划或旧截图替代执行结果。
- [X] T043 在 `specs/008-release-and-deploy/verification/quality.md` 记录 `git diff --check`、最终改动审阅及与 T036 构建输入一致的提交；只处理本阶段改动，不覆盖 SDD-06 在途文件。
- [ ] T044 仅当 T042 的全部强制门槛通过，按 `AGENTS.md` 在同一提交更新 `progress.md` 的 SDD-07 完成条件、验证结果、限制、部署地址和下一阶段；如未通过，在 `progress.md` 的“备注与阻塞”记录原因，保持 SDD-07 未完成。

## Dependencies & Execution Order

- **Setup → Foundation**: T001–T004 完成后执行 T005–T007；其中 `[P]` 项写入不同证据文件，可独立核对。
- **US1**: T008 与 T009 可并行；T010 依赖两者；T011→T012→T013 是签发/直传链；T014→T015 是核对/发布链；T016→T017 是私有读取链；T018→T019→T020 是清理/调度链。T021–T024 在相应链路可运行后取证。`lib/albums/repository.ts` 的 T010 与 T016 顺序执行。
- **US2**: T025 建矩阵后，T026、T027 可并行；T028 先等 T013 结束，避免同时编辑保存页；T029–T032 完成修正与复测。US2 不以 US1 完成为起点，但最终 07–09 须测直传后的版本。
- **US3**: T033 的 SDD-06 技术验收是发布硬门槛，真人试用按用户指示不阻断；T034–T036 可准备证据，但 T037 必须等 US1、US2 和全部前置门槛通过；随后 T038→T039→T040→T041。不得把本地或预览构建的成功直接推断为正式域名通过。
- **Final**: T042–T044 依赖全部目标故事及线上证据。若外部权限或配置缺失，将对应项写为 `blocked`，不提前勾选上线。

## Parallel Examples

- T001、T002、T003、T004 写入不同证据文件，可分别采集代码基线、Next 指南、托管目标和证据索引。
- T008 的兼容迁移与 T009 的输入验证写入不同文件，可在 T010 之前完成。
- T026 的创建/结果状态与 T027 的播放/调整状态写入不同组件，可在 T025 之后并行；T028 涉及 `save-flow.tsx`，须等 T013。
- T023 的来源矩阵只读核对，与 US1 直传服务端开发可并行；T035 的未授权检查须在相关接口可运行后执行。

## Implementation Strategy

1. **首个可演示增量**：完成 Setup、Foundation 和 US1，在本地及目标宿主验证真实照片、幂等保存、旧相册兼容及刷新回读。此时仍不标记 SDD-07 已发布。
2. **体验与边界**：完成 US2 的 27 视口、主要热点及五类状态；按 SDD-06 已完成的技术验收执行 US3 的工作台、密钥和身份门槛。
3. **上线**：四项质量检查与候选生产构建验收通过后才发布同一部署，在正式域名复测并留恢复记录；最后按真实证据更新 `progress.md`。

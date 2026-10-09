# 任务：创建相册的连续 Agent 对话

**Input**: [spec.md](spec.md)、[plan.md](plan.md)、[research.md](research.md)、[data-model.md](data-model.md)、[contracts](contracts/)、[quickstart.md](quickstart.md)
**Status**: 技术实现与验收 39/39；代码、两份数据库迁移及证据已完成，本地交付提交，尚未部署。
**Organization**: 基础设施→四个用户故事→跨流程交付。验证任务是既有质量门槛与场景验收，不引入新测试框架。

## Phase 1：准备

- [x] T001 核对 node_modules/next/dist/docs/ 的路由、异步 cookies、查询参数指南及 Supabase 最新迁移/Storage 文档，将实施前结论记入 specs/009-creation-dialogue/research.md；写 SQL 前加载 supabase-postgres-best-practices 技能。
- [x] T002 核对 designs/ui/02-创建音乐相册-上传照片.png、03-创建音乐相册-Agent记忆理解.png 与 音乐相册-ui还原.html，将用户批准的消息/卡片覆盖同步到 AGENTS.md、specs/001-app-shell/contracts/ui-navigation.md 和 components/music-album/design-map.ts，不改原 06 流程。

## Phase 2：共用基础（阻塞所有故事）

- [x] T003 在 lib/creation/contract.ts 定义草稿/消息/轮次/照片/卡/快照 DTO 与校验：版本非负、seq/卡版本正整数、用户文字 1–1000 字、回复最多 4000 字、照片 0–9（生成 1–9）、JPEG/PNG/WebP/10 MiB 单张/50 MiB 总量，MusicProfile 15–30 秒和 memoryVersion 一致。
- [x] T004 通过 Supabase CLI migration new 在 supabase/migrations/ 创建creation_drafts JSONB 聚合表及 CAS RPC/private bucket（逻辑消息/turn/照片/卡/confirmation 随 CAS 原子提交）：ownerKey 校验、RLS、无 anon/authenticated/PUBLIC 执行权限，clientMessageId/requestId/seq/卡版本/同卡 confirmation 唯一；只实施获授权的创建数据范围。
- [x] T005 在 lib/creation/repository.ts 实现归属读取、接收输入/照片事务、卡 stale、单 active turn、60 秒租约、token+revision 提交及安全错误；每次成功活动更新 30 天到期，消息内容不可改写。
- [x] T006 在 app/api/creation/drafts/route.ts 和 app/api/creation/drafts/[id]/route.ts 实现幂等创建与私有恢复读取，复用 lib/albums/identity.ts，写请求 sameOrigin、UUID 校验、no-store，冻结用户发布配置，不泄露内部配置或凭据。
- [x] T007 在 lib/creation/photos.ts 和 app/api/creation/drafts/[id]/photos/route.ts 实现限定对象 prepare/直传/commit 与实际格式字节归属校验，初次有效上传追加 photo_change+pending 观察轮次；旧保存音乐接口不用于空草稿。

**Checkpoint**: 服务端可创建归属草稿、持久化照片和消息，无浏览器直读私有表；尚未冒充完成连续聊天。

## Phase 3：US1 连续真实对话（P1，最小演示切片）

**Goal**: 先观察、按上下文聊、多轮消息不覆盖。
**Independent Test**: 两组真实照片，各五轮对话，早先纠正仍有效，历史逐条可读。

- [x] T008 [P] [US1] 在 lib/agent/dialogue-config.ts 定义独立有版本 dialogue prompt/skill，允许自然回复/最多一个关键追问/用户委托建议；冻结到草稿 digest，避免直接使用 MEMORY_PROMPT 的“只提交工具、不读取历史”指令。
- [x] T009 [US1] 在 lib/agent/dialogue-runtime.ts 复用现有 Pi 1.0.3 provider/model/release 边界，按序重放完整文字/成功上下文、仅注入当前照片；45 秒和内部工具最多 3 次，文本上下文含系统/历史/卡不超过 64000 字符，超限明确错误、不截掉早先纠正，零照片不编造视觉结论。
- [x] T010 [US1] 在 lib/creation/dialogue.ts、app/api/creation/drafts/[id]/messages/route.ts 和 [id]/turns/[turnId]/execute/route.ts 实现先存 user+turn 再执行/成功原子追加 assistant，使用 clientMessageId 幂等且处理期间拒新发送；错误脱敏并保留本轮输入。
- [x] T011 [P] [US1] 在 components/music-album/creation-dialogue.tsx 实现按 seq 渲染的双方气泡、真实状态/错误槽、滚动消息区、底部跟随/历史阅读位置保持，输入与消息身份独立，不渲染假用户故事。
- [x] T012 [US1] 在 components/music-album/create-flow.tsx 接入草稿 API/自动首轮观察/自由发送，删除 sample 结论与四固定建议，保留欢迎和真实处理提示，02/03 共用一段消息流。
- [x] T013 [US1] 在 app/globals.css 保留 02/03 外壳/照片/玻璃气泡/绿色风格，布局容纳长回复、稳定输入、较大字体、320/375/430 与软键盘；不添加用户底栏或桌面历史侧栏。
- [x] T014 [US1] 执行 quickstart US1 的两段真实 Pi/Qwen 五轮对话，记录 source、消息 id/顺序/早期纠正与追问数到 specs/009-creation-dialogue/verification/live.md；demo 和真实失败分开，不替代真人样本。

## Phase 4：US2 最新方向确认与生成（P1）

**Goal**: 卡追加、旧卡标记、音乐依据用户确认方向。
**Independent Test**: 修改情绪/曲风形成两张卡，旧卡禁用，新卡交接 04 的音乐方向一致。

- [x] T015 [US2] 在 lib/agent/dialogue-runtime.ts 加可选 propose_music_direction 工具，提交 normalizeProfile/validateMusicProfile 校验的 memory/music/summary；每轮最多一张卡、零照片不提案，非法结果失败不发布卡。
- [x] T016 [US2] 在 lib/creation/dialogue.ts 和 lib/creation/repository.ts 实现卡版本追加及依赖 messageRevision/photoRevision、latest pointer、stale→superseded，卡正文不可覆盖，旧助手消息不改写。
- [x] T017 [P] [US2] 在 components/music-album/creation-direction-card.tsx 展示记忆/情绪/曲风/编曲、“待更新”“已更新”和“按这个生成”，只有最新有效卡且无未处理输入才可点确认；集成 components/music-album/creation-dialogue.tsx。
- [x] T018 [US2] 在 app/api/creation/drafts/[id]/confirm/route.ts 和 lib/creation/repository.ts 实现 latest+revision+无未处理输入的 CAS，唯一同卡 confirmation、不可变 snapshot、重复确认回原结果，旧卡 409，不调用音乐模型。
- [x] T019 [US2] 在 components/music-album/creation-session.tsx、music-session.tsx 与 lib/music/contract.ts 扩展确认输入 snapshotId/draftId/MusicProfile，新增链路直接使用确认方向，legacy 才用 toMusicProfile，保留唯一音频控制与防重复 start。
- [x] T020 [US2] 在 app/api/music/generate/route.ts 归属加载服务端 confirmation，使用其 music 而非客户端任意 profile；在 components/music-album/result-flow.tsx 承接 draft/snapshot 路径，维持 04→05→07 现有逻辑。
- [x] T021 [US2] 对照 quickstart US2 完成两卡/旧卡/重复确认/曲风实际交接及生成→播放→保存回归，将证据记入 specs/009-creation-dialogue/verification/confirmation.md，核对保存照片与曲风快照。

## Phase 5：US3 刷新与返回恢复（P1）

**Goal**: 同会话恢复独立草稿，不新增聊天历史列表。
**Independent Test**: 三次刷新、离开返回、重开标签以及两段草稿隔离。

- [x] T022 [US3] 在 components/music-album/creation-session.tsx 和 create-flow.tsx 实现最后草稿 id 恢复与 query 指定草稿、服务端重建照片预览，取消离开清空业务草稿；File/objectURL 只作当前视图缓存，卸载释放缓存但不删除服务端内容。
- [x] T023 [US3] 在 components/music-album/album-screen.tsx、bottom-nav.tsx 和 design-map.ts 将首页明确创建入口标记新建，生成新 requestId/draftId 后移除 new 标志，普通 /create 返回恢复最后草稿；state 仅视觉，无路径重排。
- [x] T024 [US3] 在 app/api/creation/drafts/[id]/snapshot/route.ts 与 components/music-album/result-flow.tsx 按归属恢复不可变确认输入和快照照片，重新签发读取地址；/result 刷新不误用最新未确认卡，不承诺新增音乐作业恢复。
- [x] T025 [US3] 在 components/music-album/creation-session.tsx 与 lib/creation/repository.ts 实现 active turn 轮询、响应丢失读取、60 秒租约过期 interrupted、待用户重试，不因刷新自动重跑付费模型；区分未发送和已接收。
- [x] T026 [US3] 按 quickstart US3 验恢复/新建/双草稿和两 cookie 身份越权，记录到 specs/009-creation-dialogue/verification/recovery.md，确认 UUID/短时签名不构成任意草稿访问权限。

## Phase 6：US4 照片变更与失败保留（P1）

**Goal**: 修改照片和失败后仍保留历史，重试不重复，迟到结果不污染。
**Independent Test**: 有卡后增删照片与三种失败重试，再验证竞争/过期结果。

- [x] T027 [US4] 在 lib/creation/photos.ts 和 repository.ts 完成集合变更/删除至零/顺序重映射，photoRevision 变化令旧卡 stale、旧 turn superseded；新照片轮包含尚未成功处理的用户约束，不能静默丢失败消息。
- [x] T028 [US4] 在 components/music-album/create-flow.tsx 保留管理照片入口，展示真实变更消息/上传准备/失败、刷新预览、零照片禁用生成；变更未 commit 前不假报成功，并忽略旧 photoRevision 的迟到回应。
- [x] T029 [US4] 在 lib/creation/dialogue.ts 和 repository.ts 实现 failed/interrupted 同 turn 重试、attempt+1、token fencing/版本检查、重复执行已成功轮回原结果；live 失败不得静默 demo，pending/失败时旧卡不可生成。
- [x] T030 [US4] 在 components/music-album/creation-dialogue.tsx 和 creation-session.tsx 接通原轮失败/重试、同 clientMessageId 网络重发及双标签冲突后的重新读取，不清用户消息/未发送文字、不多插 user。
- [x] T031 [US4] 在 lib/creation/photos.ts 实现 removed/cleanup_pending 对象回收，已确认快照引用的对象延后回收；移除图不再注入 Agent；保存相册媒体由既有保存流程独立复制，不被草稿清理误删。
- [x] T032 [US4] 用隔离夹具验 timeout/unavailable/invalid-result、双击/重复重试/双标签/响应丢失/改图迟到/零图，将结果写入 specs/009-creation-dialogue/verification/failures.md；凭据和临时脚本仅 .sdd00-work/。

## Phase 7：跨故事验收与交付

- [x] T033 在 lib/creation/cleanup.ts、lib/albums/cleanup.ts 和 app/api/albums/maintenance/route.ts 接续现有受保护维护入口，30 天到期先拒读，再删草稿关系/照片，失败可重试且不误删保存相册或工作台。
- [x] T034 按 specs/009-creation-dialogue/quickstart.md 在隔离草稿验到期访问、照片删除失败/重试、确认快照引用保护及已保存照片独立性，将证据写入 verification/maintenance.md。
- [x] T035 对照 designs/ui/02/03 PNG 与 contracts/ui-navigation.md 验 320/375/430、较大字体、软键盘、长回复、两卡与历史阅读；核对 02→03→04、返回恢复和 04–09 回归，记录 verification/visual.md。
- [x] T036 完成 Supabase MCP select 1 as connected、新增表/RPC/RLS/bucket权限核对和浏览器密钥扫描，在 specs/009-creation-dialogue/verification/security.md 记录结果，确认内部工作台权限未被复用为公共权限。
- [x] T037 运行 npm run format、npm run lint、npm run tscheck、npm run build，修复变更阻塞项，将命令结果和既有非阻断警告写入 specs/009-creation-dialogue/verification/README.md。
- [x] T038 在 specs/009-creation-dialogue/verification/README.md 汇总 FR-001–018/SC-001–008 逐项证据，真实两段对话与故障夹具明确区分；未满足项保留 tasks.md 未勾选，不假报发布或真人试用。
- [x] T039 在同一交付提交更新 progress.md 的 SDD-08 完成条件、验证、限制和下一阶段，以及 AGENTS.md 的实际创建对话基线；仅完成技术条件才勾阶段，未部署状态明确保留。

## Dependencies & Execution Order

准备 T001–002 → 基础 T003–007 → US1 T008–014 → US2 T015–021 → US3 T022–026 → US4 T027–032 → T033–039。

- T004 依赖 T003；T005 依赖 T004；T006/007 依赖 repository 与契约。
- US1 的 T008 和 T011 可并行；T009 依赖 T008，T010 依赖 T009，T012 依赖 T010/T011；T013 与 T014 顺序验收。
- US2 的 T017 可与 T015/T016 并行，先按稳定 DTO 开发卡组件；T018 后执行 T019/T020。US1 完成后可用持久消息夹具独立验 US2。
- US3 使用基础草稿与快照端点，可用已持久化夹具独立验恢复；与 US2 有 integration 依赖，同组件修改不得并行。
- US4 在基础层已有版本/幂等约束上补齐失败与照片竞争，可用隔离草稿夹具独立验，不需要每次付费生成。
- 同路径任务串行。US1/US2 的 [P] 是实施机会，不表示本轮已启动代码代理。

## Parallel Examples

US1：T008 对话配置与 T011 消息组件，文件互不冲突。US2：T015/T016 服务端卡流程与 T017 卡组件，DTO 已固定。US3：T026 的权限证据整理可在 T025 收尾后与恢复截图整理并行。US4：T031 照片回收与 T030 客户端重试在 T027/T029 契约固定后可分工；没有标 [P] 的依赖任务不要提前启动。

## Implementation Strategy

US1 是最小可演示切片，不等于完整交付；全部四故事均为用户已确认范围，不得止步于前端气泡。先落地服务端追加/归属/版本，再逐层接 UI 和既有音乐链路。提交以逻辑切片为单位；不在规划阶段迁移、生成音频、部署或制造验收记录。

## 需求追踪

| 范围 | 任务 | 验收 |
|---|---|---|
| FR-001/002/003/004/005 | T002、T008–014 | SC-001/002 |
| FR-006/007/008/009 | T015–021、T024 | SC-004/008 |
| FR-010/011/012 | T003–007、T022–026、T036 | SC-003/008 |
| FR-013/014/015/016 | T007、T025、T027–034 | SC-004/005/006 |
| FR-017/018 | T002、T011–013、T017、T035 | SC-007 |

任务统计：共 39；共享 14（准备 2、基础 5、收尾 7）；US1 7、US2 7、US3 5、US4 6；标记 [P] 3。实施状态以各复选项为准，格式为 checkbox+连续 ID+故事标签（故事阶段）+明确文件路径。

---

description: "内部 Agent 工作台实施任务"
---

# Tasks: 内部 Agent 工作台

**Input**: `specs/007-agent-workbench/` 中的 [spec.md](spec.md)、[plan.md](plan.md)、[research.md](research.md)、[data-model.md](data-model.md)、[HTTP 契约](contracts/workbench-api.md)、[Pi 契约](contracts/pi-runtime.md) 与 [quickstart.md](quickstart.md)。

**Prerequisites**: 按 `progress.md` 核对前置阶段；SDD-03 的 `lib/music/` 当前仍有未提交、未验收内容。保留用户现有改动。执行任何 Supabase 迁移前核对当前 changelog、官方文档、项目 schema 和权限；执行任何 Next.js 代码前阅读 `node_modules/next/dist/docs/` 中对应的 Route Handler、cookies、动态参数、安全与运行时指南。

**Tests**: 规格未要求新增自动化测试框架。本清单包含按 `quickstart.md` 的手工端到端、故障、权限、清理和部署验证任务；未完成的真实供应商验收必须如实记录，不能用 demo 代替。

**Organization**: Phase 1/2 为共享基础；Phase 3–5 分别对应 US1、US2、US3。每个任务均以具体文件或迁移目录为交付位置。`[P]` 仅标识不同文件且无未完成依赖的工作。

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 锁定既有边界、SDK 和环境模板，不改用户端业务语义。

- [ ] T001 在 `specs/007-agent-workbench/verification/baseline.md` 核对 `progress.md`、当前 `lib/memory/`、`lib/music/` 和未提交改动，记录 SDD-03 的实际契约与演示/真实状态、Next.js 本地指南及 Supabase 文档版本；不得把草稿写成已验收能力。
- [ ] T002 [P] 在 `package.json` 与 `package-lock.json` 精确固定 `@earendil-works/pi-agent-core=1.0.3`、`@earendil-works/pi-ai=1.0.3` 和 Node `>=22.19`，仅安装这两个 SDK 包并验证 ESM 导入与现有构建，不添加 Pi CLI/TUI 或不相关依赖。
- [ ] T003 [P] 在 `.env.example` 补齐 `WORKBENCH_ACCESS_PASSWORD`、`WORKBENCH_SESSION_SECRET`、`WORKBENCH_PUBLIC_ORIGIN`、`WORKBENCH_MAINTENANCE_TOKEN`、`PI_EXECUTION_MODE`、`PI_LLM_PROVIDER/MODEL/API/BASE_URL/API_KEY`、`WORKBENCH_MUSIC_MODE` 的用途和 demo 默认值；不填真实密钥，不新增浏览器可见密钥。

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 建立全部故事共用的服务端配置、鉴权、私有存储和运行状态边界。

**⚠️ CRITICAL**: 此阶段完成前不得开放内部页面或运行接口。

- [ ] T004 在 `lib/workbench/contract.ts` 定义契约版本 1、`internal_test`、六阶段 `input/memory/music_profile/ai_music/qq_recommendations/summary`、运行状态 `uploading/queued/running/succeeded/partial/failed/interrupted`、阶段状态 `pending/running/succeeded/failed/skipped/interrupted`、脱敏 DTO、错误码和请求校验；JSON 最大 16 KiB，拒绝未知执行字段。
- [ ] T005 [P] 在 `lib/workbench/auth.ts` 实现独立口令、至少 32 字节 session secret、固定 8 小时签名 HttpOnly/SameSite=Strict/Path=/ 会话、HTTPS Secure、口令轮换失效、定长摘要比较和固定 `WORKBENCH_PUBLIC_ORIGIN` 检查；未配置人类凭证时关闭全部人类页面/API，机器维护凭证单独校验。
- [ ] T006 [P] 在 `lib/supabase/admin.ts` 新建 `server-only` 的服务端特权客户端，仅从手动配置的 `SECRET_KEY` 读取密钥；不得复用浏览器客户端、用户 cookie 或将特权客户端导入 Client Component。
- [ ] T007 在 `lib/workbench/config.ts` 建立受控配置版本注册、当前配置与不可变 `ConfigSnapshot`/SHA-256；快照包含 prompt/loop/skill/tool/SDK/契约版本和内容哈希、非敏感模型 descriptor，限制 `maxTurns=3`、`maxOutputTokens=2048`、理解 `45000ms`、全运行 `210000ms`；排除任何 key、口令、header、带凭证 URL，并在 live 配置缺失或能力不符时返回 `CONFIG_UNAVAILABLE`。
- [ ] T008 在 `supabase/migrations/` 使用已安装 CLI 的 `migration new agent_workbench` 先取得实际文件名，再于生成的迁移文件中创建 `agent_workbench_runs`、`agent_workbench_steps`、`agent_workbench_assets` 三表：`request_id` 唯一、`kind=internal_test`、`expires_at=created_at+30 days` 不可变、六阶段联合主键、照片 `position 0–8` 且每 run 唯一、`mime_type=image/jpeg`、`byte_size>0`、独立 `storage_path`，并建 `data-model.md` 所列五组索引。
- [ ] T009 在 T008 生成的 `supabase/migrations/` 迁移文件中对三表启用 RLS，精确撤销这些对象及相关 RPC 的 `PUBLIC/anon/authenticated` 权限，只给 `service_role` 必要 CRUD/EXECUTE；创建私有 `agent-workbench-test-inputs` bucket，不开放浏览器角色对象读取，不改用户相册表策略或做 schema-wide 授权撤销。
- [ ] T010 在 T008 生成的 `supabase/migrations/` 迁移文件中加入短事务 claim/阶段写入所需受限 RPC：原子检查未过期、全部资产 ready、queued、并发执行数 `<2`，分配 `execution_token` 与 240 秒租约；每次写入核对 token、状态、租约和到期时间，外部请求期间不持数据库锁，旧执行者不能写终态。
- [ ] T011 在 `lib/workbench/repository.ts` 封装服务端唯一数据访问入口：所有读取按数据库时间 `expires_at>now()`；创建/状态写入用 T010 的事务边界，列表按 `created_at DESC,id DESC` 游标查询（默认 25、最大 50），未知/过期统一 404，结果脱敏且不返回 Storage 路径、执行 token、完整供应商响应。
- [ ] T012 在 `proxy.ts` 精确旁路 `/internal/agent-workbench` 与 `/api/internal/agent-workbench` 的用户端 Supabase 会话刷新；不放宽工作台自身在页面、API 和 `lib/workbench/repository.ts` 的鉴权，其他用户端路径行为保持原样。

**Checkpoint**: 表、bucket、RPC 和 DAL 的私有权限及独立会话边界通过只读/越权核验后，可开始故事任务。迁移、远端对象和 SDK 安装属于实施动作，本任务清单的生成不代表已执行。

---

## Phase 3: User Story 1 - 发起一次可追踪的测试运行 (Priority: P1) 🎯 MVP

**Goal**: 内部人员以照片和可选故事创建一次独立测试，Pi 完成理解后自动执行音乐链路，详情保留六阶段与来源。

**Independent Test**: 用 1 张及 9 张照片分别提交 demo 运行，在 10 秒内看到 ID/配置/阶段；打开详情看到 input、memory、music_profile、ai_music、qq_recommendations、summary 与工具摘要。理解无效时后续阶段 skipped；工作台之外的用户端确认流程不变。

- [ ] T013 [P] [US1] 在 `app/api/internal/agent-workbench/session/route.ts` 实现可信 Origin 验证后的 `POST` 口令登录与 `DELETE` 退出；未配置为 404、错误口令 401，成功仅设置/清除内部 cookie，不查询运行或调用工具。
- [ ] T014 [P] [US1] 在 `app/api/internal/agent-workbench/config/route.ts` 实现鉴权后的当前脱敏配置预览；缺 prompt/loop/skill/tool 版本或 live 凭证/能力时返回 503 `CONFIG_UNAVAILABLE`，绝不回传变量值。
- [ ] T015 [US1] 在 `app/internal/agent-workbench/layout.tsx` 和 `app/internal/agent-workbench/page.tsx` 建立独立页面与口令入口；未配置关闭、未认证只显示口令表单，不能依赖布局代替每页/API 鉴权，也不接入 `app/(album)` 或用户端导航。
- [ ] T016 [US1] 在 `components/agent-workbench/workbench.tsx` 实现 1–9 张源照片与可选故事的输入、顺序/摘要和配置预览；复用 `components/music-album/photo-preparation.ts` 的源图校验与 JPEG 预处理，源图单张 `<=10 MiB`、合计 `<=50 MiB`、故事 trim 后 `<=1000` 字、提交 multipart `<=3.5 MiB`，错误保留输入。
- [ ] T017 [US1] 在 `lib/workbench/repository.ts` 补创建与上传事务：服务端生成 run UUID，冻结 input/config/hash；相同 `request_id` 与 input/config 哈希返回原 run，不同哈希 409；先写 `reserved` 资产再上传 `runs/{runId}/photos/{index}.jpg`，逐张校验 JPEG 头、字节数、SHA-256 和顺序，全部 `ready` 才置 `queued`，失败保留可清理记录。
- [ ] T018 [US1] 在 `app/api/internal/agent-workbench/runs/route.ts` 实现鉴权、Origin、multipart 实际字节预算与 `POST /runs` 201/幂等 200，以及按时间/状态/运行 ID/游标的 `GET /runs`；创建请求只落库和上传，不等待模型，不允许浏览器指定 provider、URL、表或对象路径。
- [ ] T019 [P] [US1] 在 `lib/agent/models.ts` 建立受控 Pi Models/provider factory：使用 v1.0.3 `createModels`、`setProvider`、`getModel` 与 `streamSimple.bind(models)`；live 必须确认图片输入和工具能力、受支持协议及服务端 key，非法或缺失配置明确失败且不回退 demo。
- [ ] T020 [P] [US1] 在 `lib/agent/demo-provider.ts` 为每次运行创建独立 fauxProvider/provider ID，用官方 fauxAssistantMessage/fauxToolCall 经真实 Pi loop 调用 `record_memory_profile`；根据故事、照片数/顺序生成稳定演示结果，显式标 `source=demo`，不宣称模型理解照片，不读取 LLM key。
- [ ] T021 [US1] 在 `lib/agent/pi-runtime.ts` 实现每次运行独立 Agent、按序 JPEG ImageContent 和唯一 `record_memory_profile` 工具；工具 Type schema 加现有 `normalizeProfile` 双重验证，`version/source` 由服务端注入，合法工具结果先 awaited 持久化再 `terminate=true`；最多 3 轮/每轮 2048 tokens/理解 45 秒，AbortSignal、事件白名单 256 条上限和凭证/图片/思考内容脱敏。
- [ ] T022 [US1] 在 `lib/music/generator.ts` 为工作台调用补可选显式 `demo|live` mode 与 AbortSignal；保留用户端现有默认 `auto` 语义，工作台 demo 即使配置 FAL_KEY 也不收费，live 缺 key 或供应商失败不降级 demo。
- [ ] T023 [US1] 在 `lib/workbench/runner.ts` 实现 210 秒总截止和六阶段 awaited 落库：memory 有效后自动以 `toMusicProfile`/`validateMusicProfile` 形成 deterministic 意图，AI 配乐与 QQ mock 独立运行并分别保存；理解失败时依赖阶段 skipped，单路失败保留另一分支，来源为 `agent|demo|api|mock|deterministic|none`，不写用户相册。
- [ ] T024 [US1] 在 `app/api/internal/agent-workbench/runs/[id]/execute/route.ts` 实现 `maxDuration=240` 的同步 await 执行：原子 claim、并发最多 2、`RUN_BUSY/RUN_NOT_READY/CONCURRENCY_LIMIT`、终态幂等读取；请求断开尽力 abort，不能以脱离请求的后台 Promise 或 202 冒充完成。
- [ ] T025 [US1] 在 `app/api/internal/agent-workbench/runs/[id]/route.ts` 实现鉴权后的六阶段 RunDetail，历史配置与阶段结果只读，缺失、pending、skipped、interrupted 与成功分开呈现；未知/过期 ID 为不泄露数据的 404。
- [ ] T026 [P] [US1] 在 `app/api/internal/agent-workbench/runs/[id]/photos/[index]/route.ts` 实现鉴权/到期/`index 0–8`/资产 ready 检查后通过私有 Storage 下载 JPEG，同源 `private, no-store` 返回；不暴露签名 URL、Storage 路径或共享图片优化缓存。
- [ ] T027 [US1] 在 `components/agent-workbench/run-detail.tsx` 实现六阶段、工具调用的名称/阶段/请求摘要/返回状态/结果摘要/错误和来源展示；每秒轮询持久详情、终态停止，失败/中断展示重跑或返回，不渲染密钥、base64 或完整供应商响应。
- [ ] T028 [US1] 在 `app/internal/agent-workbench/runs/[id]/page.tsx` 建立带页内鉴权的详情入口，使用当前 run ID 读取持久结果与同源照片，不以静态 mock 或另一条运行补齐缺失字段。
- [ ] T029 [US1] 在 `components/agent-workbench/workbench.tsx` 补运行提交后的 `POST /runs` → `POST /execute` → `GET /runs/{id}` 流程和列表状态；创建后立即显示 ID/版本/阶段，执行失败或轮询断线只重试读取，不自动再次执行收费请求。
- [ ] T030 [US1] 按 `specs/007-agent-workbench/quickstart.md` Q2/Q3/Q6 在 `specs/007-agent-workbench/verification/us1.md` 记录 demo 的合法/非法输入、理解自动继续、失败与独立分支、未授权调用计数、20 次启动延迟和 10 次六阶段可见结果；真实模型未配置则标“未执行”。

**Checkpoint**: US1 可独立完成一次可追踪内部运行。仅 demo 通过时，不宣称真实照片理解或真实配乐通过。

---

## Phase 4: User Story 2 - 重跑并保留历史版本 (Priority: P1)

**Goal**: 从未到期记录重用独立输入副本，以当前或可执行的原配置创建新运行；旧记录只读，30 天到期后安全清理。

**Independent Test**: 对同一记录连续重跑 10 次得到 10 个不同 ID、独立照片路径与到期时间，原记录内容不变；重启仍可查看/重跑，原配置不可执行时明确拒绝，过期记录不可读取或重跑且物理清理不伤新记录。

- [ ] T031 [US2] 在 `lib/workbench/config.ts` 与 `app/api/internal/agent-workbench/config/route.ts` 补 `originalRunId` 的历史配置预览、原配置选择与受控版本注册验证：默认 current，可选 original；原 SDK/工具/契约或模型能力不再支持时返回 `CONFIG_UNAVAILABLE` 和具体原因，不从 JSON 执行代码、不静默换当前配置，不把当前凭证写入历史快照。
- [ ] T032 [US2] 在 `lib/workbench/repository.ts` 补重跑复制事务：原 run 必须未过期且资产全部 ready，新 run 有新 `request_id`/ID/`parent_run_id`/创建时间/独立 30 天到期；将每张 JPEG 复制到新路径并验证 SHA-256/顺序，保留故事快照，输入不完整或复制中到期返回 `INPUT_UNAVAILABLE`，绝不续期或修改旧 run。
- [ ] T033 [US2] 在 `app/api/internal/agent-workbench/runs/[id]/rerun/route.ts` 实现鉴权与可信 Origin 的 current/original 选择、提交前版本校验、201/幂等 200 和过期 404；新 run queued 后由界面另发 execute，网络重试不得重建或重收费。
- [ ] T034 [US2] 在 `components/agent-workbench/run-detail.tsx` 增加默认当前配置/可选原版本的重跑确认与不可执行原因；展示原/新运行关联和实际版本，不能把旧详情改成当前配置。
- [ ] T035 [US2] 在 `lib/workbench/cleanup.ts` 实现数据库时间到期检查、240 秒执行租约回收、10 分钟未完成上传/queued 回收，以及最多 50 条/20 秒的清理批次；先标资产 `delete_pending`，用 Storage API 真删对象后才删步骤/资产/run，失败保留路径供幂等重试，不能影响未到期子 run。
- [ ] T036 [US2] 在 `app/api/internal/agent-workbench/maintenance/route.ts` 实现仅机器 `WORKBENCH_MAINTENANCE_TOKEN` Bearer 可用的 `POST`，人类 cookie 无权调用；关闭人类口令后维护仍可运行，只返回 recovered/deleted/failed/hasMore 计数，不能接受客户端指定待删路径或调用 Agent。
- [ ] T037 [US2] 在 `supabase/migrations/` 另用 CLI 生成维护调度迁移，部署时以 pg_cron+pg_net 每小时调用可达 HTTPS `/api/internal/agent-workbench/maintenance`，Vault 保存 URL/token 且 HTTP timeout 30 秒；不可将开发机 localhost 配为托管 Cron 目标。
- [ ] T038 [P] [US2] 在 `scripts/workbench-maintenance.ps1` 提供本地定时调用同一维护接口的脚本与失败退出码，口令/机器 token 从本地环境读取，不硬编码或输出；本地调度的实际安装与触发按 quickstart 验证。
- [ ] T039 [US2] 按 `specs/007-agent-workbench/quickstart.md` Q4/Q7/Q8 在 `specs/007-agent-workbench/verification/us2.md` 记录 10 次重跑、原版不可执行、刷新/服务重启、进程中断/租约、过期访问拒绝、独立子副本、Storage 实际删除和本地/部署自动调度证据；仅手动清理不能算此故事完成。

**Checkpoint**: US2 保留历史只读、跨重启重跑和真实定时清理均已验证。无 key 时原配置 live 可执行性须按实际状态报告。

---

## Phase 5: User Story 3 - 对比运行结果并保护用户端链路 (Priority: P2)

**Goal**: 两条未到期运行可按六组字段只读对比；工作台失败、关闭或越权不影响用户端主流程。

**Independent Test**: 比较同输入不同配置及不同输入的两条 run，能识别配置/Profile/工具差异；任一 ID 不存在或过期时整次 404；关闭工作台后用户端五个核心入口仍可访问。

- [ ] T040 [P] [US3] 在 `lib/workbench/compare.ts` 实现 input/config/memory/musicProfile/tools/summary 六组规范化差异，状态含 `equal/changed/missing_left/missing_right/pending`；比较故事、照片哈希/顺序、配置内容/版本、Profile、工具状态/来源，忽略运行 ID、时间戳、供应商 request ID 和临时 URL 字符串，但保留音源可用性差异。
- [ ] T041 [US3] 在 `app/api/internal/agent-workbench/compare/route.ts` 实现鉴权后的两条未到期 run 同时校验与只读响应；相同 ID 400，任一未知/过期整次 404，不能先泄露另一条记录，不回写历史快照。
- [ ] T042 [P] [US3] 在 `components/agent-workbench/run-comparison.tsx` 实现六组相同/变化/缺失/未完成状态、来源和错误摘要；长内容按需展开、状态不只靠颜色，键盘可操作且局部区域滚动。
- [ ] T043 [US3] 在 `app/internal/agent-workbench/compare/page.tsx` 建立页内鉴权的 `a`/`b` 选择与对比页，提供返回详情及重跑入口，不加入用户端导航或套用 01–09 用户端设计稿。
- [ ] T044 [US3] 在 `components/agent-workbench/workbench.tsx` 补从列表选择两条记录、按时间/状态/ID 定位及游标翻页；空列表、无效筛选和数据不可用分别提示，不修改任何历史记录。
- [ ] T045 [US3] 按 `specs/007-agent-workbench/quickstart.md` Q2/Q5/Q9 在 `specs/007-agent-workbench/verification/us3.md` 记录至少 20 个已知差异中的识别数、10 位内部试用者的操作时间（不足样本标未验证）、320/375/430 px 与键盘检查，以及工作台故障/关闭时五个用户端入口及导航回归。

**Checkpoint**: US3 对比和用户端隔离独立通过；不能用静态两栏 UI 代替真实持久记录比较。

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 处理跨故事权限、部署与阶段交付判断。

- [ ] T046 在 `specs/007-agent-workbench/verification/security.md` 记录三表/RPC/bucket 的实际授权与 RLS 检查、publishable/普通用户越权矩阵、Origin/Host/cookie/机器 token 边界、日志与浏览器 bundle 密钥检查及 Supabase advisors 结果；未知/过期记录、照片与对比都不得泄露。
- [ ] T047 在 `specs/007-agent-workbench/verification/quality.md` 按 `quickstart.md` 执行 `npm run format`、`npm run lint`、`npm run tscheck`、`npm run build`，并记录 Pi SDK 生产打包、Node `>=22.19`、服务端 key 隔离、`git diff --check` 与实际 240 秒部署请求预算；宿主不支持时标阻塞，不以 `maxDuration` 声明代替验收。
- [ ] T048 在 `specs/007-agent-workbench/verification/live.md` 分别记录 demo 与 live：无大模型 key 时 live 为“未执行，等待凭证”；获得匹配 key 后验图片与工具调用能力、真实 Pi 事件、非法 key/非视觉模型不回退 demo；配乐 live 独立验证，QQ mock 不冒充真实检索。
- [ ] T049 仅在 `quickstart.md` Q1–Q10 与 `spec.md` SC-001–SC-011 的适用完成条件实际满足后，在 `progress.md` 同一阶段提交中记录日期、完成内容、验证、已知限制和下一阶段；缺调度、权限、持久化或请求时限验收时保持 SDD-06 未完成并写入阻塞。

---

## Dependencies & Execution Order

### Phase Dependencies

~~~text
Phase 1 Setup (T001–T003)
  → Phase 2 Foundational (T004–T012)
  → Phase 3 US1 (T013–T030)
      → Phase 4 US2 (T031–T039)
      → Phase 5 US3 (T040–T045; 可在 US1 完成后与 US2 并行)
  → Phase 6 Polish (T046–T049)
~~~

- T008 生成迁移文件后才写 T009/T010；T010 后 T011/T017/T024 才能使用原子写入。
- T007/T019/T020 是 T021 的前置；T021/T022 是 T023 的前置；T017/T023 是 T024 的前置。
- T031/T032 是 T033 的前置；T035/T036 是 T037/T038 的前置。T037 的部署调度验收需要可达 HTTPS 和已部署维护接口。
- T040 与 US2 的重跑实现无文件依赖；T041/T042/T043 需要 US1 的历史读取。US3 的“同输入不同配置”验收样本可用 US2 生成，也可用两次独立有效测试构造。
- Phase 6 的安全、质量、真实模式证据依赖相应故事功能；T049 必须最后判断，不能因文档或 demo 页面存在而提前勾选。

### User Story Dependencies

- **US1 (P1)**：在共享基础完成后独立交付单次测试运行和历史详情；无需 US2/US3。
- **US2 (P1)**：依赖 US1 的运行与输入快照，独立验证重跑、历史不变和 30 天到期清理；无需 US3。
- **US3 (P2)**：依赖 US1 的两条可读运行，比较实现无需 US2；完整可用性和用户端隔离独立验收。

### Within Each Story

- 先完成数据与配置约束，再实现服务端运行/接口，最后接 UI 和手工验收。
- `[P]` 任务只在其各自前置已满足时并行；修改同一文件的任务按编号串行。
- 外部请求期间不持数据库锁；工作台运行只在理解有效后自动继续音乐，绝不改用户端确认和保存语义。

### Parallel Opportunities

- **Setup**：T002（依赖文件）与 T003（环境模板）可并行。
- **Foundation**：T005（内部鉴权）与 T006（admin 客户端）可并行；迁移 T008→T009→T010 必须串行。
- **US1**：T013、T014 可并行；T019 与 T020 可并行；T026 在 T011 与资产写入契约完成后可与 Pi 实现并行。
- **US2**：T038 可在 T036 契约固定后与 T037 的部署迁移准备并行。
- **US3**：T040 可在 US1 历史 DTO 固定后与 US2 的重跑/清理实现并行。

## Parallel Example: User Story 1

~~~text
T013 app/api/internal/agent-workbench/session/route.ts
T014 app/api/internal/agent-workbench/config/route.ts

T019 lib/agent/models.ts
T020 lib/agent/demo-provider.ts
~~~

## Parallel Example: User Story 2

~~~text
T037 supabase/migrations/（部署 Cron 迁移准备）
T038 scripts/workbench-maintenance.ps1（本地调用脚本）
~~~

## Parallel Example: User Story 3

~~~text
T040 lib/workbench/compare.ts（与 US2 的 repository/cleanup 工作并行）
T042 components/agent-workbench/run-comparison.tsx（在差异 DTO 固定后，与服务端路由 T041 不同文件）
~~~

## Implementation Strategy

### MVP First (US1 Only)

1. 完成 T001–T012，再完成 T013–T030，先交付能运行、能追踪、权限独立的内部测试链路。
2. 按 US1 Independent Test 与 `quickstart.md` Q2/Q3/Q6 验证；真实 key 未提供时仅报告 demo 结果。
3. 此时还没有重跑、30 天物理清理和对比，不能标记整个 SDD-06 完成。

### Incremental Delivery

1. US1 完成后实施 US2 的重跑和到期调度，并以跨重启、物理删除和独立子副本验证。
2. US3 可在 US1 之后进行，使用真实运行记录检验差异与用户端隔离。
3. 最后执行安全、质量、部署预算和来源验收，再按实际结果更新 `progress.md`。

## Notes

- 本清单只规划工作台；不实现 SDD-03/04/05 的用户端业务，也不在用户端导航加入工作台。
- SDK 包名、版本、Node 下限和 Pi Models API 以 [Pi 契约](contracts/pi-runtime.md) 为准；安装后仍需实际构建验证。
- Supabase 迁移文件名须由 CLI 生成，任务路径因此指向准确的 `supabase/migrations/` 目录；不得臆造时间戳、直接 SQL 删除 Storage 元数据或以表 RLS 代替授权检查。
- 自动化测试非规格要求；若后续新增测试，须验证真实风险，不能只镜像实现。

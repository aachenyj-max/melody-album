# 实施计划：内部 Agent 工作台

**Branch**: master（实际 Git 分支；Spec Kit 特性标识为 007-agent-workbench） | **Date**: 2026-10-06 | **Spec**: [spec.md](spec.md)

**Input**: SDD-06 规格及四项澄清；用户要求沿用当前技术栈，基于 [earendil-works/pi](https://github.com/earendil-works/pi)，大模型 API key 后续提供。

## Summary

在现有单体应用中新增独立内部工作台，支持测试照片/故事运行、配置快照、Memory Profile、Music Profile、工具结果、重跑与只读对比。Pi SDK 在服务端实际执行照片理解的 Agent loop；应用运行器把有效理解自动交给已有音乐意图转换、AI 配乐和 QQ mock 推荐，不等待人工确认。工作台不接入用户端导航，不自动保存测试结果为用户相册。

使用独立内部口令会话、服务端 Supabase 客户端、三张内部表与私有测试输入 bucket。输入和结果按每条运行创建时间保留 30 天。执行请求同步等待运行，阶段结果独立落库；中断保留已有结果，手动重跑创建新记录。没有大模型凭证时使用标明 source=demo 的 Pi 演示模型流；选择真实模式后缺少凭证或调用失败必须报错。

## Technical Context

**Language/Version**: TypeScript 5.9.3、Next.js 16.3.8、React 19.2.8；本机 Node.js 22.23.1，Pi 要求 Node.js >=22.19.0，部署锁定 Node.js 22 并验证该下限。

**Primary Dependencies**: 现有 Tailwind CSS 4.3.3、Biome 2.5.15、shadcn/ui 约定、lucide-react、Supabase JS 2.76.1 / SSR 0.7.0。新增且精确固定 @earendil-works/pi-agent-core=1.0.3、@earendil-works/pi-ai=1.0.3，并提交 package-lock.json；使用 pi-ai 重导出的 Type 定义工具参数，不引入 coding-agent CLI、TUI、MCP、状态库或独立 Agent 平台。

**Storage**: PostgreSQL 17 的 agent_workbench_runs / agent_workbench_steps / agent_workbench_assets；私有 agent-workbench-test-inputs bucket；服务端 SECRET_KEY。不用浏览器存储、服务器本地文件或进程内 Map 承担历史持久化。

**Testing**: [quickstart.md](quickstart.md) 的手工端到端、故障注入、访问边界、重跑/对比、重启和清理验收；实施后执行 format/lint/tscheck/build。不新增自动化测试框架。临时脚本与截图放 .sdd00-work/，持久摘要放本特性 verification/。

**Target Platform**: Windows 本地开发和 Node.js 部署；部署宿主须允许 240 秒请求预算。默认 Node runtime，使用 async cookies、async route params 和动态、no-store 数据。实际托管能力在上线前验证，maxDuration 配置不能突破宿主上限。

**Project Type**: 现有 App Router 单体 Web 应用，服务端鉴权与数据访问、局部 Client Components 和同源 Route Handlers。

**Performance Goals**: 95% 有效提交在 10 秒内显示运行标识/配置/阶段；运行详情每 1 秒轮询，终态停止；全运行应用 deadline=210 秒，Pi 理解阶段上限 45 秒，执行路由 maxDuration=240 秒；每次模型输出最多 2048 tokens、最多 3 轮。对比通过规范化字段显示已知差异，用户操作时间不计外部等待。

**Constraints**: 1–9 张 JPEG/PNG/WebP 源照片，单张 <=10 MiB、合计 <=50 MiB；复用现有 prepareAnalysisFiles 生成 JPEG 实际模型输入，请求总量 <=3.5 MiB；故事 trim 后 <=1000 字。只保存这份压缩输入快照，原文件不另行归档。共享内部访问，不引入个人账号和用户数据浏览权限；真实模式需图片与工具调用能力。

**Scale/Scope**: 少量内部测试人员，按每日约 20 次测试估算；并发执行硬上限 2，超限返回明确反馈，不建后台任务队列。列表默认 25 条、最大 50 条，采用创建时间与 ID 游标。三张表、一个私有 bucket、测试/详情/对比三类界面。

## Constitution Check

*GATE：Phase 0 研究前检查，Phase 1 设计后复核。*

| 原则 | 设计与边界 | 结果 |
| --- | --- | --- |
| 核心路径优先 | 工作台异常不改变用户端运行；不加入导航；外部工具单路失败保留另一分支 | 通过 |
| MVP 边界明确 | 只做内部测试运行/观察/重跑/对比；保留 QQ mock；不做配置编辑、用户相册 CRUD 或新账户系统 | 通过 |
| 简单实现优先 | 嵌入 Pi core，复用现有转换/生成服务；三张表和短事务，不增加 CLI 子进程、通用工作流平台 | 通过 |
| 产品体验服务演示 | 工作台按诊断信息组织；不套用 01–09 PNG，不改用户端原型结构和热点 | 通过 |
| 可验证交付 | 使用现有质量命令，手工覆盖成功/失败/中断/越权/过期；分别记录演示与真实调用证据 | 通过 |

**前置事实**：progress.md 仅确认 SDD-00–02 完成。SDD-03 的 lib/music 与生成接口目前存在未提交草稿，不能当作阶段已验收；SDD-05 仅有规格。研究时目标 Supabase 可只读连接，但 public 业务表和 buckets 为空。本计划可以完成，实施前须复核 SDD-02/03 契约和草稿状态；本工作台使用独立对象，不以 SDD-05 的相册表先完成为前提。

**明确授权的依赖**：Pi SDK 是用户指定的 Agent 基础；Supabase 已选定且本特性明确要求跨重启保留。二者直接服务本阶段需求，不构成无关框架或外部服务扩张。

## Project Structure

### Documentation (this feature)

~~~text
specs/007-agent-workbench/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/requirements.md
├── contracts/
│   ├── workbench-api.md
│   └── pi-runtime.md
└── tasks.md                     # 由 $speckit-tasks 生成的依赖有序实施清单
~~~

### Source Code (repository root)

~~~text
app/
├── internal/agent-workbench/
│   ├── layout.tsx               # 内部页布局，不能代替每页鉴权
│   ├── page.tsx                 # 口令验证/测试输入/运行列表
│   ├── runs/[id]/page.tsx        # 单次运行详情
│   └── compare/page.tsx          # 两条记录对比
└── api/internal/agent-workbench/
    ├── session/route.ts          # 口令验证与退出
    ├── config/route.ts           # 当前脱敏配置
    ├── runs/route.ts             # 创建与列表
    ├── runs/[id]/route.ts
    ├── runs/[id]/execute/route.ts # 同步 await 执行；不脱离请求后台运行
    ├── runs/[id]/rerun/route.ts
    ├── runs/[id]/photos/[index]/route.ts
    ├── compare/route.ts
    └── maintenance/route.ts      # 机器凭证：中断回收、过期清理
components/agent-workbench/
├── workbench.tsx
├── run-detail.tsx
└── run-comparison.tsx
lib/
├── agent/
│   ├── pi-runtime.ts            # Pi Agent + 受限理解工具 + 脱敏事件
│   ├── models.ts                # 受控 provider factories 和凭证注入
│   └── demo-provider.ts         # 独立 fauxProvider，通过真实 Pi loop
├── workbench/
│   ├── contract.ts
│   ├── config.ts                # 配置 manifest/内容哈希/版本注册
│   ├── auth.ts
│   ├── repository.ts            # 服务端数据访问与短事务 RPC
│   ├── runner.ts
│   ├── compare.ts
│   └── cleanup.ts
├── supabase/admin.ts            # 新增 server-only 特权客户端
└── music/generator.ts           # 仅补可选 mode/signal；旧调用语义不变
supabase/migrations/             # 实施时按 CLI 生成迁移名称；本轮只定义设计
proxy.ts                        # 精确旁路工作台前缀的用户会话刷新
.env.example / package.json / package-lock.json # 实施时补模板和固定 SDK
~~~

**Structure Decision**: 工作台独立于 app/(album) 布局和会话 Provider；复用组件库，不新增同路径主页。不把 Pi 或 admin client 导入 Client Components。保留 lib/memory/adapter.ts 的现有用户端行为，新 Pi adapter 只由工作台运行器调用。复用 components/music-album/photo-preparation.ts、lib/memory/contract.ts、lib/music/profile.ts、lib/music/mock-recommendations.ts；如共享工具需要小幅抽取，保持原用户端行为和契约。

## Phase 0：研究结论

[research.md](research.md) 固定官方 Pi v1.0.3 的包名、新 Models API、图片能力检查与工具事件；明确内部鉴权、私有持久化、短事务执行与到期清理。供应商和模型是运行时部署配置，用户后续提供凭证；设计已定义配置字段、能力门槛和缺失时错误，无待澄清技术选型。

## Phase 1：设计与契约

- [data-model.md](data-model.md)：历史运行、步骤、输入对象、配置快照、状态与写入边界。
- [contracts/pi-runtime.md](contracts/pi-runtime.md)：Pi 实际执行、模型配置、受限工具和现有服务复用。
- [contracts/workbench-api.md](contracts/workbench-api.md)：内部访问、创建/执行/重跑/对比/照片/维护接口。
- [quickstart.md](quickstart.md)：后续实施的可运行设置与验收步骤。本轮不安装依赖、写迁移、创建远端表或发起模型调用。

## Phase 1 后宪章复核

五项原则仍通过。服务端 SDK 与私有持久化直接满足已确认需求；口令验证只出现在内部入口。真实 Pi、AI 配乐、QQ mock 和 deterministic 转换分别标记来源，演示完成不等于真实供应商验收或 SDD-06 业务完成。

## 风险与依赖

- API key 后续提供。真实模型需同时支持图片输入与工具调用；模型、协议、base URL 与 key 必须匹配。Pi 的非视觉模型会忽略图片，因此执行前显式阻断。
- 大模型 key 与现有 FAL_KEY 用途不同。默认两个工作台模式均为 demo，不因环境中出现任何 key 自动收费；切换 live 后错误不自动降级。
- 原版本重跑只重用可执行的配置/工具版本，不能通过 JSON 快照复活未部署的旧代码，也不承诺供应商返回完全相同结果。
- 部署长请求不足 240 秒时，live 执行不满足本方案前提，应关闭该能力并在 progress.md 记录阻塞；队列/独立 worker 属于必要时的后续设计变更，不在本轮偷偷新增。
- Supabase 托管 cron 无法访问开发机 localhost。部署必须配置可达 HTTPS 维护 URL 与机器 token；本地需本地定时调用同一接口。
- 表、bucket、清理调度、SDK 构建兼容性与 live 调用尚未实施验证，不能标记 SDD-06 完成。当前用户端未提交改动保持原样。

## Complexity Tracking

无宪章违反项，无需复杂度例外。

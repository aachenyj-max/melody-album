# 实施计划：MVP 验收、硬化与上线

**Branch**: `master`（实际 Git 分支；Spec Kit 特性标识为 `008-release-and-deploy`） | **Date**: 2026-10-07 | **Spec**: [spec.md](spec.md)

**Input**: SDD-07 规格；用户要求遵循当前项目技术栈。

## Summary

2026-10-08 实施更新：SDD-06 技术验收已完成，用户明确要求不等待真人试用，保留样本 0 的事实。正式目标为 GitHub 仓库同名 Vercel 项目 `melody-album`；候选构建用于执行目标宿主门槛，通过后推广同一 ID。

以现有 Next.js 16 App Router 单体应用、TypeScript、React 19、Tailwind CSS v4、Biome、Supabase 和 fal.ai ACE-Step 为基础，完成 SDD-07 的发布验收。先核对 SDD-05 已完成的保存主链路和 SDD-06 的内部工作台边界，再修复目标宿主与现有实现之间的阻断问题，逐页验证 01–09 原型、失败恢复、数据隔离和来源标识。通过质量门槛后在 Vercel 目标项目创建可验证的生产构建，验收同一构建再对外发布，记录地址、版本、结果与回滚方式。

当前最明确的宿主差异是相册照片传输：`POST /api/albums` 可接收最多 50 MiB 原图，`GET /api/albums/[id]/photos/[index]` 会经函数返回最多 10 MiB 原图；Vercel 函数请求和响应正文上限为 4.5 MB。必须在发布前把原图传输移出应用函数：保留现有私有 bucket、会话归属和保存幂等语义，由服务端按本次身份签发限定路径的短时上传资格，浏览器直传私有 Storage；保存提交只传元数据，由服务端核对私有对象后发布相册。照片读取路由先鉴权，再返回短时私有读取地址。未完成这项并通过 9 张照片及大图实测，不得认为 Vercel 主链路通过。

## Technical Context

**Language/Version**: TypeScript 5、Node.js 22、Next.js 16.3.8、React 19.2.8。实施时以锁文件和 `node_modules/next/dist/docs/` 中当前安装版本的 App Router、Route Handler、环境变量与部署指南为准。

**Primary Dependencies**: 沿用现有 `@supabase/supabase-js` 2.76.1、`@supabase/ssr` 0.7.0、Tailwind CSS v4、Biome、lucide-react、fal.ai 服务调用；SDD-06 正在引入 Pi 1.0.3 服务端 SDK。照片直传先使用已有 Supabase JS 的签名上传能力，不为发布阶段增加状态库、播放器、上传平台或测试框架。

**Storage**: 沿用 Supabase Postgres 的五张相册表与私有 `memory-album-photos` bucket；SDD-06 的三张内部表和私有输入 bucket 以其最终实施为准。SDD-07 验收记录存放 `specs/008-release-and-deploy/verification/`，不新增发布记录数据库表。

**Testing**: 沿用 `npm run format`、`npm run lint`、`npm run tscheck`、`npm run build`；执行真实照片浏览器主链路、API/Storage/身份隔离、故障注入、九页 320/375/430 宽度视觉和热点核对、部署后冒烟与回滚核实。临时脚本和截图置于 `.sdd00-work/`，持久摘要进入本特性 `verification/`。

**Target Platform**: Windows 本地开发；目标托管为项目规划中的 Vercel Node.js Functions，数据位于 Supabase `ap-northeast-1`。实施时确认 Vercel 团队、项目、生产域名、套餐、区域、函数时限、正文限制和 SDD-06 维护调度的可达性，不仅依赖本地构建通过。

**Project Type**: 现有 App Router 单体 Web 应用，局部 Client Components、同源 Route Handlers、服务端数据访问和私有 Storage。

**Performance Goals**: 不另设与前置 SDD 冲突的时间指标；满足本规格的 1 次完整线上主链路、5 类状态恢复、27 个视口组合和 4 项质量检查。照片上传 1–9 张、单张至多 10 MiB、合计至多 50 MiB，且应用函数请求/响应均低于宿主限制。

**Constraints**: 01–09 PNG 为视觉基准，HTML 热点为跳转基准；07→08→09 已由 SDD-05 落地。服务端 `SECRET_KEY`、`DEMO_SESSION_SECRET`、`FAL_KEY`、工作台口令与维护令牌不能进入浏览器；浏览器只接收允许公开的 Supabase URL/publishable key 和经过当前身份授权的短时对象访问资格。真实、demo、mock 来源不能混写。SDD-06 未完成前不做最终发布判断。

**Scale/Scope**: 九个用户端状态、一个独立内部工作台、一个目标部署环境；只修复发布阻断和状态缺口，不新增歌词、分享、收藏、分类筛选或用户账户界面。

## Constitution Check

*GATE：Phase 0 研究前检查；Phase 1 设计后复核。*

| 原则 | 计划与证据边界 | 结果 |
| --- | --- | --- |
| 核心路径优先 | 先验证上传至刷新查看；照片传输的宿主上限若不修复会阻断主链路，列为发布硬化门槛 | 通过 |
| MVP 边界明确 | 保留现有九页和 QQ mock/Agent demo 来源；仅做上线验收、必要修复与部署 | 通过 |
| 简单实现优先 | 复用现有 Supabase 私有 bucket、身份与同源 API；直传使用已安装 SDK，不引入独立后端或新存储服务 | 通过 |
| 产品体验服务演示 | 按 PNG/HTML 逐页核对，加载/失败不伪造成功，07→08→09 | 通过 |
| 可验证交付 | 四项质量命令、真实照片、故障、隔离、线上同构建冒烟及回滚记录均有明确证据 | 通过 |

**前置状态**：`progress.md` 与 `AGENTS.md` 表明 SDD-00 至 SDD-05 已完成，SDD-05 提交为 `5936015`，07→08→09 已通过本地浏览器验收。SDD-06 正在实施，工作区的相关变更属于其他阶段；本计划不得覆盖或将其未完成内容算作上线通过。

## Project Structure

### Documentation (this feature)

```text
specs/008-release-and-deploy/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/requirements.md
├── contracts/
│   ├── photo-transfer.md
│   └── release-gates.md
└── verification/                 # 实施时填写本地、预发布、线上及回滚证据
```

### Source Code (repository root)

```text
app/
├── (album)/                    # 01–09 原页面，不改变结构
├── api/albums/                 # 现有相册路由；增加上传资格、照片短时读取及受保护清理入口
└── internal/agent-workbench/   # SDD-06 独立内部入口，依其完成状态验收
components/music-album/        # 现有页面/保存表单，仅修复验收发现的阻断问题
lib/
├── albums/                    # 现有保存契约、身份、存储与仓储；扩展私有直传、确认及过期清理
├── memory/                    # 现有 Agent demo 边界
├── music/                     # 现有 ACE-Step 与 QQ mock 来源边界
└── supabase/                  # 现有服务端/浏览器客户端
supabase/migrations/           # 仅在必要且有明确兼容方案时修改
.env.example                   # 变量名称和用途，不包含值
vercel.json                    # 相册过期清理调度，保留项目中已有调度
```

**Structure Decision**: 发布记录只进入规格目录，不建发布表；原图始终在现有私有 bucket。相册 API 仅处理小体积控制数据与鉴权，不经函数搬运原图。对已保存相册保留兼容读取路径与数据结构，避免发布硬化导致历史详情失效。若最终目标并非 Vercel，先重新测量宿主限制，再决定是否仍需直传；不得据本地 50 MiB 成功跳过目标环境验收。

## Phase 0：研究结论

[research.md](research.md) 记录当前宿主正文和时限、Next.js 公开变量构建边界、Supabase 私有直传、同构建发布与回滚、SDD-06 调度依赖，以及 Agent demo/QQ mock 的来源规则。不存在需要由用户先决定的产品选型；实际团队/项目/域名和套餐属于部署时必须核实的外部状态，未核实前不能发布。

## Phase 1：设计与契约

- [data-model.md](data-model.md)：发布验收记录、发布版本、照片传输会话与恢复记录的字段、关系和状态；前三者中只有照片会话映射现有相册数据，不新增发布数据库表。
- [contracts/photo-transfer.md](contracts/photo-transfer.md)：保留相册输入/响应语义，同时规定私有签名上传、对象核对、幂等提交与鉴权后的短时读取。
- [contracts/release-gates.md](contracts/release-gates.md)：环境变量分区、前置门槛、逐场景证据、同构建发布和回滚判断。
- [quickstart.md](quickstart.md)：实施后可执行的本地与线上验收步骤、质量命令和记录位置。本阶段计划生成不代表验收已经执行。

## Phase 1 后宪章复核

五项原则仍通过。照片直传和短时读取是为达到既定 1–9 张、50 MiB 原图与 Vercel 4.5 MB 函数正文限制所需的最小修复，不改变用户端画面或新建外部存储。失败仍保留现有草稿和有效音乐版本；发布记录明确区分 demo/mock 与真实服务。没有未解释的宪章违反项。

## 风险与依赖

- SDD-06 仍在实施；内部口令、维护调度、30 天清理和部署请求时限必须按其最终契约验收，不能从规划文档推定已运行。
- 签名上传资格虽可直接发给浏览器，但只允许本次用户、本次相册、预定路径、短时有效；提交前服务端须核对私有对象与文件约束。由受 `CRON_SECRET` 保护的窄范围维护入口定期清理超过 24 小时仍为 `pending/failed` 的照片对象与记录；只按服务端验证的相册 ID 定位，失败可重试，绝不删除 `ready` 相册或其他用户对象。目标宿主调度须实测。
- Supabase 标准签名上传可支持本范围，单文件大于 6 MB 时官方建议可续传上传；本阶段先用已安装 SDK 的签名上传并实测 10 MiB 与中断重试。若目标网络实测不稳定，再按单一上传链路引入可续传方案，不预先增加依赖。
- Vercel 回滚只切换部署，不回滚 Supabase schema/Storage 或环境变量。上线前必须保留与上一个可用版本兼容的数据契约，并单独核对凭证和调度；不通过破坏性数据库回退解决应用故障。
- 目标域名、生产环境变量、Vercel 项目权限及真实 Pi 凭证尚未在本计划中验证；缺失时按实际能力标为阻塞或显式演示验收，不宣称真实供应商通过。
- 本轮只生成计划与设计，不部署、不变更数据库、不将 SDD-07 标记完成；实施后按 `progress.md` 同提交更新阶段结果。

## Complexity Tracking

无宪章违反项，无需复杂度例外。

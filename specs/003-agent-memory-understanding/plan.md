# 实施计划：Agent 创建与记忆理解

**Branch**: `master`（当前工作分支） | **Date**: 2026-10-05 | **Spec**: [spec.md](spec.md)

**Input**: `specs/003-agent-memory-understanding/spec.md`

## Summary

把 `/create` 的两张静态原型状态改为一次真实可操作的临时创建流程：选择 1–9 张照片、可选故事、查看结构化记忆理解、用自然语言修正并一键确认。浏览器仅在当前流程中持有照片与草稿；确认前刷新或离开即清空。服务端入口统一验证请求并返回同一 Memory Profile 契约；没有真实 Agent 凭证时使用显式标注的演示适配器。确认结果仅在当前导航会话中交给 `/result` 的后续阶段占位，不实现配乐、曲库检索或保存。

## Technical Context

**Language/Version**: TypeScript 5、React 19.2.8、Next.js 16.3.8

**Primary Dependencies**: 现有 Next.js App Router、Tailwind CSS v4、lucide-react；不新增依赖

**Storage**: 照片文件、预览和创建草稿仅在浏览器当前流程内存中；无数据库、Storage、localStorage 或 sessionStorage 写入

**Testing**: 手工验证照片数量/类型、理解/修正/确认、失败/超时、刷新/离开清空、移动宽度；运行 `npm run format`、`npm run lint`、`npm run tscheck`，需要交付构建时运行 `npm run build`

**Target Platform**: 移动宽度优先的网页，桌面宽度可读

**Project Type**: 单体 Web 应用，App Router 页面与服务端 Route Handler

**Performance Goals**: 合法照片预览在 10 秒内完成；分析用图片准备及演示模式理解/修正请求有明确进度或失败反馈；真实 Agent 超时后给出可重试状态

**Constraints**: 1–9 张 JPEG、PNG、WebP 源图；单张不超过 10 MiB、总计不超过 50 MiB；浏览器顺序生成分析用 JPEG，整个请求体控制在 3.5 MiB 以内，以适配目标托管的 4.5 MB Function 限制；故事不超过 1000 字、修正指令不超过 300 字；确认前草稿不跨刷新或离开恢复；所有真实 Agent 凭证仅在服务端使用

**Scale/Scope**: 原型 02、03 两个创建状态与 `/result` 的确认交接；一份临时草稿、一个当前有效 Memory Profile；不扩展登录、持久化、音乐或内部工作台

## Constitution Check

*GATE: Phase 0 前检查；Phase 1 设计后复核。*

| 宪章原则 | 本阶段设计 | 结果 |
| --- | --- | --- |
| 核心路径优先 | 照片 → 理解 → 修正 → 确认 → 结果占位连续可走通；失败可重试 | 通过 |
| MVP 边界明确 | 只实现 SDD-02 的创建与记忆理解；音乐生成、真实保存和分享留给后续阶段 | 通过 |
| 简单实现优先 | 在现有 `/create` 页面增加局部交互边界，复用 App Shell 与设计稿；不引入状态库或新依赖 | 通过 |
| 产品体验服务演示 | 保持原型 02、03 的信息层级，让照片、记忆卡和一键确认成为主操作 | 通过 |
| 可验证交付 | 快速检查成功、部分结果、失败、刷新清空和三个移动宽度；提交前运行现有静态检查 | 通过 |

**前置条件**：`progress.md` 已将 SDD-00、SDD-01 标为完成；当前代码已有创建/结果路由和首页创建入口，但 `/create` 仍是静态原型，尚未实现本阶段交互。实施前以已提交基线和最新进度再次核对，不因本计划生成而提前勾选 SDD-02。

## Project Structure

### Documentation (this feature)

```text
specs/003-agent-memory-understanding/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── memory-understanding.md
└── tasks.md                    # 后续由 $speckit-tasks 生成
```

### Source Code (repository root)

```text
app/
├── (album)/
│   ├── layout.tsx              # 现有布局承载当前导航会话的确认结果
│   ├── create/page.tsx         # 现有路由，接入创建流程
│   └── result/page.tsx         # 接收已确认结果；直达时仍有明确演示占位
└── api/memory/
    ├── understand/route.ts     # 照片与故事提交
    └── revise/route.ts         # 当前理解结果的自然语言修正
components/music-album/
├── album-screen.tsx            # 保留其他原型页面，创建区改为可交互边界
├── create-flow.tsx             # 照片、故事、状态和操作
├── photo-preparation.ts        # 源图校验、预览与分析图压缩
├── memory-profile-card.tsx     # 结构化理解结果与缺失项
└── creation-session.tsx        # 当前导航会话内的确认结果；离开/刷新清空
lib/memory/
├── contract.ts                 # 输入、输出、错误与结果校验
├── request.ts                  # 服务端表单验证与错误映射
└── adapter.ts                  # 真实能力入口与同契约演示回退
```

**Structure Decision**: 保留现有 `(album)` 路由组和 `/create?state=understanding` 的视觉状态对应关系。客户端组件负责源 `File`、预览 URL、顺序压缩后的分析用图片和操作状态；服务端 Route Handler 只接收受控大小的表单并保护未来真实 Agent 凭证。URL 只表达页面状态，不携带照片或 Memory Profile；直接打开或刷新理解状态时回到上传初始状态。确认时先写入同一导航会话的内存结果，再进入 `/result`；直接访问 `/result` 显示明确的演示占位。

**视觉约束**：用户端创建状态按 `音乐相册-ui还原.html` 的 `screens` 顺序与 `designs/ui/02-创建音乐相册-上传照片.png`、`designs/ui/03-创建音乐相册-Agent记忆理解.png` 核对布局、层级、配色、字体、图片位置、按钮文案和主要热点。动态内容只替换示例文案及照片，不改变 02、03 的界面结构；确认后进入 04，不提前重做 SDD-03 的并列结果页。

## Phase 0：研究结论

见 [research.md](research.md)。已解决客户端边界、照片校验、Memory Profile 最小形状、演示回退、草稿生命周期、服务端请求和错误状态等规划决策；无 `NEEDS CLARIFICATION`。真实 Pi Agent 的具体地址、鉴权及供应商错误码尚未提供，契约已预留映射边界，实施不得猜造真实调用成功。

## Phase 1：设计与契约

- [data-model.md](data-model.md)：创建草稿、照片、Memory Profile、修正和确认结果的字段、校验与状态转换。
- [contracts/memory-understanding.md](contracts/memory-understanding.md)：理解与修正入口、请求/响应、错误码、演示模式和 UI 交接契约。
- [quickstart.md](quickstart.md)：本地运行、正常与失败路径、刷新清空和移动宽度的可执行验收步骤。

## Phase 1 后宪章复核

设计只涉及创建页的临时交互与服务端理解契约，不写入业务数据、不新增依赖、不提前实现音乐或分享。结果至少保留到当前导航会话的 `/result` 占位，因此核心路径可以继续接续 SDD-03。五项宪章门槛仍全部通过，无复杂度例外。

## 风险与依赖

- 真实 Pi Agent 供应商契约和凭证尚未取得；当前只可完成同契约演示适配器。真实接入时需核对分析图分辨率、格式、超时和错误码，不得把演示结果标为真实结果。
- 目标托管的 Function 请求体上限为 4.5 MB，故不能直传最多 9 张源图；实施须验证浏览器压缩后的整个 multipart 请求低于 3.5 MiB，无法压缩时给出可恢复错误。若真实 Agent 要求更高清的照片，需在接入前重新设计直接上传通道。
- 浏览器页面切换可能保留客户端组件状态；必须显式清理未确认草稿与对象 URL，不能只依赖组件卸载或 `router.refresh()`。
- 已确认结果在本阶段仍是内存态，刷新 `/result` 后只显示明确占位；持久化属于 SDD-05。
- 当前静态 `AlbumScreen` 把“添加照片”“继续上传”“一键确认”实现为链接；实施时需替换创建状态的假交互，同时保持其余页面可浏览。

## Complexity Tracking

无宪章例外。

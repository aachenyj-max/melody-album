# 实施计划：创建相册的连续 Agent 对话

**Branch**: `codex/creation-dialogue`（Spec Kit 特性标识 `009-creation-dialogue`） | **Date**: 2026-10-09 | **Spec**: [spec.md](spec.md)
**Input**: `specs/009-creation-dialogue/spec.md`，七项 grill-me 产品决策已确认。

## Summary

将 02/03 的单次理解与修正升级为同一段持久连续对话。消息、轮次、照片版本、卡片历史分别记录，最新理解通过数组的最新有效卡选择；服务端确认稳定快照，交给既有音乐链路。先完成真实聊天，再实现卡片生成交接、恢复和照片/失败一致性。用户已批准实施，代码与数据库变更按本计划验收。

## Technical Context

**Language/Version**: TypeScript 5，Node >=22.19.0。
**Primary Dependencies**: 已安装 Next 16.3.8、React 19.2.8、Tailwind v4、Biome、Pi core/ai 精确 1.0.3、Supabase SSR/JS；不新增 Agent SDK；新增 sharp 0.35.5 用于验证真实文件格式与压缩模型输入。
**Storage**: Supabase 服务端专用 creation_drafts 表，JSONB state 内追加消息、轮次、照片、卡片及快照；照片置独立私有 `creation-photos` bucket；沿用 `lib/albums/identity.ts` 的 auth/demo ownerKey。
**Testing**: 文档检查；实施后 format/lint/tscheck/build、浏览器主链与隔离故障验证、真实 Pi/Qwen 两段对话。临时文件 `.sdd00-work/`，持久摘要 `verification/`。不要求新增测试框架。
**Target Platform**: 移动浏览器及现有 Vercel Node 路由。
**Project Type**: 现有 Next App Router 全栈应用。
**Performance Goals**: 单轮保留现有 45 秒 Agent 预算与最多 3 次内部工具循环，路由 maxDuration 60 秒；不等同于用户固定聊三轮。消息接收先提交、模型失败可重试；轮次租约 60 秒并限制迟到写入。
**Constraints**: 1–9 张生成门槛；JPEG/PNG/WebP；单张 10 MiB、总 50 MiB。图片走受控直传避免 Vercel 请求体限制；每条用户文字 1–1000 字，回复最多 4000 字；文本上下文保守上限 64000 字符（含系统指令/卡片/历史），超限明确拒绝本轮处理，保留全部历史，不静默截断。实际供应商限制实施时复核。
**Scale/Scope**: 02/03、04 输入交接、创建草稿恢复与清理；不改工作台权限和内部表，不加全局聊天历史、分叉、逐字流式或实时订阅。

## Constitution Check

设计前与设计后均通过：核心链路优先，确认后接续 04–09；用户明确扩展了真实连续对话和持久化范围；沿用现有依赖、身份及媒体能力；不创建通用聊天框架。用户本轮授权局部覆盖 02/03 消息与确认结构，外壳/照片/色彩仍按 PNG；覆盖单独记入导航契约与 AGENTS。阶段保持未完成，真人试用不伪造。没有未解决的 NEEDS CLARIFICATION。

## Project Structure

### Documentation (this feature)

`specs/009-creation-dialogue/`：spec.md、plan.md、research.md、data-model.md、contracts/dialogue-api.md、contracts/ui-navigation.md、quickstart.md、tasks.md、checklists/requirements.md；实施后新增 verification/。

### Source Code (repository root)

- `lib/creation/contract.ts`、`repository.ts`、`dialogue.ts`、`photos.ts`、`cleanup.ts`：新建的用户创建边界。
- `lib/agent/dialogue-runtime.ts`、`dialogue-config.ts`：纯服务端聊天、可选结构化方向工具及独立版本配置。
- `app/api/creation/drafts/route.ts`、`[id]/route.ts`、`[id]/messages/route.ts`、`[id]/turns/[turnId]/execute/route.ts`、`[id]/photos/route.ts`、`[id]/confirm/route.ts`、`[id]/snapshot/route.ts`。
- `components/music-album/create-flow.tsx`、`creation-session.tsx`、新建 `creation-dialogue.tsx`、`creation-direction-card.tsx`；样式限定在 `app/globals.css` 创建区。
- `components/music-album/music-session.tsx`、`result-flow.tsx`、`lib/music/contract.ts`、`app/api/music/generate/route.ts`：传递/加载确认方向快照，保留现有单音频控制者。
- `lib/albums/cleanup.ts`、`app/api/albums/maintenance/route.ts`：复用既有维护入口调用草稿清理；保存媒体独立持久化，不引用将过期的草稿 URL。
- `supabase/migrations/`：实施时通过 CLI migration new 获得名称，服务端专用聚合表/CAS RPC 和私有 bucket；两份迁移已应用。

**Structure Decision**: 独立用户创建层，复用 provider/model、身份和音乐契约；工作台 dialogue.ts 只作为上下文与租约参考，不移植 requireHuman/run 表，也不改工作台 active 配置发布边界。

## 执行与一致性设计

1. 创建草稿并冻结 `userAgentConfig` 对应发布配置，加上独立 dialogue prompt/skill 版本与 digest。没有照片时只能文字聊天，不做看图结论。
2. 选择照片后签发限定对象的上传凭据；服务端校验上传对象格式/字节和当前归属，再事务提交照片版本与变更消息。初次完成自动接收照片观察轮次。删除后的图片不再作为模型输入；历史仅保留文字/变更说明。
3. `messages` 接收接口在数据库先追加用户消息+pending turn，并立即置卡片 stale。网络响应丢失时用同一 clientMessageId 重发，取回相同 turn。未成功接收的文字保留在输入框，不宣称已发送。
4. execute 接口独立领取 turn 租约；读取已接收输入、成功上下文和当前照片，重新创建 Pi Agent。所有消息按顺序重放，历史图片不重放；当前有效图附在本轮模型上下文。模型可自然回复，也可调用 `propose_music_direction` 工具提交规范化记忆/方向，不要求每轮都有卡。
5. 回应和卡片原子追加，检查 token、租约及消息/照片 revision；迟到输出不发布。失败仅更新 turn，用户消息保留。进程中断或过期租约转 interrupted，刷新轮询显示状态；不会自动重跑付费模型，用户点重试。处理期间禁新发送；照片变更允许通过版本失效取消旧 turn。
6. 确认接口 CAS 校验 latest card、messageRevision/photoRevision 和无 pending/failed 未处理轮次；事务生成幂等 snapshot。重复确认同卡回同快照。已确认快照不可变，继续聊天需形成新卡后再次确认；不能改写正在生成的旧快照。
7. `ConfirmedMemory` 扩展快照标识和规范化 MusicProfile。新创建链路使用该方向，不再通过 `toMusicProfile()` 覆盖；legacy 演示入口保留旧转换。generate 路由对 snapshotId 进行归属读取，使用服务端快照，不能只信客户端 profile；04 刷新通过受控快照读取恢复输入。此阶段不承诺恢复正在播放的音频任务。
8. `/create?draft=<id>` 指定草稿；`state=understanding` 只控制 03 视觉。当前浏览器保存最后草稿 id 供返回恢复；首页明确新建动作获得新 ID。查询 id 不构成权限凭证。保存后照片仍由已有相册流程独立持久化。

## 依赖、交付与已知限制

按基础→US1→US2→US3→US4→跨流程验收递进。US1 可独立演示连续聊天，完整交付必须完成四故事；恢复和失败不能因 MVP 切片而最终缺省。用户已明确开始执行；实施包含迁移与真实 Agent 技术验收，不包含部署。

默认草稿最后活动后 30 天到期，维护任务回收照片与记录；未被确认快照引用的移除照片立即尝试物理删除，失败时进入待清理。已被确认快照引用的对象延后回收以维持快照稳定，但不能再注入当前 Agent 上下文。旧照片变更文字保留到草稿到期；保存相册媒体不参与草稿清理。

## Complexity Tracking

无宪章违例。新增持久化实体和原子 RPC 仅用于已确认的恢复、幂等、照片版本及旧卡保护，不建设通用 Agent 平台。

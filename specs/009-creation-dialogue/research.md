# 研究与决策

日期：2026-10-09。只读核对现有源码、02/03 PNG 与 HTML；未执行真实模型或数据库写入。

## 1. 聊天记录与最新理解分离

**Decision**: 消息追加；卡片和理解版本追加；最新卡由指针和依赖版本确定。
**Rationale**: `components/music-album/create-flow.tsx` 只有单份 profile，成功后 setProfile 覆盖，改照片 invalidate 清理解；`creation-session.tsx` 只有内存 File[]。无法满足保留和恢复。
**Alternatives considered**: 只增加前端 messages 数组最快，但刷新丢失；把最新 profile 渲染成聊天仍会覆盖。两者拒绝。

## 2. 复用真实模型配置，独立聊天执行器

**Decision**: 沿用 `lib/agent/models.ts`、`release.ts` 的 provider/协议、用户固定版本、失败语义；新增 dialogue runtime/config。prompt/skill 版本和 digest 随草稿冻结。
**Rationale**: `pi-runtime.ts` 仅理解 story/photos/revision；`config.ts` MEMORY_PROMPT 要求只提交工具结果且不读取历史，与自由聊天冲突。`lib/workbench/dialogue.ts` chatWithPi 已有 Pi 历史重放参考，但受 requireHuman/run 绑定，不能变成公共路由。新工具可选生成卡，每轮不强制结构化结果。
**Alternatives considered**: 直接用旧理解提示聊天会冲突；直接调用内部 API 会暴露内部权限且不支持用户身份。保持旧 runtime 给旧接口使用。

## 3. 先接收消息，再执行模型

**Decision**: 消息接收与 execute 两个请求，数据库记录 turn；重试同 turn，lease+revision 保护提交。
**Rationale**: 工作台 sendDialogueMessage 在模型成功后才 commit user+assistant，失败丢本轮；没有 clientMessageId。工作台 proposal 单槽，不能保留卡片；propose 拼字符串 slice(-5000)，也不能保证早先纠正仍在。新 runtime 按预算完整重放文字，超限明确拒绝而不截尾。
**Alternatives considered**: 一次请求全结束再存会重复/丢消息；新队列平台超出当前演示规模。使用现有 Node 路由执行，刷新轮询读取 pending/running/interrupted，无后台自动付费重试。

## 4. 照片独立草稿上传

**Decision**: 新创建私有 bucket，限定路径直传+服务端验证；当前图片每轮重新加载，历史去除图片对象，仅保留文字。
**Rationale**: `lib/albums/upload-transfer.ts` startAlbumUpload 依赖保存 snapshot/music，不能在照片刚选择时使用；File/object URL 不是持久化。当前工作台固定 run photos 首轮注入，不适用可增删图。复用现有图片格式/字节校验与上传模式，但不制造空音乐相册。
**Alternatives considered**: 把原图放服务器 multipart 会遇到宿主体积限制；直接把 base64 放消息表增加体积；public bucket 不符合会话隔离。

## 5. 保留聊天里确认的音乐方向

**Decision**: 确认卡包含经过 `validateMusicProfile` 的方向；freeze snapshot 后交给 generate。`MusicSessionProvider.start` 新链路使用确认方向，legacy 才调用 toMusicProfile。
**Rationale**: `lib/music/profile.ts` 目前仅从 atmosphere 用关键词映射曲风；`music-session.tsx` start 再执行该转换，聊天中确认的爵士/配器可能丢失。
**Alternatives considered**: 只传 memory.atmosphere 无法保证曲风与编曲交接；客户端任意提交卡无法做版本/归属检查。

## 6. 02/03 设计覆盖

**Decision**: 保留原图外壳、白底、玻璃气泡、照片区域和绿色操作风格；消息区域连续滚动，卡片追加。欢迎文本保留，示例用户故事和固定四个建议删除。输入保持常驻发送，确认动作主要放在最新卡。
**Rationale**: 已核对 `designs/ui/02-创建音乐相册-上传照片.png`、`03-创建音乐相册-Agent记忆理解.png` 及 HTML screens/hotspots。用户明确更新对话行为，局部覆盖应显式记录，不要求把任意内容固定在原稿示例坐标。
**Alternatives considered**: 完全换成桌面 ChatGPT 侧栏会改变用户端整体结构；保留四固定问题不符合连续真实对话。

## 7. 文档与资料依据

- 本地 Next 文档：`node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`、`01-app/03-api-reference/04-functions/cookies.md`。使用 Node Route Handlers；异步 cookies，在响应开始前建立身份；私有内容 no-store。
- [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control)：仅服务端使用 secret key，限定签发对象路径；浏览器不获得私有表或 bucket 广泛权限。
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)：public 表启用 RLS，用户创建表按当前服务端专用模式不授权 anon/authenticated；RPC 限服务端、优先 SECURITY INVOKER/空 search_path。
- [Supabase changelog](https://supabase.com/changelog.md)：本轮已读取摘要；正式实施前复核目标项目 Postgres 版本和相关 Breaking Change，尤其 2026-09-25 Postgres 更新；规划阶段未更改数据库；实施迁移见本文件末尾。

## 结论与假设

没有阻塞规划的未决产品项。30 天保留、整段回复、单条 1000 字/回复 4000 字和上下文容量保护属于实施默认值，已列入 plan/spec，不能宣称用户逐项确认了这些技术参数。真实调用、数据库约束和移动键盘行为仍须实施后验收。

## 实施补充

目标项目 Postgres 17.11，MCP 只读连接通过。采用 creation_drafts JSONB 聚合与 creation_draft_commit 行锁 CAS，外部模型/Storage 网络请求不持锁；消息/快照前缀和卡正文不可改写。照片实际解码与 1024 像素分析图由 sharp 0.35.5 处理。完整历史含各版卡的记忆、音乐和摘要，只有当前照片加载图像。Pi initialState 自动插入 system 消息，输出切片需使用初始化后的长度而非原 prior 数组长度。

Qwen 对 nullable people/timeline/photoOrder 偶尔返回 JSON 字符串，工具先解码，再执行原 schema 与语义校验；people/timeline 空字符串归为 null，其余不扩大合法范围。自然输出格式整理仍共用 45 秒/最多三次内部调用预算。

# 数据模型与状态

实际实现采用一张 `creation_drafts` 聚合表及 `creation_draft_commit` CAS RPC。以下消息/轮次/照片/卡/快照均是 `state` JSONB 内的逻辑实体。原计划的六张表由这一短事务聚合实现替代，行为与归属边界不变。

## 物理草稿

列：id UUID、owner_key、request_id UUID、revision 非负整数、config、dialogue_config、state、created_at、updated_at、expires_at。`(owner_key,request_id)` 唯一，expires_at 有索引。成功活动延长 30 天；领取租约、失败、清理状态不延长到期。

config 冻结 `userAgentConfig`，dialogue_config 冻结独立 prompt/version/digest。没有 phase/latest_card_id 独立列，界面由 state 推导。state 包含 messageRevision/photoRevision、messages、turns、photos、photoIds、cards、snapshots、photoRequests。最后一张卡是 latest，最后一个未 succeeded/superseded 的 turn 为 active。

表启用 RLS，只 service_role 有权限。所有 API 用服务器 `getAlbumIdentity()` 校验 ownerKey，标识不构成访问权限。公共 DTO 隐藏 ownerKey、配置和租约 token。

## 消息与轮次

消息：id、seq、role `user|assistant|system`、kind `text|photo_change|direction_card`、text、at；可选 clientMessageId/turnId/cardId。服务器递增 seq 并生成 UUID；用户文字 1–1000 字，助手最多 4000 字。原消息正文不可改写。照片事件记录增删数量和当前数量；对应 turn 绑定照片/消息 revision。

轮次：id、messageId、messageRevision、photoRevision、status、attempt，可选 token/leaseUntil/error/code。status 为 pending/running/succeeded/failed/interrupted/superseded。接收先存 user+pending turn，再独立执行；同 clientMessageId 同正文返回同 turn。每草稿只容许一个 active turn，新发送等待或重试原轮；照片变更可以 supersede。

领取租约 60 秒，模型 45 秒、最多三次内部调用（包含可选格式整理）。重试原 turn 增 attempt，不多插 user。成功提交核对 token、租约和当前 revision，再原子追加助手/可选卡；迟到不能写。过期 running 在读取时转 interrupted，不自动重跑付费请求。文本重放包含全部历史及各版卡，超过 64000 字符明确拒绝，不截掉旧纠正。图像只加载当前 photoIds。

## 照片与对象

照片元数据：id、path、mime、bytes、name、status、requestId。status 为 uploading/active/removed/cleanup_pending，当前顺序由 photoIds 数组决定。当前 0–9 张，生成 1–9 张；JPEG/PNG/WebP，单张 10 MiB、总计 50 MiB。未存 digest，服务端验证真实字节数、类型及解码能力。

私有 `creation-photos` bucket，服务端指定 `drafts/<draftId>/<photoId>`。prepare 持久化 uploading 元数据后签发直传 token，重试校验原 manifest；commit 验证对象与归属，再 CAS 替换集合、增加版本、追加变更事件与 pending turn。已失败输入仍在新轮完整历史中。

照片读取走 `/api/creation/drafts/[id]/photos?photoId=...`，每次校验归属与当前/快照引用，无缓存。移除后不再提供模型图像；元数据墓碑保留。未被快照引用的对象尝试立即删除，失败在维护中幂等重试；快照引用对象延后至草稿到期。

## 版本卡与确认快照

方向卡：id、version、messageRevision、photoRevision、memory、music、summary、status。status 为 active/stale/superseded/confirmed。每轮最多一张，卡版递增；memory 经 normalizeProfile 校验当前图数/order/timeline，music 经 validateMusicProfile 校验 15–30 秒、无歌词无人声与一致的 memoryVersion。新输入令旧卡 stale，新卡成功后旧卡 superseded；正文不可覆盖，状态可更新。

快照：id、cardId、memory、music、photoIds、at，在 snapshots 数组追加。同卡只产生一次快照；依赖版本由不可变卡读取。确认需 latest 卡有效、依赖版本相同、无未处理轮、照片 1–9；CAS 冻结，重复确认回原 snapshotId。后续聊天不改原快照。

`/result?draft=<id>&snapshot=<id>` 从归属快照重建 File/预览和 MusicProfile。新链路不使用 toMusicProfile 覆盖曲风；generate 服务端读快照。相册保存把照片独立写入既有相册 bucket，不引用草稿路径。

## 原子与清理

RPC 在行锁内比较 owner、expires_at 与 revision；校验 state 2 MiB 上限、消息/快照非缩短且旧前缀逐项一致、旧卡除 status 外正文一致，再 revision+1。外部模型/Storage 请求不持锁。幂等键/seq/卡版由服务端在 CAS 竞争前构造，因此同 revision 只能一方追加成功。

到期先拒读，再删除草稿对象和整条聚合记录；照片删除失败则保留记录供维护重试。清理复用受保护维护入口，每轮到期/活动各最多 100 条，不触碰工作台或已保存相册媒体。

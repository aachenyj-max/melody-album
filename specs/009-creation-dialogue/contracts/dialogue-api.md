# 创建对话接口契约

已实现 `/api/creation/drafts` 路由。Node runtime，私有响应 `Cache-Control: private, no-store`。写操作检查 sameOrigin；身份由服务器 getAlbumIdentity 建立/读取，客户端不传 ownerKey。越权与不存在统一 404；无有效身份 401；无效输入 400/413/422；版本/处理中冲突 409；模型不可用 503、超时 504。供应商日志、key、租约 token 和配置秘密不返浏览器。

公共 DTO 包含 id/revision/messageRevision/photoRevision、当前照片短时读取信息、按 seq 排序的 messages、cards、turn 状态和可安全展示的 source/mode/version。完整 config_snapshot 留在服务端。成功消息只展示真实 source=agent 或明确 demo；live 失败不 demo 回退。

## 草稿

- `POST /api/creation/drafts`：`{requestId}`（UUID）；创建独立空草稿并冻结配置。同归属 requestId 重试返回同 id，新建操作用新 requestId。首次与幂等均 200。
- `GET /api/creation/drafts/[id]`：完整恢复 DTO；仅当前 owner，可轮询 active turn。过期视同不可访问。
- URI 参数严格 UUID。GET 不触发模型调用，不自动创建草稿，不自动重试计费请求。

## 照片

`POST /[id]/photos` 根据 action 分流：

- `prepare`：`{requestId,expectedRevision,files:[{clientPhotoId,name,mime,bytes}]}`；签发限定新对象路径的上传凭据，数量/声明大小初验。凭据仅给当前调用者且不写持久验收材料。
- `commit`：`{requestId,expectedRevision,photoIds:[...]}`；photoIds 表示完整当前集合（0–9），包括原 active 和本次上传对象，禁止任意路径/URL。服务端读取、校验实际类型/字节和归属后原子提交；photoRevision+1、追加 photo_change 消息和新 pending turn，旧卡 stale，旧运行 superseded。完全相同请求幂等不重复 event。
- `remove` 可由 commit 完整集合表达，不再另建删除动作。无有效变化回原 DTO。
- 初次有效照片 commit 自动创建观察轮次；客户端拿到 turnId 后 execute。文件上传尚未 commit 时显示准备状态；不把失败对象算进当前集合。

## 接收消息与执行

- `POST /[id]/messages`：`{clientMessageId,expectedRevision,text}`；text 1–1000 字。事务追加 user、pending turn、递增 messageRevision、卡 stale，返回 `{draft,turnId}`。同 id 同内容回相同结果；同 id 不同内容 409。当前有 pending/running/failed 未处理 turn 时拒绝新消息，提示等待/重试；照片变更可以 supersede 旧轮。输入尚未接收时断网保留输入框，同 clientMessageId 重试。
- `POST /[id]/turns/[turnId]/execute`：`{}`；通过读取到的行 revision CAS 领取并执行 pending 或重试 failed/interrupted，成功原子追加 assistant 和可选卡，返回 draft。已成功 turn 返回已保存结果；并发领取 409。租约 token 只在服务端。执行失败先持久化 turn 错误；前端 GET 重新同步。本轮响应丢失后 GET 读取，不另插 user。superseded 不可重试，使用当前照片轮。
- 模型纯文字返回正常讨论；调用 `propose_music_direction` 时附校验的 MemoryProfile/MusicProfile、summary。每轮最多一张卡，只有有效照片时允许。文字和卡在同一次成功提交；工具无效导致 INVALID_RESULT 并提供重试，不把无效卡发布。
- 中断进程不自动后台重跑，超过 60 秒租约显示 interrupted，用户重试；迟到 token 或版本不一致拒绝写。上下文超限 `CONTEXT_CAPACITY` 可读历史、保留本轮错误，提示新建，不悄悄截断。

## 确认及 04 交接

- `POST /[id]/confirm`：`{requestId,cardId,expectedRevision,messageRevision,photoRevision}`；服务器比较最新 active 卡及全部依赖，无未处理输入、有效照片 1–9。事务冻结确认快照 `{snapshotId,draftId,cardId,memory,music,photoManifest}`；重复确认同卡返回相同 snapshot。旧卡或 stale 返回 409，不生成音乐。
- `GET /[id]/snapshot?snapshotId=<UUID>`：归属读取已确认不可变快照和当前可读取的快照照片；用于 `/result?draft=<id>&snapshot=<id>` 刷新恢复。
- `POST /api/music/generate` 新创建输入包含 snapshotId/draftId；服务端读取归属确认快照，使用其 music 而不是客户端任意覆盖。保留 legacy 输入兼容旧演示/现有非草稿链路；不把 legacy 兼容接口当作过期卡绕过。
- 确认不重复调用模型；音乐生成仍由现有流程启动。snapshotId/现有 runId 同一前端启动需去重；本阶段不新增后台音乐作业恢复。

## 清理与观察

既有 `/api/albums/maintenance` 内调用 creation cleanup，保持原 token 验证。用户端不增加公开清理接口。记录匿名 draft/turn 标识、状态、耗时和版本；不输出 cookie、原图、完整敏感故事或凭据到公共错误。照片删除失败只在服务端记待清理。

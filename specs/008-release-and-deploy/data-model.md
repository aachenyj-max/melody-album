# 数据模型：发布验收与私有照片传输

本阶段不新增“发布”数据库表。发布、验收和恢复记录是 `specs/008-release-and-deploy/verification/` 中的受版本控制文档；相册仍使用 SDD-05 的五张表与私有 bucket。下列字段定义实施和验收需要保持的一致性。

## 发布版本（文档记录）

| 字段 | 含义与约束 |
| --- | --- |
| `releaseId` | 本次发布标识，关联 Git 提交和部署 ID；不可只写“最新” |
| `target` | 已核对的团队、项目、环境和正式域名；不含凭证 |
| `candidateUrl` / `productionUrl` | 待发布构建与正式访问地址；发布后记录是否同一部署 ID |
| `buildCommit` | 构建输入提交；质量命令与浏览器证据都指向该提交 |
| `sourceMatrix` | 用户端 Agent、AI 配乐、QQ 推荐及工作台的真实/demo/mock 状态与证据 |
| `status` | `prepared`、`staged`、`verified`、`released`、`failed`、`rolled_back`；状态按证据推进，不预填成功 |
| `previousGoodDeployment` | 可恢复的已验证部署 ID；首次发布若不存在须标明，不虚构回滚目标 |
| `limitations` | 已知非阻断差异及所有阻断项；包含 05 文案/热点差异的接受记录 |

状态：`prepared → staged → verified → released`。任一阶段失败转 `failed`；已发布版本故障且成功恢复后转 `rolled_back`。无验收证据不能从 `staged` 直接转 `released`。

## 验收记录（文档记录）

| 字段 | 含义与约束 |
| --- | --- |
| `scenarioId` | 对应 `spec.md` 的 FR/SC 和场景名 |
| `environment` / `deploymentId` | 本地、待发布或正式；标明所测构建 |
| `inputSummary` | 真实照片数量/大小、测试模式、浏览器/视口，不保存照片原文或密钥 |
| `expected` / `actual` | 可复核的预期与实际结果，包含跳转、来源、保存回读字段 |
| `result` | `pass`、`fail`、`blocked`、`not_run`；`not_run` 不计通过 |
| `evidence` | 截图、日志摘要或命令输出的仓库相对路径；敏感内容脱敏 |
| `checkedAt` | 带时区时间，用于区分配置或部署变更前后的证据 |

每个发布版本至少关联四项质量命令、五类失败/等待场景、27 个视口组合、未授权访问矩阵、完整主链路和正式域名复测。版本发生代码或环境变量变更后，受影响的证据重跑。

## 照片传输会话（映射到现有相册保存记录）

| 字段 | 含义与约束 |
| --- | --- |
| `requestId` | 现有保存幂等标识；同一快照和照片清单重试必须指向同一相册 |
| `ownerKey` | 服务端从现有匿名或签名 demo 会话推导，不由客户端指定 |
| `albumId` | 服务端创建或复用的待保存相册标识 |
| `snapshotDigest` | 标题、时间、短句、已确认记忆、音乐选择和照片清单的稳定摘要；同 requestId 不同摘要为冲突 |
| `photoManifest` | 按序记录 1–9 项文件名、MIME、字节数和预期摘要；总字节不超过 50 MiB，单张不超过 10 MiB |
| `storagePath` | 服务端固定到 `albumId/position` 的私有路径，浏览器不能自行指定 bucket 或任意对象路径 |
| `uploadToken` | 对单一路径短时有效的写入资格，仅在当前会话获得；不存入发布证据或日志 |
| `state` | `pending_upload`、`verifying`、`ready`、`failed`、`expired`；只有 `ready` 出现在 08/09 |

可复用 `memory_albums` 的 `pending/ready/failed` 状态表示保存生命周期；如需更细的传输阶段，优先由 API 响应和现有记录表达，不为文档实体直接新建表。`ready` 发布前，服务端逐一确认路径、大小、类型、文件头和内容摘要，并写入有序照片及音乐关联。未完成或过期对象不进入用户列表；超过 24 小时仍为 `pending/failed` 的记录由受保护维护任务清理私有对象及记录，失败可重试，且绝不删除 `ready` 相册或其他用户对象。

## 相册与短时读取

SDD-05 的 `memory_albums` 与照片、音乐版本、推荐及运行记录保持原字段和归属。照片读取先按当前 `ownerKey` 查到 `ready` 相册与合法索引，再为对应私有对象签发短时读取地址；返回小体积重定向，不通过应用函数返回原图。短时 URL 可被该用户浏览器看到，但未授权访客不能索取其他相册的 URL。访问资格过期后重新走鉴权路由获取。

## 恢复记录（文档记录）

包含触发故障、受影响版本、回滚目标部署 ID、执行人/时间、平台返回状态、正式域名复测结果及仍需修复的外部配置或数据问题。应用部署回滚不改变 Supabase schema、Storage 对象或环境变量；若无已验证的前一部署，必须明确标记恢复目标缺失，不能把发布标为已具备完整回滚证据。

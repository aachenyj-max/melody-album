# SDD-07 身份、安全和工作台前置

检查时间：2026-10-07 23:18 CST。当前结果：基线 `pass`；线上安全验收 `not_run`。

## 相册允许/拒绝矩阵

| 入口 | 当前身份/来源要求 | 跨身份或无权预期 |
| --- | --- | --- |
| `POST /api/albums/session` | 同源；建立 Supabase 匿名身份，受限时签发服务器 HMAC demo cookie | 跨源 403；建会话失败 503 |
| `POST /api/albums/upload-intent` | 同源、现有会话；ownerKey 由服务端推导；固定相册/照片路径 | 无身份 401、跨源 403、他人相册/冲突拒绝 |
| `POST /api/albums` | 同源、当前会话；新 JSON 提交须重新确认 owner/requestId/对象 | 无身份 401、跨源 403、他人相册拒绝 |
| `GET /api/albums` | 当前 owner 的 `ready` 列表；无身份返回空列表 | 不含其他 owner、`pending/failed` |
| `GET /api/albums/{id}` | 当前 owner 的 `ready` 详情 | 未知/他人一律 404 |
| `GET /api/albums/{id}/photos/{index}` | 当前 owner 的 `ready` 相册和合法索引 | 未知/他人一律 404，不能返回照片签名地址 |
| `GET /api/albums/maintenance` | 仅服务端 `CRON_SECRET` 调度 | 缺失/错误 token 拒绝；不能作为人类登录口令 |

当前 `lib/albums/identity.ts` 不使用客户端给出的 owner；`lib/albums/repository.ts` 在列表和详情查询中按 owner 与 `ready` 过滤。`app/api/albums/route.ts` 的 POST 要求 Origin 与请求 URL 相同；照片 GET 已改为鉴权后 60 秒签名地址重定向，应用函数不传原图。本地真实 Storage 单张测试的另一身份详情和照片 404、无会话提交 401 已通过；跨源与正式域名仍待补验。

## SDD-06 前置状态

`progress.md` 和 `specs/007-agent-workbench/verification/README.md` 记录了 HTTPS Preview、实际 Qwen/ACE-Step、240 秒请求、隔离与自动维护的技术验收；任务 47/49。10 位内部试用者样本 0，阶段交付未完成，SDD-06 总项未勾选。因此 **SDD-07 正式发布仍为 `blocked`**，不能将工作台技术预览视为已完成前置阶段。

## 待执行安全验收

两身份上传/提交/列表/详情/照片隔离、无口令/错误口令/正确口令、服务端密钥浏览器扫描、维护调度和工作台异常对用户主链路影响：`not_run`。证据不得包含凭证、cookie、私人照片或有效签名地址。

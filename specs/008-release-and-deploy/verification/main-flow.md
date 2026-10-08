# SDD-07 主链路验收

环境：Windows 本地 Next 开发服务器与 Supabase 私有 Storage，2026-10-08 CST。部署 ID：无。来源：记忆 `demo`、AI 失败 `demo`、QQ 推荐 `mock`。

| 场景 | 实际结果 | 状态 |
| --- | --- | --- |
| 真实 WebP 原图经签名 token 直传、JSON 完成保存、08 列表与 09 详情读取、照片短时重定向 | 一张 147,274 字节原图通过 API 集成脚本；首次 201，重复 200，同 requestId 改标题 409，另一个身份访问详情/照片 404 | `pass`（本地 API 层） |
| AI 失败、QQ mock 可播结果保存 | 上述保存记录的 09 详情保留所选 `qq` 与失败的 AI 运行状态；浏览器端从 04 选择、播放到 07 的完整动作未在本轮复测 | `pass`（持久化字段）；端到端 `not_run` |
| 01→02→03→04→05→06→05→07→08→09，刷新后六字段一致 | 目标 Vercel 项目尚未创建，SDD-06 真人试用 0/10 | `blocked` |
| 单张近 10 MiB、合计近 50 MiB、9 张完成保存 | 第二轮 9 张测试遭遇 Supabase `ECONNRESET`，未得到可判定的完整结果 | `not_run` |

临时脚本位于被忽略的 `.sdd00-work/verify-sdd07-transfer.cjs`；本证据不含上传 token、cookie 或原图。

# 私有照片传输：基线与实测

检查时间：2026-10-08 CST。当前结果：**基线 `pass`；单张直传 API `pass`；完整边界验收 `not_run`**。

## SDD-05 兼容映射

| 现有边界 | 代码/数据事实 | SDD-07 保留方式 |
| --- | --- | --- |
| 身份 | `lib/albums/identity.ts` 优先 Supabase 用户；匿名不可用时使用签名 demo cookie，ownerKey 由服务端推导 | intent、提交、列表、详情、照片均用同一个 ownerKey；不接受客户端 owner |
| 幂等 | `memory_albums` 对 `(owner_key, request_id)` 唯一，`input_digest` 固定本次内容；状态为 `pending/ready/failed` | 直传使用同一唯一键和状态；同摘要重试复用，异摘要冲突 |
| 私有路径 | `albumPhotoPath()` 固定 `albums/{albumId}/{position}`，bucket `memory-album-photos` 为私有，单张上限 10 MiB | 不改旧路径；上传 token 只对应服务端选定位置 |
| 保存 | `lib/albums/save.ts` 当前由应用函数接收最多 50 MiB multipart、逐张上传，并在照片/音乐/推荐/运行记录写完后标 `ready` | 新流程改小 JSON 提交与已传对象核对；仅 `ready` 可列表/详情；旧 multipart 仅兼容旧调用 |
| 读取 | 列表和详情只查 owner 的 `ready`；详情 DTO 使用本应用照片路由；当前照片路由会下载并返回原图 | DTO 保持不变；照片路由鉴权后改短时私有读取重定向，旧相册仍可读 |
| 授权 | 五张相册表启用 RLS，`anon/authenticated` 无直接表权限，服务端 `SECRET_KEY` 读写时显式 owner 过滤 | 新增查询仍显式 owner 限定，不能仅依赖 service role 或客户端路径 |

## 待执行矩阵

| 场景 | 环境/部署 ID | 结果 |
| --- | --- | --- |
| 1 张真实 WebP 原图，147,274 字节，签名直传后 JSON 提交 | 本地 Next + Supabase | `pass`；函数只接收清单与快照，首次 201、照片短时重定向 302 |
| 9 张真实原图、单张近 10 MiB、合计近 50 MiB；函数请求/响应均低于 4.5 MB | 本地与目标宿主 | `not_run`；9 张第二轮遇 Supabase `ECONNRESET`，不能计通过 |
| 同 requestId 同摘要重试、异摘要 409 | 本地 Next + Supabase | `pass`；重复提交 200、同 ID、标题变化 409 |
| 断传、token 过期、缺失/篡改对象 | 本地与目标宿主 | `not_run`；9 张缺失测试曾得到 `PHOTO_MISSING` 409，后续重试因 Storage 网络错误未完成 |
| 旧相册可读、两个身份隔离、私有 bucket 不可公开读 | 本地 Next + Supabase | 跨身份详情和照片 404、未建会话提交 401 为 `pass`；旧相册与公开 bucket 直连 `not_run` |
| 超过 24 小时的未完成相册清理、误删防护与失败重试 | 未定 | `not_run` |

Supabase Storage 在后续测试中多次返回 `StorageUnknownError: fetch failed`、底层 `ECONNRESET`。实现已把未知 Storage 故障归为可重试 503，只有明确 404 才报照片缺失；该修正后的远端回归尚未完成。临时测试素材和脚本只放 `.sdd00-work/`，本文件不保存签名 URL 或原始照片。

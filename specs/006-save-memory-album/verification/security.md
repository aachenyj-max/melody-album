# SDD-05 安全核对

- 浏览器只读取 `NEXT_PUBLIC_SUPABASE_URL` 与 publishable key；保存、详情和照片 API 使用服务端 `SECRET_KEY`，不把它写入 DTO、错误或响应。
- 五张相册表启用 RLS，并撤销 `public`、`anon`、`authenticated` 的表权限；服务端仓储按签名身份 `ownerKey` 过滤。
- 照片 bucket `memory-album-photos` 为私有；照片只通过同源鉴权路由下载，响应 `private, no-store`，不返回 Storage 路径或签名 URL。
- requestId 与输入摘要用于幂等；内容摘要变化返回冲突，不覆盖已完成相册。
- API 冒烟：同一 demo cookie 的保存首次创建一条 ready 相册，重复 requestId 返回同一 `albumId` 和 `alreadySaved=true`；列表/详情均只读到该相册。
- Supabase security advisor：提示五张表“RLS enabled no policy”（INFO）。这是服务端 secret client 访问、浏览器角色无表权限的预期配置；上线前继续核对部署密钥和匿名会话策略。
- 双 cookie API 隔离：A（`album.cookies`）列表可读冒烟相册，B（独立 `b.cookies`）列表返回空；B 读取 A 的详情和照片返回 404。A 读取详情和私有照片分别返回 200，照片响应带 `private, no-store`。
- 失败重试：GET 列表在 Supabase 网络瞬时 `fetch failed` 时返回脱敏 503，随后重试恢复 200；响应不包含内部错误或密钥。
- 上传失败：伪造 WebP 文件头返回 422 `INVALID_PHOTOS`，未创建相册记录。
- AI/QQ 分支：AI 状态为 failed、QQ mock 为 ready 且可播时，保存返回 201；详情显示 AI failed、QQ ready，且 selectedKind 为 qq。
- Storage 中途失败的补偿路径已核对：任一照片或关联表写入抛错时，已上传对象会被 remove，相册回写为 `failed`，下一次相同 requestId 按相同摘要进入重试分支；本地未对 Supabase 做破坏性断网注入。
- 生产 bundle 搜索证据由 `npm run build` 和服务端密钥只读边界核对覆盖。

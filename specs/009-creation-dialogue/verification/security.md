# 会话与私有数据

2026-10-09，Supabase MCP 对目标项目执行 `select 1 as connected` 成功，Postgres 17.11。迁移 creation_dialogue 与 creation_dialogue_cas_fix 已应用，第二份修复卡正文比较的 JSONB 操作优先级。

creation_drafts 启用 RLS，anon/authenticated 无表权限；creation_draft_commit 为 SECURITY INVOKER、空 search_path，仅 service_role 可执行，PUBLIC/anon/authenticated 撤销权限。creation-photos 为 private，10 MiB 单文件，限定 JPEG/PNG/WebP；服务端指定对象路径，不接收任意远程 URL。

实际使用 publishable key 读表/调用 RPC/直接下载私有照片均被拒绝。另一签名 cookie 身份访问目标草稿与照片 404；仓储层另一个 ownerKey 读取 404。确认/消息/照片/执行统一经归属 route wrapper，跨源写 403，无效 UUID 400。公共 DTO 不包含 ownerKey、配置、租约 token 或签名。

生产 `.next/static` 中扫描 23 个 JS/JSON/map 文件，与本地 SECRET_KEY/FAL_KEY/PI_LLM_API_KEY/DEMO_SESSION_SECRET 的实际值比较，命中 0。未输出任何凭据。

安全 advisor 复核请求遇到 MCP token_expired，未获得新 advisor 结果；不把不可用当作通过。上述权限由已应用迁移、实际匿名请求和服务端归属请求交叉验证；未修改内部工作台权限。

本机默认 DNS 间歇返回 Supabase ENOTFOUND。隔离验收进程对该域使用经 `Resolve-DnsName -Server 1.1.1.1` 核实的地址作为临时回退，保持 HTTPS/SNI 与真实服务；未更改 hosts、系统 DNS 或提交此回退到业务代码。

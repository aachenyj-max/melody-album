# 安全边界验证

2026-10-07，实际项目 `tencent-music-hackathon`。三张 agent_workbench_* 表均 RLS=true，anon/authenticated 的 SELECT=false，service_role 有必要 CRUD。所有 agent_workbench_* RPC 为 SECURITY INVOKER，anon/authenticated EXECUTE=false；云端调度函数亦撤销 service_role 的直接 EXECUTE。私有 bucket public=false，只接受 JPEG，3670016 字节上限。

实际 publishable key HTTP 尝试三表 SELECT、内部 read RPC、已存在私有 JPEG 下载均被拒绝。数据库 SET LOCAL ROLE authenticated 的表 SELECT（where false，不读取记录）返回 42501 permission denied。不按错误提示补授用户权限。收尾只读确认 storage.objects 的 policy 数为 0，未存在放宽测试桶浏览器读取的既有策略；增量 claim 仍为 INVOKER，anon/authenticated EXECUTE 均拒绝。

| 尝试 | 本地生产结果 |
| --- | --- |
| 未认证读配置/列表/照片 | 401，无记录内容 |
| 错误口令、篡改 cookie、轮换前 cookie | 401 |
| 未配人类口令：根/详情/对比及人类 API | 404 |
| 异源、伪造 Host 的异源请求 | 403 |
| 未知/过期记录，任意一条无效的对比 | 404，不返回另一条详情 |
| 人类 cookie 调维护 | 401 |
| 合法机器 token、人类关闭 | 200，只返回五项计数 |
| 16 KiB 超量 JSON、未知执行字段 | 413 / 400 |

8 小时固定会话过期、口令绑定/轮换、退出清除 cookie 也通过独立模块验证。HttpOnly/SameSite=Strict/Path=/；HTTPS 配置时 Secure。尚无 HTTPS 部署，不宣称已做线上 cookie 矩阵。

扫描生产 `.next/static` 中 23 个 JS/JSON/HTML 浏览器产物，未发现本地实际服务端 secret/password/token/FAL/LLM key 值。DTO 不含 execution token、Storage 路径、base64、thinking 或完整供应商响应；日志仅错误码/阶段/受控传输类别。输入故事/结构化 Profile 仅在认证后的内部页面出现。

Supabase security advisors：8 条 INFO `rls_enabled_no_policy`，其中 3 条为本工作台、5 条为既有用户相册表；服务端独占访问刻意不设用户 policy，配合撤销用户 grants。无新增安全 ERROR/WARN；performance advisors 无条目。[官方说明](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)。

部署矩阵未执行，SC-008 的本地部分通过，部署部分待验收。

HTTPS 补验：未登录 config/runs 401、伪造 Origin 403、人类 cookie 维护 401、Secure/HttpOnly/SameSite=Strict 通过；实际部署 3 个 HTML/12 个 JS 无所检查服务端凭证。新增调度函数 SECURITY INVOKER/空 search_path，anon/authenticated/service_role 均无 EXECUTE；Vault 与保护绕过值不进入仓库。Supabase 安全 advisors 无 ERROR/WARN，8 项既有 RLS 无 policy 的 INFO。见 deployment.md。

真实 key 生效后最终 Preview 的 12 个 JS/3 HTML 扫描通过；实际无效 key 只在隔离进程使用，供应商拒绝且无 profile/工具执行/demo 回退。参数解码限制两个字段/16 KiB，schema/索引/额外字段校验不放宽，旧工具版本执行行为保留。

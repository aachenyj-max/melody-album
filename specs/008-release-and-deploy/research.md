# 研究结论：SDD-07 MVP 验收、硬化与上线

**日期**：2026-10-07。以下以仓库当前安装版本、SDD-05/06 产物和官方文档为依据；上线时再次核对实际项目设置与限制。

## 1. 目标宿主与相册原图传输

**Decision**：以规划中的 Vercel 为目标。当前 `POST /api/albums` 接收 1–9 张原图，允许合计 50 MiB；照片 GET 路由把单张至多 10 MiB 原图作为函数响应。发布前必须把大文件传输移到现有 Supabase 私有 Storage，应用函数只签发本次身份限定的短时上传资格、验证上传结果、写小体积元数据，并在读取时鉴权后给出短时私有读取地址。

**Rationale**：[Vercel Functions limits](https://vercel.com/docs/functions/limitations) 对请求和响应正文均规定 4.5 MB 上限，当前本地成功不能证明目标环境支持 9 张/50 MiB。Supabase JS 已提供[签名上传资格](https://supabase.com/docs/reference/javascript/file-buckets-createsigneduploadurl)和[按令牌上传](https://supabase.com/docs/reference/javascript/file-buckets-uploadtosignedurl)，无需更换存储供应商。私有读取可用[短时签名 URL](https://supabase.com/docs/reference/javascript/file-buckets-createsignedurl)，签发前仍须由本应用验证相册归属。

**Alternatives considered**：仅缩小相册照片上限会违反已交付的 1–9 张/50 MiB 契约；继续经 Vercel Function 代理会触发 413 或超大响应；新建上传服务或公开 bucket 会扩大范围和隐私风险。官方对大于 6 MB 文件建议[可续传上传](https://supabase.com/docs/guides/storage/uploads/resumable-uploads)；先测试现有签名上传 10 MiB、失败重试和浏览器环境，必要时再采用可续传方式。

## 2. 私有数据与密钥边界

**Decision**：继续使用浏览器可公开的 Supabase URL/publishable key；`SECRET_KEY`、demo 会话签名密钥、fal.ai key、工作台口令和维护令牌仅在服务端环境。新增相册上传/读取流程沿用 SDD-05 当前身份判定及 owner scope；服务端凭证可绕过 RLS，因此每次签发、提交和读取都显式验证当前 owner。浏览器持有的上传令牌只准用于一个私有路径，短期有效，不能成为列举或读取其他对象的权限。

**Rationale**：[Supabase 数据安全说明](https://supabase.com/docs/guides/database/secure-data) 明确 publishable key 可公开但要配合 RLS/最小权限，secret/service role key 只能在后端。当前五张相册表 RLS 已启用且普通角色无直接访问权限；SDD-06 内部表按其最终合同验收，不扩大公开角色授权。Supabase [变更日志](https://supabase.com/changelog?types=breaking-change)提示新表 Data API 暴露规则将变化；本阶段不依赖新表的默认暴露行为。

**Alternatives considered**：让浏览器持有 secret key 或以客户端传入 ownerId 授权均不接受；公开照片 bucket 会改变隐私默认值；把全部数据改为浏览器持久化会破坏刷新找回和跨用户隔离验收。

## 3. 环境变量与同一构建发布

**Decision**：生产环境在构建前设置 `NEXT_PUBLIC_SUPABASE_URL` 与 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`；所有其他密钥使用服务端变量，按现有 `.env.example` 和 SDD-06 最终契约逐项对照。先确认团队/项目/域名和变量目标环境，建立生产配置的待发布构建，对该构建完成主链路与隐私验证，再将同一构建发布到正式域名。发布后在正式域名复核。

**Rationale**：Next.js [环境变量指南](https://nextjs.org/docs/app/guides/environment-variables)说明 `NEXT_PUBLIC_` 值会在构建时写入浏览器 bundle，构建后改值不会改变已产物。Vercel [Promoting Deployments](https://vercel.com/docs/deployments/promoting-a-deployment) 区分预览构建重新构建与已暂存生产构建的无重建发布；发布前验证后者才能确保对外服务的是同一产物。

**Alternatives considered**：仅本地 `npm run build` 无法验证生产环境密钥、地域和函数限制；只验预览版本再发布重建的生产版本不是同一构建；在本阶段搭建新的 CI/CD 流程超出最小范围。

## 4. 回滚与数据库兼容

**Decision**：记录当前可用生产部署标识与恢复操作；发布硬化涉及的 API/数据变化必须允许旧版应用继续读取既有相册。出现阻断时回滚应用部署并重新冒烟，但不得假设平台回滚会撤销 Supabase 迁移、对象或密钥设置。若需 schema 变化，先验证旧版与新 schema 兼容，再发布新应用。

**Rationale**：Vercel [Instant Rollback](https://vercel.com/docs/instant-rollback)通过重新指向既有部署恢复应用代码，环境变量和外部数据库不会随之倒回；回滚后自动生产域名分配状态还需检查。照片传输可复用现有表/bucket，优先避免新迁移。

**Alternatives considered**：直接 SQL 回退或删除照片属于破坏性恢复，不满足保存记忆的目标；只写“可回滚”而没有目标版本与复测结果不可验收。

## 5. 内部工作台与外部服务来源

**Decision**：SDD-06 完成后按其独立契约验证口令、真实/演示执行模式、30 天清理和维护调度。用户端 Pi 仍为明确的 demo 适配器、QQ 仍为 mock；fal.ai 只有实际 API 调用成功才记作真实。工作台默认 demo、显式 live，不能因存在 key 自动转为真实模式。上线记录按每条链路列出运行模式和证据。

**Rationale**：`progress.md` 和 SDD-02–06 产物已固定这些来源语义。Vercel 函数时限和正文限制需验证工作台最长运行与压缩输入；其维护定时任务须能访问正式 HTTPS 入口，不能把本地 localhost 成功当作线上调度通过。

**Alternatives considered**：把演示结果写成真实 Agent/QQ 通过会误导 MVP 交付判断；为展示目的公开工作台或跳过清理验收违反前置阶段的访问与保留规则。

## 6. 质量与视觉验收

**Decision**：沿用项目四项 npm 质量命令；浏览器验证涵盖 01–09 画面在 320/375/430 宽度的 27 个组合、HTML 主要热点、真实照片主链路、五类状态恢复和未授权数据访问。验收记录存规格目录的 `verification/`，截图及脚本临时放 `.sdd00-work/`。不增加仅模仿实现的单元测试。

**Rationale**：项目宪章以可运行主流程和现有静态检查为门槛；SDD-05 已有本地 Playwright/Edge 验收，但目标环境的上传体积、密钥、地域和工作台边界仍需重新测量。

**Alternatives considered**：把已有本地截图直接当作线上通过无法发现函数限制；只看 HTTP 200 无法证明照片、音频、保存与真实状态一致。

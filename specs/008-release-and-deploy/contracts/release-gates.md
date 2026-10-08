# SDD-07 发布门槛与环境契约

本文件是实施和验收契约，不代表当前已经部署。唯一阶段状态仍由 `progress.md` 决定。

## 环境配置

| 位置 | 变量或配置 | 验收边界 |
| --- | --- | --- |
| 浏览器构建公开值 | `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 与目标 Supabase 项目一致；只允许这两项项目连接值使用 `NEXT_PUBLIC_` |
| 服务端相册 | `SECRET_KEY`、`DEMO_SESSION_SECRET` | 只在服务端；匿名会话优先，demo 签名回退只在既定条件启用；缺密钥明确失败 |
| 相册过期清理 | `CRON_SECRET` | 仅服务端维护入口校验；定时清理超过 24 小时的 `pending/failed` 对象，不得删除 `ready` 相册 |
| 服务端音乐 | `FAL_KEY`；可选 `FAL_PROXY_URL` | 真实调用成功才记 API 来源；无 key 明确 demo，有 key 调用失败报错；本地 loopback 代理不可直接用于云环境 |
| 内部工作台 | `WORKBENCH_ACCESS_PASSWORD`、`WORKBENCH_SESSION_SECRET`、`WORKBENCH_PUBLIC_ORIGIN`、`WORKBENCH_MAINTENANCE_TOKEN` | 以 SDD-06 最终契约为准；未配置口令关闭人类入口；维护令牌与口令分离；origin 指向正式 HTTPS 域名 |
| 内部运行模式 | `PI_EXECUTION_MODE`、`WORKBENCH_MUSIC_MODE` 及仅 live 所需的 `PI_LLM_*` | 默认明确 demo；live 缺正确模型能力/key 报错，不自动降级或调用收费服务 |
| 托管设置 | Node.js 版本、Function 时限/地区、部署保护、维护调度 | 实测 SDD-06 240 秒预算、照片传输和定时清理；不得仅凭配置文本判定通过 |

变量只在目标平台的受保护配置中填值。文档、截图、日志和 Git 不保存 secret 内容；检查只记录变量名称、环境、存在性和脱敏结果。公开变量在构建时固化，变更后重新构建并复测。

## 发布顺序与阻断门槛

1. **前置阶段**：SDD-05 已完成；SDD-06 的口令、运行、隔离、30 天清理和用户端不受干扰条件完成。未完成则 SDD-07 `blocked`，不把工作台草稿当可上线实现。
2. **目标确认**：只读核对 Vercel 团队、项目、生产分支/域名、区域、套餐/Function 限制和目标 Supabase 项目；记录当前可用部署 ID。目标不明时不发布。
3. **主链路硬化**：完成 [照片传输契约](photo-transfer.md)，在目标宿主测 1–9 张原图、大图、保存/读取、重复请求、跨身份及超过 24 小时的孤立对象清理；未解决 4.5 MB 限制或清理误删风险即阻断。
4. **质量**：在拟发布提交运行 `npm run format`、`npm run lint`、`npm run tscheck`、`npm run build`，四项均通过。格式/lint 会写文件，检查后确认最终提交与构建输入一致。
5. **体验**：真实照片从 01 上传到 07 保存、08 列表、09 详情并刷新复开；覆盖正常、慢响应、AI 失败但 QQ 可播、保存失败、历史读取失败。01–09 × 320/375/430 共 27 项逐页对照 PNG/HTML；05 按钮文案/热点差异按既有规则记录。
6. **隐私和来源**：未授权浏览器检查服务端密钥、其他用户相册与照片签名地址、内部运行记录均不可见；Agent demo、QQ mock、AI API/demo、等待音乐均按真实来源展示。
7. **待发布构建**：以生产配置创建不自动指向正式域名的 Vercel 生产构建，记部署 ID、提交、环境变量版本与 URL；在该 URL 验收。若部署保护导致访问受限，按平台授权的测试方式验证，不降低应用鉴权。
8. **发布与复核**：将同一已通过构建指向正式域名，确认部署 ID 未变化，再于正式域名复测完整主链路、内部入口、维护调度和关键错误日志。保存地址、时间、已知限制和恢复步骤。
9. **回滚准备**：恢复目标必须是已记录的可用部署；平台回滚后仍复核正式域名、当前环境变量、Supabase 数据兼容和定时任务。首次上线若无前一可用部署，明确记录，不宣称已验证回滚。

任何一项 `fail`、`blocked` 或 `not_run` 的强制门槛都不能计入 SDD-07 完成。只有实施验收通过后，才在同一提交更新 `progress.md` 的 SDD-07 完成条件和已知限制。

## 证据位置

在 `specs/008-release-and-deploy/verification/` 留存 `baseline.md`、`quality.md`、`photo-transfer.md`、`browser.md`、`security.md`、`deployment.md` 和 `rollback.md` 的脱敏摘要。每条证据标注环境、部署 ID、时间、输入规模、预期、实际、结果和可复核的临时脚本/截图位置；没有执行的项目写 `not_run`，不能预先勾选。

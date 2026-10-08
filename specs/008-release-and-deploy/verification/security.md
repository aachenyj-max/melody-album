# SDD-07 身份、安全与工作台验收

2026-10-08 CST；正式域名 `https://melody-album-yijia-s-projects.vercel.app`；部署 `dpl_BQLuiZNBSinqWWRsRbASYXJTVFST`。

| 边界 | 预期与实际 | 状态 |
| --- | --- | --- |
| 正式访问 | 不带 Vercel bypass/登录 Cookie 的 Edge 浏览器首页 200，正式 01→09 与下列工作台检查无 bypass 通过；Preview 仍受平台保护 | `pass` |
| 相册 owner | 第一身份保存、刷新可读；第二身份详情与照片均 404，无法获得签名地址 | `pass` |
| 私有 Storage | 公开 bucket 读取失败，合法照片经相册鉴权后短时 302 | `pass` |
| 工作台会话 | 未登录配置/运行接口 401；错误口令 401；正确口令 204 且配置/运行接口 200；退出后恢复 401 | `pass` |
| 工作台维护 | 错误令牌 401、独立维护令牌 200；已验收 30 天清理与子运行隔离的 SDD-06 技术证据仍适用 | `pass` |
| 相册维护 | 错误 `CRON_SECRET` 401、正确令牌 200；与工作台维护令牌不同 | `pass` |
| 浏览器内容 | 3 个 HTML、12 个 JS 文件逐一扫描 8 项服务端凭证值，命中 0 | `pass` |
| 正式调度 | SDD-06 每小时任务仍 active，Vault URL 已切正式域名；相册临时每分钟任务取得 HTTP 200 后移除，正式每日 `0 3 * * *` 保留 | `pass` |

相册 POST 与上传 intent 要求同源和当前会话，ownerKey 只由服务端推导；列表和详情只查当前 owner 的 `ready` 相册。工作台保留独立口令、Secure/HttpOnly 会话与机器维护令牌，不加入用户端导航。浏览器脚本 `.sdd00-work/verify-sdd07-formal-security.cjs` 的脱敏结果为 `.sdd00-work/sdd07-formal-security.json`，不持久记录口令、cookie、有效签名地址。

SDD-06 的 Pi/Qwen/ACE-Step、240 秒请求预算、30 天清理与隔离见 `specs/007-agent-workbench/verification/`。用户明确 SDD-07 不等待 SDD-06 真人试用；真人样本仍为 0，T045/T049 和 SDD-06 阶段总项未完成。

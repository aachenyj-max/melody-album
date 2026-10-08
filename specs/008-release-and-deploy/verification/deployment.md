# SDD-07 正式部署

2026-10-08 CST；状态：已发布并通过正式域名主要复验；上传签名自然到期补签仍未实测，SDD-07 阶段总项未完成。

| 项 | 实际结果 |
| --- | --- |
| Vercel 项目 | `melody-album`，ID `prj_jvtE56g0FenE8QqPme2YQrXHnY5V`，团队 `team_yPve3HhsqUyx6tR51RMfS1rg` |
| 正式域名 | `https://melody-album-yijia-s-projects.vercel.app` |
| 同一部署 | `dpl_BQLuiZNBSinqWWRsRbASYXJTVFST`；候选 `https://melody-album-dcyluxxc8-yijia-s-projects.vercel.app` 经 `vercel promote` 指向正式域名 |
| 源码 | 基底提交 `e82745aba59121bfc4988fa5ec1735912be90f9c`，加 09 详情重试、状态栏点击区域和根布局类型修正；未纳入共享工作区中在途的对话功能 |
| 构建 | Vercel Next 16.3.8、Node 22.x、`npm ci`、`npm run build`、READY |
| 配置 | `sdd07-prod-v1`；公开仅 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`；其余相册、Cron、工作台、Pi/Qwen、FAL 变量仅 production 服务端配置 |
| 候选复验 | 1/9 张、5 张 49.05 MiB、内容不符补传、过期清理、ready 保护、真实 fal.ai 音乐、五类浏览器状态、27 视口、安全隔离全部通过 |
| 正式复验 | 01→09、刷新回读、跨身份照片 404、工作台口令与维护令牌、3 HTML/12 JS 密钥扫描通过 |
| 维护 | 工作台每小时 Supabase Cron active 且正式域名手动触发 200；相册每日 Vercel Cron 已配置，临时 Supabase 每分钟任务实际 HTTP 200 后移除 |
| 关键错误日志 | Vercel CLI 在授权环境查询当前部署过去 2 小时的 5xx 请求记录为 0 |

Vercel CLI 的 `--skip-domain` 在创建候选时仍自动产生项目别名。发现后移除首个候选别名，并在全部门槛通过后对最终同一部署执行 promote；因此不能声称候选从未临时挂别名。MCP 日志读取返回 403，授权的本地 CLI 查询成功。脚本和原始输出留在忽略的 `.sdd00-work/`，此处只记脱敏统计。

剩余补验：Storage 上传签名固定有效期 2 小时，已测缺失项补签与 25 小时 intent 失效，但没有等待上传签名自然到期。按发布门槛，T021/T044 与阶段总项保持未完成。首次发布前没有同项目已验收生产版本，不能宣称回滚演练已通过；详见 [恢复记录](rollback.md)。

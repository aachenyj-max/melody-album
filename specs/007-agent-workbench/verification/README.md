# SDD-06 验收记录

2026-10-07：本地实现及 HTTPS Preview 补验通过，任务 47/49；阶段总项仍未完成。T045 的 10 位内部试用者实际样本 0，T049 等待阶段交付。用户已配置 key，Qwen/工作台 ACE-Step live 真实调用和实际音频播放通过。用户选择先完成技术验收，真人试用待验证。

- [HTTPS 工作台](https://melody-album-acceptance-yijia-s-projects.vercel.app/internal/agent-workbench)：使用项目所属 Vercel 账号，再输入忽略的本地 .env.local 中 WORKBENCH_ACCESS_PASSWORD。
- 本地入口 http://localhost:3000/internal/agent-workbench；本地 Qwen 已 live，配乐未显式设置时 demo；预览理解/配乐均 live，QQ mock。Pi 两包精确 1.0.3，实际 Agent loop、图片输入和工具调用边界已接入。
- 三张独立表/私有 bucket/RPC 和六份迁移已应用；原用户相册表/桶未改。本机每小时任务已实际自动删除到期对象。
- 部署真实 240 秒 HTTPS 请求、九照片六阶段执行、独立重跑、对比、浏览器音频/移动宽度/用户入口和凭证隔离均通过。云端自动调度实际 HTTP 200，父对象/记录物理删除、四类过期 404、子副本哈希通过；临时每分钟任务已移除，保留每小时任务。

记录：[基线](baseline.md)、[单次运行](us1.md)、[重跑与清理](us2.md)、[对比与隔离](us3.md)、[安全](security.md)、[质量](quality.md)、[真实模式](live.md)、[部署补验](deployment.md)、[脱敏机器证据](deployment-evidence.json)、[Qwen 配置](qwen.md)。

本地硬中断、实际 240 秒租约回收、已完成阶段冻结/旧 token 拒绝/手动新 ID 重跑和 Storage 删除故障恢复均已通过。部署加速 Cron 与自然整点证据分开：14:00 UTC 的原每小时任务/HTTP 200 也已观察。真实供应商结果未由 demo 替代；新工具 v2 的限定 JSON 数组解码与历史 v1 原行为分开登记。

[试用流程与空白计时表](trial-guide.md)已准备，实际样本仍为 0。临时脚本、截图和包含 cookie/维护凭证的访问文件仅在被忽略的 .sdd00-work/。

最新结果：[真实模型与播放证据](live-evidence.json)。两图理解 memory=agent、配乐=api、QQ=mock，原版重跑/旧快照不变、真实错误 key 不降级、9 项参数边界通过。修复详情跨时区 hydration，以 America/Los_Angeles 浏览器时区验证时间/筛选、实际 27.96 秒音频播放、三个宽度和对比，运行时错误 0。

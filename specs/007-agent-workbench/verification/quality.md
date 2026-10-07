# 质量与生产运行

2026-10-07，Node 22.23.1、Next.js 16.3.8、TypeScript 5.9.3；Pi 两包精确 1.0.3，package/lockfile Node 下限 >=22.19.0。

- `npm run format`：通过。
- `npm run lint -- --diagnostic-level=error`：通过，无错误。既有全局 CSS specificity 警告与 Biome recommended 弃用提示保留；未扩展到用户端样式修复。
- `npm run tscheck`：通过。
- `npm run build`：通过；工作台全部人类页面/接口为动态 Node 路由。
- SDK 独立 ESM 导入、生产构建与实际生产 Pi loop 均通过。Pi 两包配置 serverExternalPackages，避免 SDK 动态 Node 导入被 Turbopack 错误打包。

启动生产构建后验证真实 Storage/数据库与 Pi demo 执行；十条历史跨重启可读并重跑，浏览器六组检查及并发上限/冻结保护通过。React 组件复核了 Hook 顺序、Effect 清理、客户端/服务端数据边界和键盘状态反馈。

初次 Next 构建在开发进程中断留下的空 `.next/dev/types/routes.d.ts` 上失败；只删除已核对路径的生成类型目录后重建通过，未删除源码或验收资料。临时文件始终在 `.sdd00-work/`。

本机直连 Supabase 出现间歇 ECONNRESET，未对写请求自动重试；工作台可选服务端 WORKBENCH_SUPABASE_PROXY_URL 后真实统计/生产检查通过。用户端 Supabase 客户端及代理行为未改。

`git diff --check` 已通过，LF/CRLF 提示不属空白错误。Qwen 适配后再次 format/lint/tscheck/build 通过；Preview 构建与实际 Pi SDK demo 执行通过，Node v24.21.0 满足 >=22.19。实际请求等待 240001 ms/往返 240638 ms、HTTP 200，T047 已补齐。路由范围见 [部署验收](deployment.md)。

2026-10-07 live 补验：format/lint/tscheck、本地及最新 Preview 的 npm run build 通过。限定 Qwen people/timeline 解码登记为工具 v2，9 项实际 Pi 参数边界/未知版本拒绝通过；v1 保留原行为。直接历史详情 hydration 时间问题已修复，跨时区浏览器、北京时间筛选、音频播放/对比通过，12 个实际 JS/3 HTML 无所检查服务端凭证。见 live-evidence.json。

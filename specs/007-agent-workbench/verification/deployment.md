# HTTPS 验收部署

2026-10-07，用户授权创建验收候选并补验。项目 melody-album-acceptance，团队 yijia-s-projects，环境 **preview**，READY；不代表 SDD-07 正式发布完成。最新版本 `dpl_81mqqN7kWZ53FTcVnxoTQ8gsMHah` 已开启 Qwen/ACE-Step live，并修复工具数组兼容和历史详情时区；[最新部署](https://vercel.com/yijia-s-projects/melody-album-acceptance/81mqqN7kWZ53FTcVnxoTQ8gsMHah)，实际调用与浏览器证据见 [live-evidence.json](live-evidence.json)。以下初次 demo、240 秒预算和对象清理证据对应各自注明的部署版本。

- [工作台入口](https://melody-album-acceptance-yijia-s-projects.vercel.app/internal/agent-workbench)。保留 Vercel 访问保护，先使用项目所属 Vercel 账号访问，再输入本地 `.env.local` 中的 WORKBENCH_ACCESS_PASSWORD。
- 初次 demo 验收部署 ID `dpl_9ekyhNmcBYnTDDVDEWpWW1UiF2sN`；[初次部署详情](https://vercel.com/yijia-s-projects/melody-album-acceptance/9ekyhNmcBYnTDDVDEWpWW1UiF2sN)。唯一域名 melody-album-acceptance-12l5ycdkq-yijia-s-projects.vercel.app；可信 Origin 固定为上述验收域名。
- 基线 `59360154f784636584877026c0ae28b64a3e243b` 上当前工作区快照 SHA-256 `815c72a92c11dd7d768c6e731f5b82f60c73b8fae9ee8c653cc0cedcb6d2055b`。没有把未提交快照称为已提交版本。云端 Next.js 16.3.8 构建通过，34 秒。
- 配置 Fluid Compute、Tokyo hnd1、300 秒宿主预算。实际 Node **v24.21.0** 满足 SDK >=22.19；项目设置 22.x，package 的 >=22.19.0 使 Vercel 选择较新主版本。
- 初次验收理解/配乐为显式 demo，QQ 为 mock。当时没有上传供应商 key。当前预览的 Qwen/FAL key 已保存为服务端 Secret，理解/配乐为 live；没有上传本机代理地址或 `.env.local`，QQ 仍为 mock。

## HTTPS 和浏览器

九照片创建后成功执行六阶段，memory 使用实际 Pi SDK 的 demo provider。original 重跑创建新 ID，原详情完整 JSON 不变，照片字节哈希相同，六组对比通过。未登录 config/runs 为 401、伪造 Origin 为 403，人类 cookie 不能维护；会话 Secure/HttpOnly/SameSite=Strict。

Edge 完成登录、上传、自动执行、演示音频元数据加载、current 默认重跑和对比。输入/详情/对比在 320/375/430 px 无整体溢出，配置折叠可键盘操作，五个用户入口无内部导航/错误，运行时错误为 0。实际部署 3 个 HTML/12 个 JavaScript 的服务端凭证扫描通过。

## 请求预算

仅在忽略目录内的部署快照加入机器鉴权、开关控制的固定 240 秒辅助路由；主应用源码没有此入口，客户端不能指定耗时/故障。无机器凭证为 401。合法请求实际等待 **240001 ms**、HTTP 往返 **240638 ms**，返回 200。辅助路由 maxDuration=300，证明宿主实际容纳 240 秒请求；工作台 execute 保持 maxDuration=240、210 秒总截止。没有用本地等待或声明代替远端请求，也没有据此宣称真实供应商通过。

## 自动清理

`20261007132012_agent_workbench_protected_schedule.sql` 已应用。Vault 保存 HTTPS URL、机器 token 和 Vercel automation bypass。调度函数 SECURITY INVOKER、空 search_path；anon/authenticated/service_role 均无 EXECUTE。pg_net 超时 30000 ms。

原 agent-workbench-hourly-maintenance 保持 `0 * * * *`、active=true。临时每分钟 Cron 调用同一函数，完成实际自动验收后已移除；**加速自动验收不等于已观察到自然整点触发**。2026-10-07 **13:43:00 UTC（21:43:00 北京时间）**，pg_net request 3 返回 200：deletedRuns=1、deletedObjects=1、failedRuns=0、hasMore=false。

到期夹具父 `51c9da51-4eba-4161-9fd2-feceb751da45`、子 `e5d49640-bfc2-47d2-8e05-8d7f5174062c`，明确不是 Agent 成果；JPEG 和子副本由实际 Storage/HTTPS rerun 创建。自动调用后父数据库记录与对象消失；父详情/照片/对比/重跑均 404。子仍可读，照片 SHA-256 `e7afe3a6d2f58da73f0c98e936e1ad3e943c90bc1644997c6b2ad2da7cfd41a4` 不变。没有 SQL 删除 Storage 元数据。安全 advisors 无 ERROR/WARN，8 项 INFO 为既有服务端专用表 RLS 无浏览器策略。

## 完成判断

T037/T039/T047 的部署缺口已补齐，完成 47/49。Qwen/工作台 ACE-Step live 真实调用和实际播放已通过。用户选择先完成技术验收，T045 真人样本保留 0、T049 阶段交付未完成。初次脱敏结果见 [deployment-evidence.json](deployment-evidence.json)，最新 live 结果见 [live-evidence.json](live-evidence.json)；临时脚本、截图、私密文件仅在忽略目录。验收候选无需先完成 SDD-07，正式发布独立判断。

补充自然整点调度：2026-10-07 14:00:00 UTC（22:00:00 北京时间），原每小时任务 runid=20 succeeded；pg_net request=11 实际 HTTP 200、timed_out=false、failedRuns=0。此项与此前加速自动删除夹具分开记录，现已观察到自然整点维护。

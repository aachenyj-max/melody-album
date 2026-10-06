# 研究：内部 Agent 工作台

**日期**：2026-10-06。仅做本地阅读、官方资料核查和 Supabase MCP 只读检查；不读取 .env.local、不修改远端对象、不调用收费模型。

## 1. 当前项目与阶段边界

**Decision**：在当前 Next.js 单体中新增内部模块，保留用户端入口、九状态原型与现有适配器。

**Rationale**：package-lock.json 确认 Next 16.3.8、React 19.2.8、TS 5.9.3、Tailwind 4.3.3、Biome 2.5.15。本机 Node 为 22.23.1。现有 MemoryProfile 校验、图片压缩、toMusicProfile、fal.ai generateMusic 与 QQ mock 可复用；lib/memory/adapter.ts 目前仍是显式 demo，配置 PI_AGENT_URL/KEY 只返回 unavailable，不能宣称 Pi 已接入。

**Alternatives considered**：另建后端、迁移现有用户端 Pi adapter、以静态结果填工作台；会扩大范围或伪装运行。

**Evidence**：AGENTS.md、progress.md、package.json/package-lock.json、components/music-album/photo-preparation.ts、lib/memory/*、lib/music/*。SDD-03 草稿未提交且未验收；本轮计划不完成其业务。

## 2. 精确 Pi 仓库、版本与嵌入方式

**Decision**：固定用户指定仓库的 v1.0.3，使用 @earendil-works/pi-agent-core 与 @earendil-works/pi-ai 两个 1.0.3 包，Node >=22.19。仅服务端嵌入 Agent class，不安装 CLI、不引入 shell/read/write 等 coding 工具。

**Rationale**：官方 2026-10-05 release 是 v1.0.3、commit d78dc83；两个包均为 ESM，当前 namespace 已不同于旧 @mariozechner。现有 Node 满足要求。pi-ai 重导出 Type，可直接定义参数 schema。使用新 Models/provider factories 显式注册所需供应商，Agent 必须注入 streamFn，不照搬旧全局 getModel 示例。[Release](https://github.com/earendil-works/pi/releases/tag/v1.0.3)、[agent package](https://github.com/earendil-works/pi/blob/v1.0.3/packages/agent/package.json)、[AI package](https://github.com/earendil-works/pi/blob/v1.0.3/packages/ai/package.json)、[AI 文档](https://github.com/earendil-works/pi/blob/v1.0.3/packages/ai/README.md)。

**Alternatives considered**：coding-agent SDK/CLI RPC 引入不必要的文件系统工具与进程管理；pi-durable/通用工作流平台超出小型内部测试需求；旧包名和 main 浮动版本不可用作固定契约。

## 3. 模型、照片与无 key 行为

**Decision**：显式 memory demo/live 与 music demo/live 模式；demo 使用官方 fauxProvider、fauxAssistantMessage、fauxToolCall 脚本，通过实际 Pi loop 执行同一结构化工具。每条运行独立 provider 和 provider ID，避免并发消费脚本。live 的模型 descriptor、协议、图片能力和 key 从服务端配置读取，执行前验证。

**Rationale**：Pi 文档说明 non-vision 模型会忽略图片，所以必须检查 model.input.includes('image')，并验证工具调用能力。照片用压缩 JPEG base64 构造 ImageContent，仅用于模型输入；不保存整个 Pi transcript 或正文日志。提供 key 不自动切换模式，live 配置缺失/鉴权失败返回明确错误。[Image input / providers](https://github.com/earendil-works/pi/blob/v1.0.3/packages/ai/README.md)。

**Alternatives considered**：缺 key 时静默切换假数据会污染对比；未验证视觉能力的文本模型不能算照片理解；把 key、provider header 或 Pi browser client 放用户端违背服务端边界。

## 4. Pi 工具与音乐服务的职责

**Decision**：Pi 理解阶段只允许 record_memory_profile；结构化参数通过 schema 和 normalizeProfile 双重校验，source/version 由服务端写入。有效结果自动进入现有 toMusicProfile 与独立的生成/推荐分支。

**Rationale**：Agent supports subscribe、工具 hooks、abort 和 terminating tool results。验证成功的理解工具返回 terminate=true，避免不必要的确认调用。事件只持久化名称、阶段、状态、脱敏参数/结果及耗时。toMusicProfile 来源标 deterministic，AI 配乐标 api/demo，QQ 标 mock；它们不是 Pi 模型已经调用的工具，应分别记录 driver=pi 或 pipeline。[Agent 工具与事件](https://github.com/earendil-works/pi/blob/v1.0.3/packages/agent/README.md)。

**Alternatives considered**：让模型任意决定是否执行音乐链路会偏离自动继续规则；让模型获得网络通用工具、凭证或代码执行能力不服务本需求。

## 5. 内部访问与 Next 服务端边界

**Decision**：共享口令验证后颁发签名 HttpOnly 会话，8 小时有效；生产 HTTPS 使用 Secure、SameSite=Strict，cookie path=/ 覆盖页和 API。口令或 session secret 缺失即关闭人类入口；轮换口令使旧会话失效。每页、每个 API、每次数据读取均鉴权，浏览器写操作验证可信 Origin。

**Rationale**：Next 本地指南明确 cookies/params 异步、Route Handlers 是公共端点，页面/布局验证不能替代操作内验证。工作台路径精确旁路现有 Supabase 用户会话刷新，避免 getUser 故障阻塞独立口令验证；不是绕过工作台自身鉴权。

**Evidence**：node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md；04-functions/cookies.md；02-guides/data-security.md、backend-for-frontend.md；proxy.ts、lib/supabase/proxy.ts。

**Alternatives considered**：仅隐藏 URL 没有访问控制；引入完整 Supabase 登录及管理员角色超出已选口令模式；把工作台逻辑挂进用户端 proxy 会增加耦合。

## 6. 私有持久化与照片读取

**Decision**：public 三张 agent_workbench_* 表显式 RLS + 撤销 PUBLIC/anon/authenticated 权限，仅 service_role 访问；独立 server-only admin client 使用 SECRET_KEY，不继承用户 cookie/header。私有测试 bucket 不给浏览器角色策略。照片预览通过同源鉴权/过期检查后下载并 no-store 输出。

**Rationale**：Data API grant 与 RLS 是两层；secret key 可绕过 RLS，必须先由应用验证资格。现有 SSR client 用 publishable key，不能当作 admin client。Smart CDN 的 token 过期与缓存期限独立，不能只靠签名 URL 承诺 30 天截止。[API 权限](https://supabase.com/docs/guides/api/securing-your-api)、[API keys](https://supabase.com/docs/guides/getting-started/api-keys)、[Storage 权限](https://supabase.com/docs/guides/storage/security/access-control)、[Smart CDN](https://supabase.com/docs/guides/storage/cdn/smart-cdn)。

**Alternatives considered**：浏览器或服务器文件持久化不能满足部署/重启；复用用户相册表会混入内部数据；默认公开 bucket 或共享用户身份不符合内部边界。

## 7. 请求执行、并发与中断

**Decision**：创建记录后另发 execute 请求同步 await；界面轮询持久快照。claim RPC 在短事务内限定并发 2 并分配 execution_token；全部写入核对 token/租约/状态。运行截止 210 秒，路由配置 240 秒；中断只标终态和保留结果，重跑新记录。

**Rationale**：lambda 不能共享请求内存、后台 Promise 不保证完成，长请求仍受宿主限制。外部模型调用不持数据库锁。Pi 事件处理中用受限内存缓冲加工具边界/阶段结束的 awaited 写入，不能把 subscribe(async ...) 当作持久化屏障；结果落库失败就不报告整次成功。

**Evidence**：本地 Next backend-for-frontend.md、maxDuration.md；Supabase Postgres lock-short-transactions.md。复用 generator 时补可选 AbortSignal 和 explicit mode，不改变用户端 auto 默认行为。

**Alternatives considered**：返回 202 后 void 启动任务会丢失；自动恢复失联供应商请求可能重复收费；复杂队列暂不需要。

## 8. 版本复用与 30 天清理

**Decision**：配置快照存实际 prompt/skill 文本、loop 限制、模型非敏感 descriptor、工具/契约/SDK 版本和内容哈希。原配置必须匹配仍部署的版本注册，不能执行任意上传代码。每个重跑复制输入到新 run 路径，独立 30 天。

**Rationale**：查看旧记录用快照，默认重跑用当前配置；原版重跑不可用时阻止，不静默换版本。到期实时拒绝读取，即使物理删除失败。维护先 Storage remove，再删步骤/输入清单/运行；失败保留待删路径幂等重试。[删除对象](https://supabase.com/docs/guides/storage/management/delete-objects)。

**Alternatives considered**：存版本标签却读当前配置不能复现；共享对象过早删除会破坏新运行；直接 SQL 删除 storage.objects 只删元数据。

## 9. 清理调度与环境事实

**Decision**：部署每小时由 Supabase Cron + pg_net 调用唯一 maintenance API，URL/独立机器 token 放 Vault；HTTP timeout 显式 30 秒。本地用本地定时调用同 API，手工调用用于验收。维护只回传计数，不返回测试内容、不执行 Agent。

**Rationale**：托管数据库不能访问本机 localhost；关闭人类口令入口后仍须清理到期数据。定时 HTTPS 调用官方示例面向 Edge Functions，应用到本项目 Next 维护接口是本方案的设计推论。[Cron](https://supabase.com/docs/guides/cron)、[pg_net](https://supabase.com/docs/guides/database/extensions/pg_net)、[schedule + Vault](https://supabase.com/docs/guides/functions/schedule-functions)。

**只读快照**：项目 tencent-music-hackathon（lekgrusgdxdbmbyaejzt）ACTIVE_HEALTHY；Postgres 17.11.0.002；select 1 成功；public 表与 Storage buckets 为空。pg_cron 1.6.4、pg_net 0.20.4 可安装但未启用，Vault 0.3.1 已启用。没有检查本地服务密钥是否填入、Dashboard 暴露 schema 设置或托管请求上限。

**Changelog**：已核查 [Supabase changelog](https://supabase.com/changelog)，所见 PG17.11 相关扩展/加密变更不涉及本方案所用对象；保持显式 grant，不依赖项目创建时的自动授权。

## 研究收敛

技术设计均已确定。供应商/模型/key、SDK 实际安装、远端迁移、清理调度和宿主时限是后续实施输入及验收门槛，不是假定已接通的能力。无需为了等待 key 停止设计，也不把演示验收计为真实模型调用成功。

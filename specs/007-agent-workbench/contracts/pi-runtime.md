# Pi 运行契约：内部 Agent 工作台

**契约版本**：1。适用于本特性的服务端执行，不替换 SDD-02 用户端确认流程。

## 1. SDK 与运行边界

固定用户指定 [earendil-works/pi v1.0.3](https://github.com/earendil-works/pi/releases/tag/v1.0.3) 的 @earendil-works/pi-agent-core=1.0.3 与 @earendil-works/pi-ai=1.0.3。Node >=22.19，ESM import，仅 server-only 模块可引用；通过生产构建验证 Next 打包，不未经验证提前添加 serverExternalPackages。

使用当前 Models API：createModels、受控 provider factory、models.setProvider、models.getModel；每次运行单独构造 Agent，并注入 models.streamSimple.bind(models) 为 streamFn。getApiKey 在服务端解析当前凭证，不把凭证放 model、prompt 或历史快照。[AI SDK](https://github.com/earendil-works/pi/blob/v1.0.3/packages/ai/README.md)、[Agent SDK](https://github.com/earendil-works/pi/blob/v1.0.3/packages/agent/README.md)。

不暴露 CLI、文件读写、shell、浏览器、任意 HTTP 或动态代码工具。一次运行的 Agent 上下文仅含自己的 system prompt、skill 指令、故事、照片和受限工具，不加载其他运行或用户相册。

## 2. 服务端配置

| 环境变量 | 默认/要求 | 用途 |
| --- | --- | --- |
| WORKBENCH_ACCESS_PASSWORD | 无默认；缺失关闭人类入口 | 独立共享内部口令 |
| WORKBENCH_SESSION_SECRET | 无默认；至少 32 字节随机值 | 签名 8 小时会话；与口令版本绑定 |
| WORKBENCH_PUBLIC_ORIGIN | 必填可信 origin | 本地 localhost HTTP，部署 HTTPS；不能来自请求 Host 推导 |
| WORKBENCH_MAINTENANCE_TOKEN | 独立随机值 | 仅维护接口使用，不能登录 |
| PI_EXECUTION_MODE | demo | demo / live，记忆理解模式 |
| PI_LLM_PROVIDER | live 必填 | 受支持供应商 ID |
| PI_LLM_MODEL | live 必填 | 确定模型 ID |
| PI_LLM_API | 官方模型可由 descriptor 推导 | 自定义兼容端点显式选择受支持协议 |
| PI_LLM_BASE_URL | 官方 provider 默认地址 | 可选可信服务端兼容地址，禁止 userinfo/query 凭证 |
| PI_LLM_API_KEY | live 必填，后续提供 | 仅大模型认证 |
| WORKBENCH_MUSIC_MODE | demo | demo / live，独立配乐模式 |
| FAL_KEY / FAL_PROXY_URL | 沿用现有变量 | live 配乐认证/可选服务端代理 |
| SECRET_KEY | 持久化必填，人工本地填写 | Supabase 特权客户端 |
| NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | 沿用项目模板 | 现有 Supabase 配置；publishable key 无工作台表读取权限 |

不新增 NEXT_PUBLIC_* 模型/内部凭证变量。配置加载应按请求能力校验，缺 key 不阻断应用构建或用户端页面。模式由发布配置决定，浏览器不能指定任意 model/base URL/key。工作台配置预览只显示已校验的非敏感 manifest；缺失项显示配置不可用类别，不回显变量值。

PI_AGENT_URL / PI_AGENT_API_KEY 是已有用户端 adapter 的占位接口，与这里的 SDK 配置没有自动映射。提供大模型 key 后，另行配置匹配的供应商/模型/协议并显式启用 live；不因任何 key 出现自动转收费模式。

## 3. demo 与 live

### demo

每次运行创建独立 fauxProvider，注册进自己的 Models，并使用该 provider 的模型。官方 fauxAssistantMessage / fauxToolCall 脚本输出 record_memory_profile 参数，再由真正 Agent loop 执行同一校验工具；同一 provider 不供并发运行共享，并为每个运行使用不同 provider ID。[Faux Provider](https://github.com/earendil-works/pi/blob/v1.0.3/packages/ai/README.md#faux-provider-for-tests)。

演示规则基于故事、照片数量/顺序构造稳定且合法的示例理解，不能声称模型看懂照片。配置标 memory mode=demo、engine=pi；MemoryProfile.source=demo。演示 provider 不读取 LLM key，也不联网。可在隔离验收夹具中脚本化无效参数/空响应/报错，产品不提供任意脚本入口。

### live

官方 provider 使用该版本支持的独立 factory 和受控 model descriptor；自定义兼容端点通过 createProvider 与 openAICompletionsApi / openAIResponsesApi / anthropicMessagesApi 注册，限定 openai-completions / openai-responses / anthropic-messages。descriptor 明确 api/provider/baseUrl，凭证仅服务端注入。供应商由部署配置提供，不能推断“一个 key 适用于所有协议”。

执行前要求模型 descriptor 的 input 含 image、输出限制可用、provider 支持工具调用；实际视觉/结构化工具能力必须经真实验收证明。未知 provider/协议/模型、缺 key、非视觉模型或不受支持的版本返回 CONFIG_UNAVAILABLE，不调用模型，不回退 demo。错误 key、供应商故障或返回非法结果保留失败状态。

## 4. 输入与唯一模型工具

模型用户消息包含 trim 后故事（可为空）、按 0 起始编号的照片提示和 JPEG ImageContent：type=image，mimeType=image/jpeg，data 为实际输入快照的 base64。只在执行内存构造；不把 base64 或完整消息持久化、打印或返回浏览器。

唯一工具 record_memory_profile 的参数：

| 字段 | 类型 | 校验 |
| --- | --- | --- |
| title | string | trim 后非空 |
| people | string[] 或 null | 非空名字数组；空数组规范化为 null |
| event / atmosphere | string 或 null | 至少一项非空 |
| timeline | {label, photoIndices}[] 或 null | label 非空；索引落在本次照片范围 |
| photoOrder | number[] | 本次 0..N-1 索引的完整不重复排列 |

通过 pi-ai 重导出的 Type 定义 schema，随后调用现有 normalizeProfile 做语义校验。version=1 与 source 由服务端注入，模型不能自称真实来源。工具收到的 AbortSignal 必须检查；校验失败返回工具错误，可在轮数限制内修正。合法结果先 awaited 落库，成功后返回带 content/details 的结果及 terminate=true，终止多余模型轮次。

技能 memory-understanding 是版本化业务指令文本，随 prompt 一起组成 system prompt；不把技能版本展示误写为运行任意本地 SKILL.md。模型不能控制后续音乐是否执行。

## 5. 自动编排与来源

| 阶段 | 驱动 | 服务与结果 | 来源 |
| --- | --- | --- | --- |
| input | pipeline | 校验、上传、冻结输入 | none |
| memory | pi | Agent / record_memory_profile / MemoryProfile | agent 或 demo |
| music_profile | pipeline | 现有 toMusicProfile / validateMusicProfile | deterministic |
| ai_music | pipeline | 现有 generateMusic | api 或 demo |
| qq_recommendations | pipeline | 现有 getMockRecommendations | mock |
| summary | pipeline | 真实阶段状态、耗时、可用性 | none |

Memory Profile 有效才自动继续。音乐意图成功后 AI 与 QQ 分支独立执行并分别 awaited 落库；使用 allSettled 或等效独立错误处理，单路失败保留另一分支。缺失/错误理解使全部依赖阶段 skipped，不能使用历史、演示或前次理解补齐。

generateMusic 增加可选 mode/signal，原用户端调用保持现有默认 auto 语义。工作台始终明确传 demo 或 live：demo 即使环境存在 FAL_KEY 也只返回演示配乐；live 缺 FAL_KEY 或调用失败均报错。QQ 仍是 mock，不能显示真实检索成功。来源必须同时出现在详情和对比中，全部记录 kind=internal_test，不写用户相册。

## 6. 限制、事件与持久化屏障

应用封装 loop 限制：最多 3 次 assistant 模型轮次、每轮最多 2048 输出 tokens、理解 deadline 45 秒、全运行 deadline 210 秒。轮数通过事件/下一轮调用检查及 agent.abort 执行；不是假设 Agent 构造参数原生提供 maxTurns。子阶段用剩余总预算，AbortSignal 传递到模型、工具和音乐 HTTP 请求；取消或超时后禁止新工具调用。

只订阅白名单 turn/tool 开始/结束、状态与耗时；每阶段最多 256 条摘要事件，超出标记截断。subscribe listener 只更新受限缓冲，不能依赖 async listener 的完成来表示已落库。工具边界、阶段开始/结束及最终汇总必须显式 awaited 写入并校验执行 token。写库失败不能向客户端宣称成功。thinking、text delta、key、headers、供应商原始响应均不保存。

超时/请求断开/进程死亡保留已完成阶段；可写时把未完成阶段记 failed 或 interrupted。无法写最终状态则等 240 秒租约回收为 interrupted，手动重跑创建新 run；不自动再次调用收费工具。

## 7. 配置历史与错误

快照保存实际指令文本、内容哈希、loop/skill/tool/SDK/契约版本、非敏感 model descriptor、两种执行模式和 mock 数据版本。敏感值不参与 hash。查看用历史快照；当前配置重跑用提交时解析的当前 manifest，原配置重跑用原快照。

原配置须通过受控版本注册与能力验证。部署已经删除旧工具/SDK 支持、协议不可用或当前凭证无法服务原模型时阻止运行；当前凭证不复制回历史。配置不可执行时返回 CONFIG_UNAVAILABLE；没有成功记录前不得冒充使用原版本。

统一错误映射 CONFIG_UNAVAILABLE、MEMORY_TIMEOUT、INVALID_MEMORY_RESULT、PROVIDER_UNAVAILABLE、MUSIC_UNAVAILABLE、RUN_TIMEOUT、RUN_INTERRUPTED、DATA_UNAVAILABLE，包含阶段、可重跑性和脱敏说明。供应商原始错误不透传；HTTP 约定见 [workbench-api.md](workbench-api.md)。

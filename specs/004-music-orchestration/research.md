# 研究记录：音乐结果编排与等待兜底

## 决策 1：承接已确认记忆，不复制创建草稿

**Decision**: 消费 SDD-02 的 `ConfirmedMemory`（有效 `MemoryProfile` 与当前 `File[]`），在同一浏览器导航会话中建立一次音乐运行。结果页直接访问或刷新而无确认交接时显示空状态；新创建、离开流程或明确重置时终止旧运行并释放照片预览。

**Rationale**: SDD-02 契约明确结果只能使用确认版本，照片与结果不持久化。当前仓库的 `(album)` 布局尚未实现该交接，因此 SDD-02 是实施前置条件；本阶段不再创建第二份照片或记忆草稿。

**Alternatives considered**: 用 URL、浏览器持久存储或模块全局变量传递会泄露个人记忆、改变刷新语义或产生跨会话污染。仅依赖组件卸载清理也不可靠，Next 16 可能保留隐藏页面状态。

**Source**: `specs/003-agent-memory-understanding/contracts/memory-understanding.md`、`node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md`。

## 决策 2：以纯转换生成 Music Profile

**Decision**: 用可重复的纯转换从已确认 `MemoryProfile` 生成 `MusicProfile`：记忆版本、标题/事件线索、情绪、风格、节奏、结构和一段无歌词生成提示。未知人物或时间不补造事实。真实文字生成音乐服务仅接收必要的音乐文本与目标时长，不发送原图或完整创建草稿。

**Rationale**: 用户会提供文字生成音乐 API，但尚无独立的 Memory→Music 翻译接口资料。纯转换能先固定输入边界，确保同一确认版本的两路结果可关联和复现，也减少传向外部服务的个人资料。

**Alternatives considered**: 直接把照片、原故事和完整 Memory Profile 交给音乐服务会超出文字生成所需；额外引入 LLM 翻译会增加本阶段外部依赖；随机映射不利于演示与重试验收。

## 决策 3：真实 AI 生成采用可替换的服务端适配器

**Decision**: 结果页只调用同源、非缓存的 `POST /api/music/generate`。服务端验证 `MusicProfile` 和时长，将请求交给 fal.ai ACE-Step 适配器；未配置 `FAL_KEY` 时使用显式 `demo` 适配器，已配置的真实请求失败时返回错误，不静默改用演示音频。

**Rationale**: 稳定内部契约使用户端无需依赖供应商模型细节。ACE-Step 使用 fal queue、服务端 `FAL_KEY`、WAV 音频 URL；Route Handler 的 POST 不缓存。

**Alternatives considered**: 浏览器直连会暴露密钥；预先假设供应商协议会在资料到位时返工；真实调用失败后自动回退演示结果会掩盖故障。若提供的 API 采用后台任务，适配器可在不改变用户端契约的前提下处理查询，但必须受实际服务与部署时限约束。

**Source**: `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`、`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`、`node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`、`node_modules/next/dist/docs/01-app/02-guides/backend-for-frontend.md`。

## 决策 4：QQ 音乐当前使用独立的稳定 mock

**Decision**: 当前 Demo 不调用 QQ 音乐曲库。在独立的本地推荐模块中基于 `MusicProfile` 选择稳定曲目，显示“演示推荐”；曲目可播放与否由实际音频资源决定。至少准备一首可合法使用、可在本地打开的演示音频作为原创失败兜底。既有历史 `demo-data.ts` 中真实歌手/歌名且 `status=placeholder` 的条目只服务 01、08、09 的历史展示，不作为 04 的可播放推荐。

**Rationale**: 用户明确无法连接 QQ 曲库并要求 mock；仓库目前没有任何音频文件。把已有静态歌曲卡直接当成可播放 QQ 结果会制造错误承诺。动态歌曲数据可以替换 04 PNG 示例，但卡片布局与层级不变。

**Alternatives considered**: 假装真实检索或把无关音频绑定到真实艺人会误导评审；为了 mock 增加一个假远程推荐服务没有收益；无音频推荐不能满足原创失败后的播放兜底。

## 决策 5：单音源会话与 04→05 交接

**Decision**: 在 `(album)` 路由布局中的窄范围客户端音乐会话持有运行状态、当前选择和唯一音频控制者，跨 `/result`→`/play` 导航继续工作。默认选择 AI：生成中可播放氛围音乐，生成完成后平顺替换；只有用户主动选择可播推荐才改播推荐，AI 后续完成不抢播。已选 AI 生成失败时结束等待，提供重试或选择推荐。

**Rationale**: 当前结果页和播放页都是静态屏幕；只在结果组件中持有 `<audio>` 会在导航时中断。浏览器自动播放可能被拒绝，因此会话须区分资源可用与实际播放中，并提供用户手动启动。05 号完整播放器和照片转场仍属于 SDD-04，本阶段提供连续音源和状态交接。

**Alternatives considered**: 每页各持有音频会导致重叠或断裂；让 AI 完成后无条件抢播会覆盖用户主动选择；固定进度 60% 会伪造真实生成状态。

**Source**: `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`、`node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`、`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-router.md`。

## 决策 6：进度、失败与过期响应

**Decision**: AI 与推荐分别维护 `pending | ready | failed` 状态。AI 仅在真实服务给可信进展时显示百分比，否则用不确定进度；当前静态“60%”和“约 20 秒”不能当真实值。每次重试递增轮次/请求标识并取消或忽略旧响应。原创失败保留推荐；推荐没有可播音频时不允许空音源进入播放。

**Rationale**: 两路结果可能先后到达，页面切换也可能保留旧组件。独立状态和过期响应保护能避免错误覆盖、伪成功及音频重叠，同时覆盖成功、慢响应、失败三种演示。

**Alternatives considered**: 单一总状态会让任一路失败阻断另一结果；根据时间递增假百分比会误导；仅用 `router.refresh()` 不会可靠清理保留的客户端状态。

## 决策 7：阶段门槛和素材来源

**Decision**: SDD-03 实施前核对 SDD-02 的确认交接已落地。实施时补齐可合法使用的本地氛围音乐、至少一首 QQ mock 音频，以及演示模式 AI 音频；未验证可播性前不得将歌曲标为 `ready/playable`。真实 AI API 未提供前，允许规划与显式演示模式验收，但不得勾选真实生成接入或宣称 SDD-03 所有完成条件已满足。

**Rationale**: `public/` 当前没有音频文件，SDD-02 仍未实现；外部 API 资料由用户后续提供。阶段进度表目前仍写“真实 QQ 工具”，实施完成时须依据用户新决定同步修订并记录真实接入限制，不能沿用旧验收口径。

**Alternatives considered**: 用静态卡片、空 URL 或模拟进度替代可播音频无法验证播放兜底；提前接入数据库或引入音频 SDK 会扩大 MVP 范围。

## 真实供应商验证

真实文字生成音乐供应商已由用户改为 fal.ai ACE-Step Prompt to Audio，模型标识 `fal-ai/ace-step/prompt-to-audio`，服务端密钥变量仍为 `FAL_KEY`。服务端发送顶层 `prompt`、`instrumental=true` 与 `duration=28`，轮询 queue 状态并读取 `audio.url`。ACE-Step 真实请求返回 `source=api` 和 WAV 音频地址；无头 Edge 已加载音频元数据，时长 27.96 秒。

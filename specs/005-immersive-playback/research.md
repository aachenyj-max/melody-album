# 研究记录：沉浸式播放与自然语言调整

## 决策 1：保留现有路由与局部客户端边界

**Decision**: `app/(album)/play/page.tsx` 继续在服务端等待 `searchParams`，把 `/play`、`?state=adjust`、`?state=save` 分别映射到 05、06、07；媒体、进度、上拉解释和指令输入放在独立 Client Component。`(album)` 布局承载当前创作会话，不把照片、音源或指令放进 URL。

**Rationale**: 当前项目已有该路由与九画面 App Shell。已安装的 Next.js 16.3.8 文档规定 `searchParams` 为 Promise，客户端浏览器 API 与事件需要 Client Component；布局可在内部导航间保留状态。局部客户端边界避免把其余静态页面都变成客户端代码。

**Alternatives considered**: 新建第二套播放路由会破坏 HTML 热点；用 URL、模块全局变量或持久存储携带照片与记忆会扩大暴露面并违背当前会话规则；整个 `AlbumScreen` 客户端化会增加无关页面脚本。

**Source**: `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`、`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md`、`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/layout.md`；[Next.js Client Components](https://nextjs.org/docs/app/api-reference/directives/use-client)。

## 决策 2：以真实媒体事件维护唯一播放状态

**Decision**: 使用浏览器原生 `HTMLAudioElement`，由当前创作会话中的一个控制者持有。`play()` 的完成/拒绝及 `loadedmetadata`、`timeupdate`、`play`、`pause`、`ended`、`error` 等事件决定可播放状态、时长与进度。切换音源前停掉旧源；离开当前创作流程时清理。进入 06 调整页时暂停，返回 05 后按用户操作恢复或从头试听。

**Rationale**: 05 号播放器目前只是固定 0:12/0:28、42% 进度及禁用按钮，不能作为真实状态源。浏览器可能拒绝自动播放，不能仅凭“进入页面”把图标设为暂停。单一音频拥有者可避免结果页等待音乐、播放页配乐和调整预览重叠。

**Alternatives considered**: 独立定时器模拟进度会与实际声音漂移；为每个页面创建不协调的音频实例会在导航和切换时重叠；引入第三方播放器库对 15–30 秒 MVP 片段没有必要。

**Source**: [MDN `HTMLMediaElement.play()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play)、[MDN autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay)。

## 决策 3：照片位置从音频进度推导

**Decision**: 对已知有效音频时长和 1–9 张照片，根据当前进度均匀映射到照片索引，并采用慢速淡入淡出。暂停保持当前照片，拖动进度立即更新；单张照片保持不切换。时长未知或资源出错时保留第一张可用照片。尊重现有 `prefers-reduced-motion` 规则。

**Rationale**: 规格只要求照片与音乐共同播放及缓慢切换，不要求节拍卡点。用同一媒体时间轴能避免两个独立计时器漂移，并符合宪章的简单实现原则。

**Alternatives considered**: 独立循环幻灯片可能与暂停/拖动不同步；复杂节拍分析与逐帧剪辑属于后续范围。

## 决策 4：沿用 SDD-03 的音乐选择和来源

**Decision**: 04→05 交接固定本次已确认 `MemoryProfile`、照片顺序、`MusicProfile`、生成轮次、默认 AI 或用户主动选择的可播放推荐，以及当前可用音源。AI 仍在生成时继续等待音乐，完成后仅在保持 AI 路径且用户未暂停时切换；用户已选推荐时不得抢播。等待音乐与演示配乐都要有清楚身份，等待音乐不能成为可保存版本。

**Rationale**: SDD-03 已落地 `ConfirmedMemory`、`MusicRun`、`AiTrack`、`MockRecommendation` 与本地等待音乐。本阶段从同一 Provider 读取并按原有选择播放，不创建第二套结果状态。

**Alternatives considered**: 在播放页重做音乐编排会重复请求和导致版本串台；把静态 `demo-data.ts` 的歌曲元信息当成可播放音源会出现无声假成功。

**Source**: `specs/004-music-orchestration/spec.md`、`specs/003-agent-memory-understanding/data-model.md`、`components/music-album/album-screen.tsx`。

## 决策 5：调整复用音乐编排边界，旧版可恢复

**Decision**: 每条非空指令关联当前记忆版本、当前音乐意图、所选路径和当前成功音乐版本，并产生唯一调整轮次。AI 路径要求新配乐，推荐路径要求新的推荐；具体供应商调用仍由 SDD-03 的服务端适配边界负责。生成中保留旧版，只有新资源可播放才发布为当前版本；失败、超时或无效资源保留旧版。新轮次取消或忽略旧请求响应。

**Rationale**: 用户连续输入时旧结果不能覆盖新选择。AI 调整沿用 SDD-03 已接入的 fal.ai ACE-Step，QQ 调整仍只匹配本地 mock；浏览器拦截的演示场景用于验证状态，不能据此宣称真实生成成功。

**Alternatives considered**: 前端只修改标题而不改变音频会误导用户；失败时先清空旧版会中断已有可播放记忆；把全部版本永久保存会提前进入 SDD-05 和后续多版本比较范围。

## 决策 6：05/06 视觉结构渐进替换，冲突单列

**Decision**: 保留当前 05 的全幅照片、约 63–87% 的玻璃播放器及底部两按钮，保留 06 的浅色对话、照片/卡片叠层、快捷建议和固定输入区。替换硬编码数据与假链接而不重排 DOM 主结构。05 右按钮依现有导航契约保留“查看 AI 理解”可见文案并进入 07；AI 解释以默认收起的上拉层提供，05–07 联调记录文案语义冲突。

**Rationale**: 05、06 PNG 是视觉依据，HTML 热点是主要跳转依据。现有 CSS 已按手机外壳比例布置这些元素，直接增强可降低视觉回归。此处文案与跳转无法完全语义一致，不能隐瞒为已解决。

**Alternatives considered**: 改右按钮文字会偏离 PNG；改其目标会偏离 HTML；增加第三个主按钮会改变原稿结构。

**Source**: `designs/ui/05-沉浸式播放页.png`、`designs/ui/06-调整音乐-Agent对话页.png`、`音乐相册-ui还原.html`、`components/music-album/design-map.ts`、`app/globals.css`。

## 决策 7：保存入口只接受可播放成品

**Decision**: 05 号页只有在当前选择存在可播放的 AI 配乐或 QQ 音乐时才允许按 HTML 热点进入 07 号保存页。AI 生成中的通用等待音乐、只有元信息的推荐和加载失败的候选都不能触发保存跳转；此时入口保持不可用并说明等待或重试原因。AI 解释仍由独立上拉区域提供。

**Rationale**: SDD-05 保存的是可再次打开的音乐相册，等待音频没有个性化身份，元信息也不能保证刷新后可播放。提前进入保存页会产生“已经保存”的误解，并迫使保存页处理无效音乐候选。

**Alternatives considered**: 允许进入 07 再阻止提交会让用户走到不能完成的表单；把等待音乐先保存再替换会扩大 SDD-05 的版本和异步更新范围；把 PNG 文案改成“保存相册”会破坏视觉验收，因此保留原文案。

## 决策 8：扩展现有音乐会话，不创建第二套播放状态

**Decision**: 以 `app/(album)/layout.tsx` 中现有的 `CreationSessionProvider`、`MusicSessionProvider` 和 `components/music-album/music-session.tsx` 作为 04→05→06 的状态边界；播放控制、照片进度、调整轮次和保存资格都在同一会话上补齐。现有 `/api/music/generate` 和 `lib/music/contract.ts` 作为 SDD-03 的上游边界，SDD-04 只增加调整入口和客户端媒体行为。

**Rationale**: 当前仓库已有照片确认交接、音乐生成请求、演示推荐和等待音频。新增 Provider 或重新编排音乐会造成状态分叉、音频重叠和旧响应覆盖。

**Alternatives considered**: 在 `album-screen.tsx` 内重新管理所有状态会扩大客户端边界；通过 URL 或浏览器持久存储携带照片和音源会暴露临时数据；重新实现生成接口会重复上游契约。

## 未解决的外部条件

- SDD-03 已完成并提供可播放音源。fal.ai ACE-Step 为真实 AI 生成来源；QQ 路径继续使用明确标识的本地 mock，不能据此宣称接通真实曲库。
- 音频地址可能过期或网络加载失败；客户端发布调整版本前再次通过媒体元数据校验，失败保留原版。

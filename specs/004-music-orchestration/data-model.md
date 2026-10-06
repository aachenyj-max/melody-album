# 数据模型：音乐结果编排与等待兜底

本阶段数据只存在于当前浏览器创作会话及单次服务端请求中；不创建数据库表、对象存储或持久运行历史。SDD-02 的 `ConfirmedMemory` 是唯一输入，SDD-05 再定义保存映射。

## 上游输入 `ConfirmedMemory`

| 字段 | 约束与用途 |
| --- | --- |
| `profile` | SDD-02 已确认的有效 `MemoryProfile`；`title` 非空，`event` 或 `atmosphere` 至少一项非空，`photoOrder` 恰好覆盖所有照片 |
| `photos` | 1–9 个当前导航会话的源 `File` 引用；不发送到音乐 API，不写入本阶段存储 |

结果页只接收确认时的 `profile.version`，不得消费修正中或过期版本。照片预览 URL 由使用它的页面创建并释放；音乐请求只携带必要的文本意图。

## 音乐意图 `MusicProfile`

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `contractVersion` | `1` | 本阶段内部契约版本 |
| `memoryVersion` | `number` | 与确认的 Memory Profile 版本相同 |
| `memoryTitle` | `string` | 当前确认标题，仅用于关联与展示，最长 100 字 |
| `mood` | `string` | 从已确认氛围或事件提炼，非空且最长 100 字；未知时使用中性表达 |
| `style` | `string` | 适合当前情绪的无歌词音乐风格，非空且最长 100 字；不能编造人物、地点或故事事实 |
| `tempo` | `slow \| moderate \| lively` | 从氛围得到；没有明显依据时为 `moderate` |
| `structure` | `gentle \| steady \| uplifting` | 目标 15–30 秒的音乐走势；没有明显依据时为 `steady` |
| `instrumentalPrompt` | `string` | 由以上字段合成的非空短文本，最长 600 字，明确“无歌词、无人声”；不得包含原图、完整用户故事或密钥 |
| `targetDurationSec` | `number` | 15–30 的整数 |

同一份已确认记忆和同一转换规则必须得到相同的 `MusicProfile`。自然语言调整及多个版本由 SDD-04 定义；本阶段只生成初版。

## 音乐运行 `MusicRun`

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `runId` | `string` | 当前会话唯一，用于防止旧响应覆盖 |
| `creationEpoch` | `number` | 新一次创建递增；只接受当前 epoch 的结果 |
| `profile` | `MusicProfile` | 关联确认的记忆版本 |
| `ai` | `AiBranch` | 一次 AI 配乐路径及重试状态 |
| `recommendations` | `RecommendationBranch` | 当前 Demo 的 QQ mock 推荐及其状态 |
| `selection` | `MusicSelection` | 默认 AI，用户可主动选择一首可播放 mock 推荐 |
| `ambientTrack` | `PlayableAudio \| null` | 等待音乐；永不进入 AI 成品字段 |

同一会话同一时刻最多一个活动运行。新建创作或确认了不同版本时废弃旧 `runId`、停止播放、丢弃旧响应。

## AI 配乐路径 `AiBranch`

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `status` | `idle \| pending \| ready \| failed` | 仅 `ready` 可含成品音频 |
| `attemptId` | `string` | 每次重试更新；过期响应不覆盖当前尝试 |
| `source` | `api \| demo \| null` | `demo` 必须显示“演示配乐”；真实调用失败不改写为 `demo` |
| `progressPercent` | `number \| null` | 仅接收真实可信的 0–100 进展；未知为 `null` |
| `track` | `AiTrack \| null` | `ready` 时必需且音频已验证可用；其余状态为 `null` |
| `error` | `MusicError \| null` | `failed` 时必需；重试开始时清除 |

`AiTrack` 包含 `title`、`durationSec`、`audioUrl`、`audioMimeType`、`source`，可选 `expiresAt`。`durationSec` 是请求 ACE-Step 生成的目标时长，应落在 15–30 秒；浏览器加载元数据确认至少 15 秒可播，若返回音频较长则在目标时长停止。页面不得展示原型中的固定 60% 作为真实进展。

## QQ mock 推荐路径 `RecommendationBranch`

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `status` | `idle \| pending \| ready \| empty \| failed` | 与 AI 路径独立；mock 亦可用于故障场景验收 |
| `attemptId` | `string` | 重试时更新，避免旧结果覆盖 |
| `tracks` | `MockRecommendation[]` | `ready` 时至少一首；`empty/failed` 时可为空 |
| `error` | `MusicError \| null` | 失败时供用户识别与重试 |

`MockRecommendation` 包含稳定 `id`、演示标题与演示艺人标识、封面或占位、`durationSec`、推荐理由、`source='mock'`、`audioUrl: string | null`。`playable` 由音频资源是否存在且可打开推导，不可仅因有歌名而为真。当前历史数据 `DemoTrack.status='placeholder'` 不进入此集合。

## 当前选择 `MusicSelection` 与音频会话

```text
MusicSelection = { kind: 'ai' } | { kind: 'qq', trackId: string }
AudioKind = 'none' | 'ambient' | 'ai' | 'qq'
AudioState = 'idle' | 'playing' | 'paused' | 'blocked' | 'failed'
```

- 默认 `selection.kind='ai'`。AI `pending` 且等待音乐可播时，进入 05 号页交接 `ambient`；AI `ready` 时交接 `ai`。
- 用户主动选择 `qq` 前必须验证对应 `trackId` 存在且可播。切换浏览标签本身不改变 `selection`。
- `qq` 已选时，即使 AI 后续变为 `ready`，音频会话也不自动切换；切回 AI 路径时才按当时状态选择成品或等待音乐。
- AI `failed` 时结束 `ambient`；可重试或主动选择可播 QQ 曲目。无可播 QQ 且 AI 失败时不能进入空音源播放。
- 单一音频会话在 `/result` 与 `/play` 之间保持当前实际播放状态；浏览器拦截自动播放时为 `blocked`，不能显示 `playing`。
- 当前会话只允许一个活动音源；替换时先完成旧音源淡出或停止，再启动新音源，不得并行播放。

## 状态转换

```text
confirmed → profile-ready → ai.pending + recommendations.pending
                              ├─ ai.ready / ai.failed
                              └─ recommendations.ready / empty / failed

ai.failed → retry → ai.pending → ai.ready / ai.failed
recommendations.failed|empty → retry → recommendations.pending → ready / empty / failed
new creation / leave workflow → stop audio + invalidate run + release previews
```

两路状态互不清空：AI 失败保留已成功推荐，推荐失败保留已成功 AI。请求取消或旧 `runId/attemptId` 的晚到响应不能更新页面。

## 关系与不变量

- 一个 `ConfirmedMemory` 在本阶段对应一个初始 `MusicProfile`；一次活动 `MusicRun` 关联这两者及当前照片。
- QQ mock `source` 与 AI `source` 均面向用户可见；不得把演示音频声明为真实生成或真实 QQ 曲库内容。
- `ambientTrack` 只用于等待，不写入 `AiTrack`，也不能作为保存时的原创配乐。
- 服务端不记录原图、完整故事、提示词或音频 URL 的原文日志；错误只保留非敏感分类和请求标识。
- 无照片或有效记忆交接时不创建 `MusicRun`；直达与刷新 `/result` 显示空状态。

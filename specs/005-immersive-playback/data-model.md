# 数据模型：沉浸式播放与自然语言调整

本阶段数据只存在于当前创作会话。照片、记忆与音乐意图承接 SDD-02/03；保存相册与跨刷新读取留给 SDD-05。字段是阶段交接的最低要求，实施时优先复用上游已建立的同义类型。

## 已落地类型映射（2026-10-06）

以下各表描述业务含义，实际实现没有另建 `PlaybackSession`、`PlayableTrack` 或 `AiExplanation` 类。`CreationSessionProvider.confirmed` 持有 `ConfirmedMemory`；`MusicSessionProvider.run` 持有 `MusicRun`（`runId`、`profile`、`selection`、`ai`、`recommendations`、`ambientTrack`、`currentVersionId`、`adjustedTrack`）。`PlayFlow` 按 `profile.photoOrder` 生成临时照片 URL，按 `currentTime / duration` 推导照片索引。离开页面即撤销这些 URL。

当前音源是现有的 `AiTrack`、`MockRecommendation` 或 `PlayableAudio`，其来源值实际为 `api`、`demo`、`mock`、`ambient`；`api` 表示 fal.ai ACE-Step，`mock` 表示本地 QQ 演示推荐。版本 ID 取 AI 原始 `attemptId`、QQ 曲目 ID 或调整 `requestId`，存在 `run.currentVersionId`。调整后的 AI 音源和解释存于 `run.adjustedTrack`；调整后的 QQ 推荐替换同 ID 推荐并更新 `selection`。通用等待音乐不取得版本 ID。

媒体状态实际由 `audioState`（`idle | starting | playing | paused | ended | blocked | failed`）、`audioKind`、`currentTime`、`duration` 和单一 `HTMLAudioElement` 组成。`blocked` 表示设备拒绝自动播放；`failed` 表示音频加载/播放失败。`AdjustmentRun[]` 实际记录 `id`、`instruction`、`baseTrackId`、`path`、`status`、`responseText` 与 `error`；轮次候选通过浏览器媒体元数据检查后才写入 `MusicRun`。解释的展开状态只在 `PlayFlow` 的局部状态，展开不会创建音频实例。

## 播放会话 `PlaybackSession`

| 字段 | 类型 | 约束与含义 |
| --- | --- | --- |
| `memory` | `ConfirmedMemory` | SDD-02 已确认的有效 `MemoryProfile` 与本次源照片；不得替换成历史 mock |
| `orderedPhotos` | `PhotoRef[]` | 按 `profile.photoOrder` 排列的 1–9 张当前照片；预览地址是临时引用 |
| `musicProfile` | `MusicProfile` | SDD-03 从该记忆生成的当前音乐意图，至少有情绪、风格、节奏、结构 |
| `generationRunId` | `string` | 对应 SDD-03 当前结果轮次，防止新旧记忆和生成结果混用 |
| `selectedPath` | `ai \| qq` | 默认 AI；只有用户主动选择可播放推荐时才变为 QQ 路径 |
| `currentVersionId` | `string \| null` | 当前已成功且可播放的音乐版本；等待音乐不占用此字段 |
| `waitingTrack` | `PlayableTrack \| null` | AI 尚在生成时的通用氛围音乐；不能作为已完成版本或保存内容 |
| `adjustments` | `AdjustmentRun[]` | 本次会话的调整记录，最末有效轮次决定当前候选结果 |

`ConfirmedMemory` 使用 SDD-02 的最低有效条件：标题非空，事件或氛围至少有一项非空，照片索引恰好覆盖当前照片。会话不写 URL、`localStorage`、`sessionStorage` 或数据库；直接访问/刷新 05、06 后没有交接时显示空状态。离开创建流程须清理照片对象 URL 与音频。

### 保存入口资格

保存资格不是独立的音乐版本，而是由当前播放会话即时推导：

| 条件 | `canEnterSave` | 行为 |
| --- | --- | --- |
| `currentVersionId` 指向已验证可播放的 AI 或 QQ 音乐 | `true` | 05 右侧按钮按 HTML 热点进入 07，并交接当前成品 |
| 只有 `waitingTrack`，或当前版本音频为空/加载失败 | `false` | 保存入口不可用并说明等待或重试；不得进入 07 |
| 没有本次交接或当前记忆已失效 | `false` | 05/06 显示空状态，返回结果页 |

通用等待音乐永远不占用 `currentVersionId`。保存资格变化不会自动恢复或切换播放，只影响 05 号页的入口可用性。

## 可播放音源 `PlayableTrack`

| 字段 | 类型 | 约束与含义 |
| --- | --- | --- |
| `id` | `string` | 本次会话中唯一；调整成功产生新 ID |
| `kind` | `ai \| qq \| waiting` | 区分个性化配乐、推荐歌曲和通用等待音乐 |
| `source` | `api \| demo \| mock \| ambient` | `api` 为真实 fal.ai；QQ `mock` 和等待 `ambient` 分别标明 |
| `title` | `string` | 非空的曲目显示名 |
| `audioUrl` | `string` | 可供浏览器加载的实际音频地址或当前会话对象地址；空值不可标为可播放 |
| `declaredDurationSeconds` | `number \| null` | 来源提供的时长提示；可拖动范围与进度以实际媒体元数据为准 |
| `musicProfileVersion` | `number \| null` | 个性化配乐对应的音乐意图版本；通用等待音乐为 `null` |
| `explanation` | `string \| null` | 有依据的音乐情绪说明，关联当前版本；无依据时不编造 |

AI 配乐版本、QQ 推荐版本与等待音乐的身份不可互换。元信息存在而音频地址为空、格式不支持或加载失败，均视为不可播放。试听成功仅表示当前浏览器能播放该资源，不能替代真实外部服务验收。

## 播放状态 `PlaybackState`

| 字段 | 类型 | 约束与含义 |
| --- | --- | --- |
| `trackId` | `string \| null` | 当前发声或等待播放的音源，必须来自本次会话 |
| `status` | `idle \| starting \| playing \| paused \| ended \| blocked \| failed` | 根据真实媒体调用和事件更新；`blocked` 可手动开始 |
| `currentTimeSeconds` | `number` | 实际媒体位置；非负，不超过已知时长 |
| `durationSeconds` | `number \| null` | 实际元数据给出有限正数时才存在；否则不显示伪造结束时间 |
| `photoIndex` | `number` | 当前照片索引，范围 `0..orderedPhotos.length-1` |
| `manualStartRequired` | `boolean` | `play()` 被设备策略拒绝时为真，提示用户手动播放 |
| `error` | `PlaybackError \| null` | 不可用、网络中断、格式不支持等可读状态 |

已知时长时，照片索引由 `currentTimeSeconds / durationSeconds` 与照片数量推导；拖动音频、重新播放或片段结束时同步更新。上一张/下一张控件跳到相邻照片对应的时间段开头；仅一张照片时禁用这些控件。时长未知时保持第一张，并禁用依赖准确时长的跳转与拖动。

### 播放状态转换

```text
idle → starting → playing ↔ paused → ended → starting
          ↘ paused（自动播放受阻）
          ↘ error（音源/网络失败）
playing/paused → idle（换源或离开）
```

- `playing` 只能由成功的播放调用或媒体播放事件确认；`paused` 不随后台 AI 生成成功自动恢复为 `playing`。
- 从等待音乐换到个性化配乐前先停止旧音源；用户主动选中 QQ 推荐后，AI 完成不改变 `trackId`。
- 进入 06 号调整页暂停当前声音，保留当前成功音乐版本；退出当前创作流程停止并清理。

## 调整轮次 `AdjustmentRun`

| 字段 | 类型 | 约束与含义 |
| --- | --- | --- |
| `id` | `string` | 本次会话内唯一请求标识 |
| `instruction` | `string` | 去首尾空白后 1–300 字；空白不可提交 |
| `baseTrackId` | `string` | 提交时当前成功且可播放的音乐版本 |
| `path` | `ai \| qq` | AI 配乐重新生成，或推荐路径重新获取匹配推荐 |
| `status` | `pending \| succeeded \| failed \| cancelled` | 每轮独立记录，不把旧轮结果写入新轮 |
| `responseText` | `string \| null` | 给用户看的简短回应或失败说明 |
| `error` | `AdjustmentError \| null` | 失败或超时原因与可重试性 |

一个时刻最多有一个可提交中的有效轮次。新轮开始后，旧轮可取消或其迟到响应被忽略；旧成功版本直到新候选验证可播放前始终保留。失败和超时不递增当前音乐版本。用户点击“重新播放”时取最新成功且已选中的可播放版本，从 0 秒开始；如果没有新成功版本，保留旧版并说明。

提交时的记忆版本和完整音乐意图从当前 `ConfirmedMemory` 与 `MusicRun.profile` 读取，不在每条 `AdjustmentRun` 中重复存储。成功候选经浏览器音频检查后写入 `MusicRun`，不会在调整记录里保留未验证的音频地址。

## AI 解释 `AiExplanation`

| 字段 | 类型 | 约束与含义 |
| --- | --- | --- |
| `memoryVersion` | `number` | 与当前已确认记忆一致 |
| `trackId` | `string \| null` | 对应当前成功音乐版本；等待状态可以为空 |
| `memorySummary` | `string` | 基于已确认事件/氛围的简短回顾 |
| `musicReason` | `string \| null` | 当前版本的音乐情绪依据；没有可靠依据时说明尚未生成 |
| `isOpen` | `boolean` | 首次进入 05 号页为假；展开和收起不改变音频位置 |

## 关系与不变量

- 一份播放会话对应一份已确认记忆及当前 SDD-03 生成轮次；音乐版本、调整轮次和解释都必须指向这一份记忆。
- 等待音乐可以试听，但不能成为 `currentVersionId`，不能作为调整成功或保存成品。
- 一个时刻最多一个音源发声；音源失效时进度停止，页面显示真实错误与恢复操作。
- 演示来源必须可见，真实 API/曲库验收必须使用真实资源；mock 元信息没有音频时不允许进入无声播放。
- 07 号页只能接到当前成功版本和本次照片、记忆；实际保存由 SDD-05 完成。

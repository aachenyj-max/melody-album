# 契约：播放会话、调整指令与页面跳转

## 范围

本契约定义 SDD-03 结果页交给 SDD-04 的最低数据、05/06 号页的用户可见行为，以及调整调用边界。数据只在当前创作会话有效；URL 只表示视觉状态。实现时若 SDD-03 已提供等价字段和调用入口，复用它们并维持这里的行为，不建立第二套并行音源状态。

## 04→05：结果交接 `PlaybackHandoff`

| 字段 | 必需 | 规则 |
| --- | --- | --- |
| `confirmedMemory` | 是 | SDD-02 已确认的有效结果及本次照片，不接受未确认或历史 mock 相册 |
| `musicProfile` | 是 | SDD-03 基于该记忆的音乐意图及版本 |
| `generationRunId` | 是 | 与当前 AI/推荐状态一致；过期轮次不可覆盖 |
| `selectedPath` | 是 | `ai` 为默认；仅用户主动选中可播放 QQ 推荐后为 `qq` |
| `aiStatus` | 是 | `pending`、`ready` 或 `failed`，不可把等待音乐标为 `ready` |
| `selectedTrack` | 条件必需 | 已有可播放的 AI/QQ 音源；只有实际有音频时可进入正常播放 |
| `waitingTrack` | 条件必需 | AI 仍生成且选择为 AI 时的可播放通用氛围音乐 |
| `recommendations` | 否 | 原创失败时仍保留的推荐；只有有可播放音频者可选择继续 |

`selectedTrack` 和 `waitingTrack` 二者至少有一个实际可播放，才允许以当前选择进入 05。缺少本次交接时，05/06 显示空状态及“返回生成结果”，不得显示静态毕业示例为当前作品。直接打开或刷新 05/06 的处理相同。

保存资格另行判断：只有 `selectedTrack` 存在且实际可播放时，05 号页才允许按 HTML 热点进入 07；仅有 `waitingTrack`、只有元信息或音频加载失败时，保存入口保持不可用并说明等待或重试原因。

## 05：播放页 UI 与状态

| 操作或状态 | 预期行为 |
| --- | --- |
| 进入 `/play` | 显示本次照片、标题、短句、曲名、来源和真实音频状态；设备允许时开始播放，否则显示手动播放 |
| 中心播放按钮 | `playing` 时暂停；`paused`、`ended` 时继续或从头开始；失败时提供重试而非假切换图标 |
| 进度 | 根据媒体事件显示当前位置和实际时长；时长未知不伪造 `0:28`，拖动限于有效范围 |
| 上一张/下一张 | 多张且时长有效时跳到相邻照片对应片段；单张或时长未知时禁用并说明状态 |
| 照片轮播 | 依据音频进度缓慢切换；暂停时停留，拖动时同步，减弱动态效果设置下停用转场 |
| 上拉解释 | 默认关闭，显示本次已确认记忆及当前音乐理由；关闭后继续当前播放位置 |
| “调整音乐” | 进入 `/play?state=adjust`，暂停当前声音并保留成功版本 |
| 左上返回 | 进入 `/result`，停止声音，保留本次结果选择 |
| 右侧“查看 AI 理解” | 可见文案保留 PNG 原文；当 `selectedTrack` 可播放时按 HTML 热点进入 `/play?state=save` 并交接当前成品，本阶段不执行写入；没有可播放成品时入口不可用并说明原因。AI 解释由独立上拉区域查看 |

05 右侧可见文案取自 PNG，跳转取自 HTML，两者语义冲突。AI 解释由独立上拉层承载；05–07 联调需将此风险列入验收记录。不能把进入 07 当作保存成功。更多、收藏等原稿可见但本阶段未开放的控件须有明确禁用状态或说明，不能执行虚假操作。

AI 等待音乐接续规则：保持 AI 路径且用户仍处于播放状态时，AI 成功才可停掉等待音乐并切换；已暂停时只更新可用音源，不自动恢复声音；已主动选 QQ 推荐时，AI 完成不抢播。AI 失败时停止无限等待，保留可播放推荐入口；都不可播时返回结果页重试。

## 06：自然语言调整 UI

1. `/play?state=adjust` 保留本次会话的照片、音乐预览和对话。示例对话不能伪装成用户已经提交的真实指令。
2. 输入去首尾空白后必须为 1–300 字；“再快一点”“多一点吉他”“换一种风格”等快捷建议与发送自定义指令走同一调整流程，不直接跳回 05。
3. 发送后立即显示用户指令与 `pending`；旧版仍可用。重复点击同一轮不触发重复请求；新一轮开始时，较旧响应不能覆盖当前轮。
4. 成功且新音源可播时显示回应、当前音乐预览及“重新播放”；点击后进入 `/play`，从新版本 0 秒试听。HTML 把发送热点直接指向 05；真实请求的生成中和失败状态仍需留在 06，成功后到达 05 作为该热点的最终目标，并在逐页验收中记录等待期间的行为。
5. 失败、超时或无可播音源时显示错误与重试；返回 `/play` 时继续旧成功版本。未成功前不得把候选版本传给 07。
6. 左上返回及音乐卡“重新播放”热点均回到 05；返回不等于调整成功。发送失败时不自动跳往 05 冒充新结果。

## 调整调用边界

使用同源 `POST /api/music/adjust`，服务端复用 SDD-03 的 `generateMusic()`；浏览器不得直连需保密凭证的真实生成服务。QQ 路径只在本地演示推荐目录中重新匹配，响应标为 `source=mock`。

### 请求 `AdjustmentRequest`

```json
{
  "contractVersion": 1,
  "requestId": "current-round-id",
  "profile": {
    "contractVersion": 1,
    "memoryVersion": 1,
    "memoryTitle": "2026 · 毕业那天",
    "mood": "温暖而明亮",
    "style": "钢琴与木吉他",
    "tempo": "moderate",
    "structure": "steady",
    "instrumentalPrompt": "无歌词、无人声，温暖明亮的钢琴与木吉他器乐配乐。",
    "targetDurationSec": 28
  },
  "path": "ai",
  "baseTrackId": "current-playable-version-id",
  "instruction": "更快乐一点"
}
```

`profile` 必须通过 SDD-03 的 `validateMusicProfile`；指令去首尾空白后为 1–300 字，`requestId` 和 `baseTrackId` 必须存在。服务端不接收照片文件；本次已确认记忆、生成轮次与基础音乐版本的对应关系由客户端当前会话检查，并以 `runId` 与有效调整 ID 丢弃迟到响应。请求与响应不得被共享缓存；日志不得输出个人照片、故事、完整指令或私密音频地址。

### 成功 `AdjustmentSuccess`

```json
{
  "contractVersion": 1,
  "requestId": "current-round-id",
  "source": "api",
  "track": { "title": "ACE-Step · 无歌词配乐", "durationSec": 28, "audioUrl": "valid-audio-resource", "audioMimeType": "audio/wav", "source": "api" },
  "responseText": "已经根据你的想法调整音乐，可以重新试听。"
}
```

路由返回候选；浏览器再次加载媒体元数据并验证有效时长后，才以 `requestId` 作为新版本 ID 并将调整状态置为 `succeeded`。真实与演示来源按 `api`、`demo`、`mock` 显示。推荐路径返回 `MockRecommendation` 字段（含 `id`、`artist`、`reason`、`audioUrl`、`playable`）；演示推荐共用本地试听音频，不能写成真实 QQ 曲库或独立歌曲音源。只有元信息的推荐不算成功。

### 失败 `AdjustmentFailure`

```json
{
  "contractVersion": 1,
  "requestId": "current-round-id",
  "error": { "code": "GENERATION_TIMEOUT", "message": "调整用时较长，请重试。", "retryable": true }
}
```

| 错误类别 | 页面行为 |
| --- | --- |
| `INVALID_CONTEXT`、`INVALID_INSTRUCTION` | 提示回到有效结果或修改指令；不清空旧版本 |
| `GENERATION_UNAVAILABLE`、`GENERATION_TIMEOUT`、网络中断 | 提示重试；旧版继续可用 |
| `NO_PLAYABLE_RESULT` | 不发布候选；说明未得到可试听音频，允许重试 |
| `UNKNOWN` | 通用失败提示与返回播放入口 |

响应 `requestId` 必须匹配当前有效调整轮次；不匹配时丢弃，不更新音乐、解释或播放状态。fal.ai ACE-Step 已由 SDD-03 接入；本地演示适配器和 QQ mock 必须保留可见来源标识。

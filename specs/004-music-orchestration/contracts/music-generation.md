# 契约：文字生成音乐与内部生成入口

## 范围

本契约定义 SDD-03 结果页与同源服务端之间的稳定边界，版本 `1`。当前真实供应商为 fal.ai 的 ACE-Step Prompt to Audio，模型标识 `fal-ai/ace-step/prompt-to-audio`；服务端读取 `FAL_KEY`，不能把密钥发送到浏览器。未配置 `FAL_KEY` 时使用相同响应形状的显式演示适配器。

## `POST /api/music/generate`

**请求**：`application/json`；每次只生成一段无歌词音乐。请求及响应均不得被共享缓存；浏览器不发送照片文件、原始故事或密钥。

```json
{
  "contractVersion": 1,
  "requestId": "opaque-current-attempt-id",
  "profile": {
    "contractVersion": 1,
    "memoryVersion": 2,
    "memoryTitle": "2026 · 毕业那天",
    "mood": "快乐中带一点不舍",
    "style": "轻快钢琴与吉他",
    "tempo": "moderate",
    "structure": "uplifting",
    "instrumentalPrompt": "无歌词、无人声，轻快钢琴与吉他，快乐中带一点不舍，逐渐明亮的结尾。",
    "targetDurationSec": 28
  }
}
```

服务端验证版本、非空文本、`memoryTitle/mood/style` 各不超过 100 字、`instrumentalPrompt` 不超过 600 字、枚举和 15–30 秒目标时长。供应商的 `prompt` 使用已验证的 `instrumentalPrompt`（模型允许 10–2000 字符），通过 fal queue API 提交并轮询完成结果；不能相信客户端传来的任意外部 URL 或额外字段。

**成功**：HTTP 200。一次请求只返回完成结果；浏览器在请求进行中显示 `pending`。若供应商使用异步任务，适配器负责按其真实契约等待或查询，受部署时限约束；该实现须等 API 文档到位后确认。

```json
{
  "contractVersion": 1,
  "requestId": "opaque-current-attempt-id",
  "source": "demo",
  "track": {
    "title": "青春的回声",
    "durationSec": 28,
    "audioUrl": "/audio/music-album/demo-ai.wav",
    "audioMimeType": "audio/wav",
    "expiresAt": null
  }
}
```

`source="demo"` 必须在页面展示“演示配乐”；`source="api"` 只有真实外部调用成功且音频可供浏览器访问时才允许。`audioUrl` 可为受控本地路径或真实服务返回的可播放地址；最终可播性须在浏览器加载音频时确认。无法加载时不得把音频标为可播放，应转为失败并保留 QQ mock 推荐。

**失败**：统一响应，不回传供应商密钥、完整提示词、私人记忆原文或内部错误堆栈。

```json
{
  "contractVersion": 1,
  "requestId": "opaque-current-attempt-id",
  "error": {
    "code": "GENERATION_TIMEOUT",
    "message": "配乐生成用时较长，请重试。",
    "retryable": true
  }
}
```

| 错误码 | HTTP | 用户端处理 |
| --- | --- | --- |
| `INVALID_PROFILE` | 400 | 保留确认记忆，提示重新确认或返回修正 |
| `GENERATION_UNAVAILABLE` | 503 | 标记 AI 失败，保留推荐，允许重试 |
| `GENERATION_TIMEOUT` | 504 | 结束等待音频，保留推荐，允许重试 |
| `INVALID_GENERATED_AUDIO` | 502 | 生成结果缺少可播音频、格式不可用或时长不合要求；不展示伪成功 |
| `PROVIDER_ERROR` | 502 | 标记 AI 失败，保留推荐，允许重试 |
| `UNKNOWN` | 500 | 显示通用失败提示，保留推荐及安全返回 |

客户端网络断开视作可重试失败；只接收当前 `runId` 与 `attemptId` 对应的响应，晚到结果丢弃。服务端保留非敏感请求标识、错误类别与耗时即可，不记录正文。

## fal.ai 适配器约定

- 未配置 `FAL_KEY`：返回固定本地演示音频，`source=demo`。
- 已配置 `FAL_KEY`：调用 `fal-ai/ace-step/prompt-to-audio` 的 queue endpoint，轮询到 `COMPLETED` 后读取 `audio.url`；外部失败必须返回错误，不自动伪装为 `demo`。
- ACE-Step 接收 `prompt`、`instrumental` 和 `duration`；本阶段发送 `instrumental=true`、`duration=targetDurationSec`（默认 28 秒），并在 prompt 中明确“无歌词、无人声”，不发送原图或完整照片故事。
- 浏览器加载音频元数据后确认至少 15 秒可播放，并在目标时长停止。不能把请求成功等同于浏览器播放成功。

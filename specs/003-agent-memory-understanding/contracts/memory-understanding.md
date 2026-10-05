# 契约：照片理解、自然语言修正与确认交接

## 范围与版本

本文件定义 SDD-02 用户端与同源服务端之间的最小契约，以及交给 SDD-03 的确认结果。契约版本为 `1`。真实 Pi Agent 的供应商字段、地址和鉴权尚未取得；服务端适配时映射到此契约，不把供应商字段直接传给页面。

## 共同规则

- 请求与响应只用于当前创建流程，不创建相册、照片存储对象或运行历史。
- 浏览器保留源图用于预览，向服务端发送按原顺序生成的临时 JPEG 分析图。照片顺序由重复的 `photos` 字段顺序决定，索引从 0 开始。
- 整个 multipart 请求体必须 ≤3.5 MiB，给目标托管 4.5 MB Function 上限留余量；服务端重新验证请求大小、照片数量/类型和文本长度，不能只信任浏览器校验。
- 服务端仅在已配置真实能力时调用真实 Agent；无配置时返回标为 `demo` 的稳定演示结果。真实请求失败时返回错误，不静默替换为演示结果。
- 对请求正文、照片二进制、用户故事、修正指令和完整理解结果禁用原文日志；错误日志只记录请求标识、类别和耗时。响应不得被共享缓存。
- 仅在本地开发且使用演示适配器时，可用 `X-Demo-Scenario` 头选择 `success`、`partial`、`invalid-result`、`timeout`、`unavailable` 或 `revision-unclear` 验收状态；生产环境忽略该头，用户界面不展示场景开关。

## `POST /api/memory/understand`

**编码**：`multipart/form-data`

| 字段 | 必需 | 规则 |
| --- | --- | --- |
| `photos` | 是 | 重复字段，1–9 张浏览器生成的 JPEG 分析图；整个请求体 ≤3.5 MiB；源图不发送 |
| `story` | 否 | 去除首尾空白后 ≤1000 字；空字符串等同未提供 |

**成功**：HTTP 200，返回下述 `MemorySuccess`。即使人物或时间线未识别，只要满足最低可确认条件仍返回成功；未知字段为 `null`。

## `POST /api/memory/revise`

**编码**：`multipart/form-data`

| 字段 | 必需 | 规则 |
| --- | --- | --- |
| `photos` | 是 | 与当前草稿相同顺序和同一照片集合的分析图，验证规则同理解入口 |
| `story` | 否 | 原故事，规则同理解入口 |
| `profile` | 是 | 当前有效 `MemoryProfile` 的 JSON 字符串，版本与照片索引须合法 |
| `baseVersion` | 是 | 当前有效结果版本，须与 `profile.version` 一致 |
| `instruction` | 是 | 去除首尾空白后 1–300 字 |

**成功**：HTTP 200，新 `profile.version = 提交版本 + 1`。无法理解修正指令时返回 `REVISION_UNCLEAR`，不覆盖当前有效结果。

## 成功响应 `MemorySuccess`

```json
{
  "contractVersion": 1,
  "requestId": "opaque-request-id",
  "profile": {
    "version": 1,
    "title": "2026 · 毕业那天",
    "people": ["朋友"],
    "event": "大学毕业与校园告别",
    "atmosphere": "快乐中带一点不舍",
    "timeline": [{ "label": "毕业典礼后合影", "photoIndices": [0, 1] }],
    "photoOrder": [0, 1],
    "source": "demo"
  }
}
```

`people`、`event`、`atmosphere`、`timeline` 未识别时为 `null`；空字符串和空数组须规范化。`title` 必须非空，且 `event` 或 `atmosphere` 至少一项非空；`photoOrder` 恰好覆盖所有提交照片的索引。不能满足时返回 `INVALID_RESULT`，而非伪造成功。页面对 `source=demo` 显示“演示结果”标识。

## 失败响应 `MemoryFailure`

```json
{
  "contractVersion": 1,
  "requestId": "opaque-request-id",
  "error": {
    "code": "AGENT_TIMEOUT",
    "message": "理解照片用时较长，请重试。",
    "retryable": true
  }
}
```

| `error.code` | HTTP 状态 | 用户端处理 |
| --- | --- | --- |
| `INVALID_PHOTO_COUNT` | 400 | 说明需选择 1–9 张，保留有效照片 |
| `UNSUPPORTED_FILE` | 400 | 指出不支持的照片，允许移除或重选 |
| `PHOTO_TOO_LARGE` | 413 | 说明单张或总量限制，允许移除或重选 |
| `REQUEST_TOO_LARGE` | 413 | 分析图或表单整体超出 3.5 MiB；提示移除/更换照片后重试 |
| `PHOTO_READ_FAILED` | 422 | 说明照片无法读取，允许移除或重选 |
| `INVALID_STORY` | 400 | 说明故事字数限制，不清空其他输入 |
| `INVALID_PROFILE` | 400 | 说明当前结果已失效，允许重新理解 |
| `INVALID_INSTRUCTION` | 400 | 提示输入具体修正内容，保留现有结果 |
| `REVISION_UNCLEAR` | 422 | 提示换一种说法，保留现有结果 |
| `INVALID_RESULT` | 502 | 说明本次未得到可确认理解，允许重试或补充故事 |
| `AGENT_UNAVAILABLE` | 503 | 说明服务暂不可用，允许重试或返回 |
| `AGENT_TIMEOUT` | 504 | 说明处理超时，允许重试或返回 |
| `UNKNOWN` | 500 | 显示通用失败提示，允许重试或返回 |

客户端网络中断也映射为可重试状态，不应显示成功；取消或过期响应不更新当前页面。错误包不回传照片原文或服务端密钥。浏览器压缩失败时无需发请求，页面直接提示可移除或更换照片。

## 用户界面交接

1. `/create` 为新草稿；`/create?state=understanding` 只表示视觉状态，不代表存在照片或可确认结果。直接打开或刷新该 URL 时显示上传初始状态。
2. 理解结果必须显示标题、人物、事件、氛围、时间线五类区域，未识别区域显示“未识别”。符合最低内容条件的部分结果可确认。
3. 确认操作使用当前 `MemoryProfile` 和当前照片生成一次内存交接，随后导航 `/result`。结果页从自己的源图引用建立预览并释放，避免创建页释放对象 URL 后出现失效图片。后续 SDD-03 只能消费已确认版本；不能消费尚在修正或失败中的版本。
4. 确认前离开 `/create` 或刷新，照片、故事、理解结果和修正内容全部清除；返回是新的初始流程。已确认结果只在当前导航会话可用，不写入 URL 或浏览器持久存储；直接访问或刷新 `/result` 显示明确演示占位。

## 与真实 Agent 的适配边界

服务端的理解与修正适配必须分别接收照片/故事以及当前结果/修正指令，并返回 `MemoryProfile` 或 `MemoryFailure`。供应商专有的提示词、工具调用和错误码只在服务端映射。取得真实凭证后再确认其照片格式、大小和超时上限；不在客户端加入供应商密钥或直连地址。

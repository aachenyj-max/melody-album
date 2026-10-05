# 数据模型：Agent 创建与记忆理解

本阶段只建立当前浏览器导航会话的临时对象与请求契约，不创建业务表或照片持久化。字段名称以 [理解契约](contracts/memory-understanding.md) 为准。

## 创建草稿 `CreationDraft`

| 字段 | 类型 | 约束与含义 |
| --- | --- | --- |
| `photos` | `PhotoInput[]` | 1–9 张才可提交，保留用户当前排序；新增照片在末尾追加 |
| `story` | `string` | 可选，去除首尾空白后不超过 1000 字 |
| `profile` | `MemoryProfile \| null` | 当前最近一次有效理解结果；照片增删后置空，避免旧结果与新照片不一致 |
| `phase` | `CreationPhase` | 当前界面与操作状态 |
| `error` | `MemoryError \| null` | 最近一次失败；重试或修改输入后清除 |
| `activeRequestId` | `string \| null` | 防止过期响应覆盖最新输入或修正 |

**生命周期**：用户进入 `/create` 时为全新草稿。确认前刷新或离开创建页后返回，所有字段重置；确认时只把已确认的 `MemoryProfile` 与当前照片交给同一导航会话的结果入口。草稿不能被当作已保存相册。

## 照片输入 `PhotoInput`

| 字段 | 类型 | 约束与含义 |
| --- | --- | --- |
| `localId` | `string` | 当前草稿内唯一，用于删除与排序；不作为持久化 ID |
| `file` | `File` | JPEG、PNG、WebP；单张 ≤10 MiB，总计 ≤50 MiB |
| `previewUrl` | `string` | 当前页面生成的临时预览 URL；照片删除或草稿清理时释放 |
| `analysisFile` | `File \| null` | 浏览器压缩后的临时 JPEG；同一组照片的 multipart 请求须 ≤3.5 MiB；输入变化后失效并重新生成 |
| `position` | `number` | 从 0 开始的当前叙事顺序，连续且不重复 |
| `readState` | `ready \| failed` | 预览读取失败时不允许提交该文件，可移除或重选 |

重复选择同一文件允许作为独立照片，必须有不同 `localId`、独立预览与准确计数。空选择、超过数量/大小限制或不支持的格式不能进入理解请求。

分析用图片按照片顺序逐张生成，最多 1024 像素长边，并在超出请求预算时逐步降低尺寸或质量；若仍无法控制在 3.5 MiB 以内，提示用户移除/更换照片。原图不进入 `/api/memory/*` 请求，服务端只接收临时分析图。

## 记忆理解结果 `MemoryProfile`

| 字段 | 类型 | 约束与含义 |
| --- | --- | --- |
| `version` | `number` | 从 1 开始；每次成功修正递增 1，失败不递增 |
| `title` | `string` | 非空事件标题；否则结果不可确认 |
| `people` | `string[] \| null` | 明确识别的人物或关系；`null` 表示“未识别”，不得猜测姓名 |
| `event` | `string \| null` | 事件描述；与 `atmosphere` 至少有一项非空 |
| `atmosphere` | `string \| null` | 情绪氛围；与 `event` 至少有一项非空 |
| `timeline` | `TimelineItem[] \| null` | 有依据的顺序线索；`null` 表示“未识别” |
| `photoOrder` | `number[]` | 照片索引排列，必须恰好覆盖本次提交的每张照片；没有可靠顺序线索时保持上传顺序 |
| `source` | `agent \| demo` | 明确标识结果来自真实能力或演示模式 |

`TimelineItem` 由简短说明及关联照片索引组成。所有照片索引必须在当前草稿范围内。对可选字段使用 `null` 表示未识别；空字符串或空数组在进入界面前规范化为 `null`。界面固定展示标题、人物、事件、氛围、时间线五类区域，`null` 统一显示“未识别”。

**最低可确认条件**：`title` 非空，且 `event` 或 `atmosphere` 至少一项非空。否则进入不可用结果/失败状态，保留照片与故事供重试，不传给后续音乐流程。

## 用户修正 `MemoryRevision`

| 字段 | 类型 | 约束与含义 |
| --- | --- | --- |
| `instruction` | `string` | 去除首尾空白后 1–300 字；空白或无法理解时不覆盖结果 |
| `baseVersion` | `number` | 与提交时当前 `MemoryProfile.version` 一致 |
| `result` | `MemoryProfile \| null` | 成功时生成新版本；失败时为 `null` |

一次只处理一条修正请求。处理期间不能重复确认或提交新修正；收到过期响应时丢弃。修正成功保留未受影响字段；失败或超时保留 `baseVersion` 的有效结果。用户可以继续修正当前有效版本直到确认。

## 阶段状态 `CreationPhase`

```text
idle → selected → understanding → ready → revising → ready → confirmed
           ↘ invalid          ↘ failed ↗         ↘ failed ↗
```

- `idle`：无可提交照片。
- `selected`：至少 1 张可用照片，可继续添加、删除、写故事或提交。
- `understanding`：理解请求进行中，重复提交被禁用；可取消/安全返回。
- `ready`：有符合最低条件的有效 `MemoryProfile`，可修正或确认。
- `revising`：修正请求进行中，旧结果可见但不可被过期响应覆盖。
- `invalid`：输入或结果不符合规则；保留可用草稿，提示修正。
- `failed`：请求失败或超时；保留照片、故事和最近有效结果，可重试或返回。
- `confirmed`：当前版本已确认并交给结果入口；未确认草稿清除规则不再作用于该已确认交接。

## 已确认交接 `ConfirmedMemory`

| 字段 | 类型 | 约束与含义 |
| --- | --- | --- |
| `profile` | `MemoryProfile` | 确认当刻的有效版本，符合最低内容要求 |
| `photos` | `File[]` | 当前浏览器会话内的源图引用，供结果占位预览；不持久化 |

确认后，结果入口从自己的 `File` 引用创建并负责释放预览 URL；创建页可释放其原有预览 URL。刷新或直接访问 `/result` 时交接为空，页面显示明确占位。

## 关系与不变量

- 一份草稿包含 0–9 张照片、0–1 份当前有效理解结果和 0–1 条处理中修正请求。
- `photoOrder`、时间线索引始终指向当前照片数组；照片变化使旧结果失效。
- `source=demo` 的结果必须有可见演示标识，不能与真实 Agent 结果混淆。
- 照片、故事和未确认结果不写入 URL、浏览器持久存储、业务数据库或服务端日志。
- 完整 multipart 请求体不超过 3.5 MiB；服务端对超限请求返回明确错误，不尝试处理源图大文件。

# 来源与可播放资格

2026-10-08 CST；正式候选与正式域名部署 `dpl_BQLuiZNBSinqWWRsRbASYXJTVFST`。

| 分支 | 实际来源及验收 | 状态 |
| --- | --- | --- |
| 用户端记忆理解 | `source=demo`，演示适配器。SDD-06 工作台 Qwen live 并未替换用户端入口 | `pass`（标识真实） |
| AI 原创配乐 | 候选浏览器正常模式真实调用服务端 fal.ai 并得到 `source=api` 可播结果，随后播放、保存、复开；失败模式保留 failed，未静默回退 | `pass` |
| QQ 推荐 | 本地 WAV，`source=mock`；AI 失败时主动选择后可播放、保存，09 仍显示 mock | `pass` |
| 等待氛围音乐 | 不记作 AI 成品，不满足保存资格 | `pass`（契约与浏览器） |

真实 AI 模式的浏览器证据在 `.sdd00-work/sdd07-real-cloud-normal/result.json`；QQ 失败兜底在 `.sdd00-work/sdd07-real-cloud-qq-failure/result.json`。这两类不是同一次运行，来源不混记。

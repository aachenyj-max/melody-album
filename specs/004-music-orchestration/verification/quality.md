# SDD-03 质量验证

执行日期：2026-10-06。

| 检查 | 结果 |
| --- | --- |
| `npm run format` | 通过，Biome 格式化完成。 |
| `npm run lint` | 退出码 0；保留仓库既有 CSS specificity 与 Biome 配置弃用警告。 |
| `npm run tscheck` | 通过。 |
| `npm run build` | 通过；包含动态 `/api/music/generate` 路由。 |
| 真实 API | 新 `FAL_KEY` 经服务端代理调用 MiniMax Music 2.6 成功；队列约 2.9 分钟完成，浏览器加载音频并显示 28 秒试听。 |
| ACE-Step 切换 | `fal-ai/ace-step/prompt-to-audio` 真实请求返回 `source=api`、WAV 地址；代理读取文件头为 `RIFF`；无头 Edge 加载音频元数据成功，实际时长 27.96 秒。 |
| 显式 demo | 仅服务端无 `FAL_KEY` 时返回 `source=demo`；错误不静默降级。QQ 始终为明确标识的 mock。 |
| 输入校验 | 额外照片 URL、无效时长及短提示词均返回 400；不发送原图、故事原文或密钥到供应商。 |

MiniMax 行为属于切换前的历史验收。当前 ACE-Step 接收 `duration=28` 和 `instrumental=true`，浏览器确认音频至少 15 秒可播后播放。供应商生成耗时会波动，本地代理 `FAL_PROXY_URL` 仅用于当前电脑直连受阻的情况；连续调用时曾遇代理连接超时，队列 GET 已增加重试，提交失败保留明确错误供用户重试。

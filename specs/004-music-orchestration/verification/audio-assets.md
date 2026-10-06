# 音频素材验证

当前 Demo 使用本地生成的正弦波 WAV 作为流程占位，文件不代表 QQ 音乐曲库中的真实歌曲，也不使用真实艺人信息。

| 文件 | 用途 | 格式 | 时长 | 来源/许可 | 状态 |
| --- | --- | --- | --- | --- | --- |
| `public/audio/music-album/ambient.wav` | AI 等待氛围音 | WAV PCM | 8 秒循环候选 | 项目生成素材 | 待浏览器手动确认 |
| `public/audio/music-album/mock-qq.wav` | 可播放 QQ mock 推荐 | WAV PCM | 20 秒 | 项目生成素材 | 待浏览器手动确认 |
| `public/audio/music-album/demo-ai.wav` | AI 演示适配器 | WAV PCM | 20 秒 | 项目生成素材 | 待浏览器手动确认 |

真实 API 和真实 QQ 曲库接入前，不把这些素材标记为真实生成或真实 QQ 歌曲。

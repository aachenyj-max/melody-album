# 验证指南：音乐结果编排与等待兜底

本指南用于 SDD-03 实施后的手工验收。数据形状见 [data-model.md](data-model.md)，同源生成接口见 [music-generation.md](contracts/music-generation.md)，04→05 交接见 [result-playback.md](contracts/result-playback.md)。

## 前置条件

1. SDD-02 已完成“上传 → 理解/修正 → 一键确认”，并将有效 `ConfirmedMemory` 交给 `/result`；无确认交接时 `/result` 显示空状态。
2. 当前 Demo 已提供本地等待音乐、QQ mock 和演示 AI WAV 素材；来源及时长见 `verification/audio-assets.md`，仍需在目标浏览器手动确认加载。
3. 若要验收真实 AI 生成，在 `.env.local` 配置服务端 `FAL_KEY`（不要使用 `NEXT_PUBLIC_` 前缀）；实现调用 fal.ai 的 `fal-ai/ace-step/prompt-to-audio`。当前电脑直连 fal.ai 不通时，另配服务端 `FAL_PROXY_URL`。未配置 key 时仅运行显式“演示配乐”模式，不将其计入真实生成完成条件。

## 本地运行

在项目根目录执行：

```powershell
npm run dev
```

使用浏览器从 `/` 进入创建流程，上传 1–9 张照片，确认记忆后进入 `/result`。不要仅直接访问 `/result` 来测试真实编排；直达应显示空状态。

## 核心路径验收

| 场景 | 操作 | 预期 |
| --- | --- | --- |
| 正常生成 | 确认有效记忆，保持默认“为你生成” | 04 同时出现 AI 状态和至少一首“演示推荐”；AI 成功后显示可播音频和真实/演示来源；进入 05 时交接对应照片与音源 |
| 慢响应 | 在开发验收场景中延迟 AI 结果 | 04 持续显示等待或可信进度；氛围音乐可由用户启动；默认进入 05 后接续氛围音乐，AI 完成后无重叠切换 |
| 浏览器拦截自动播放 | 禁止页面自动播放并重开流程 | 页面不显示假“播放中”；用户可手动启动等待音乐 |
| 主动选 QQ mock | 点选有可播音频的推荐，再进入播放 | 05 播放选中推荐，来源仍标 mock；AI 后续完成不抢播 |
| AI 失败 | 在开发验收场景中令 AI 返回失败或超时 | 等待音乐停止，推荐与照片仍在；可重试 AI；选择可播推荐后可进入 05 并继续后续保存 |
| QQ 仅有元信息 | 令 mock 推荐无音频且 AI 失败 | 卡片仍可阅读但不能标可播；“进入播放”不能带空音源；有明确重试或返回路径 |
| QQ 空/失败 | 令 mock 推荐为空或失败而 AI 成功 | AI 成品仍可播放；推荐区域单独提示重试，不阻断 AI 路径 |
| 旧响应 | 发起生成后重试或开始新创建，再让旧请求返回 | 旧结果不覆盖当前状态，不启动第二段音频 |
| 刷新/直达 | 直接访问或刷新 `/result` | 无本次确认交接时显示空状态，提供创建入口，不使用历史 mock 冒充当前结果 |

开发验收场景只用于触发慢响应、失败和空推荐；正式用户界面不提供这些开关，也不把演示结果标成真实服务结果。实际场景注入方式在实施任务中按现有工具确定。

本地验收可在开发服务器进程中临时将 `FAL_KEY` 设为空，并设置 `FAL_DEMO_SCENARIO=slow`（延迟 45 秒）或 `error`（返回 `PROVIDER_ERROR`）；生产环境忽略该变量。QQ mock 的 `empty`、`metadata`、`failed` 场景可在浏览器同源 `sessionStorage` 中设置 `sdd03:recommendations`，随后重新开始或点“重新加载”。验收后删除该会话键并以 `.env.local` 的真实配置重启服务器。

## 04 号界面与跳转

逐项对照 `音乐相册-ui还原.html` 的 04 号 `screens`/热点与 `designs/ui/04-生成结果-为你生成与QQ音乐推荐.png`：标题、生成状态卡、两路切换、主照片、AI 配乐卡、推荐卡、底部“进入播放”的布局、层级、配色、字体、图片位置和文案均须核对。分别在至少 3 个常见移动宽度下检查无明显横向溢出；确认 03→04→05 跳转及 05 返回 04。动态数据与演示来源标识可以替换图片中的示例信息，不重排结构。

## 静态与构建检查

完成实现后在项目根目录执行：

```powershell
npm run format
npm run lint
npm run tscheck
npm run build
```

记录命令结果、正常/慢响应/失败场景、音源切换、04 号视觉核对及已知限制到本阶段验收摘要。阶段完成时按 `progress.md` 更新总项、验收结果与下一阶段；在真实 AI API 未接入前，不勾选真实生成接入的完成条件。用户指定的 QQ mock 决策也需同步到进度记录，不能沿用旧的“真实 QQ 检索已接入”口径。

## 当前实现交接记录（2026-10-05）

- SDD-02 的 `CreationSessionProvider` 提供当前导航会话的 `ConfirmedMemory`（确认后的 `MemoryProfile` 与 `File[]`）；`/result` 无确认交接时保持空状态，不从历史 demo 数据补齐。
- SDD-03 的 `MusicSessionProvider` 已挂在 `app/(album)/layout.tsx`，结果页和播放页共享同一个音乐运行与唯一音频控制者。
- 已将 fal.ai 适配器切换为 ACE-Step Prompt to Audio；配置 `FAL_KEY` 时调用真实服务，未配置时才使用显式 `demo` 适配器。QQ 推荐始终使用显式 `mock` 数据。真实服务是否通过验收，以 `verification/` 中的实测记录为准。
- 演示 WAV 素材位于 `public/audio/music-album/`，其来源和时长记录在 `verification/audio-assets.md`。

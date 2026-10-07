# Qwen3-VL-Flash 接入

2026-10-07，按用户指定登记服务端受控 provider=alibaba、model=qwen3-vl-flash、api=openai-completions，固定[北京工作空间 endpoint](https://llm-a5ntatubdh5b5n88.cn-beijing.maas.aliyuncs.com/compatible-mode/v1)。浏览器不能指定任意模型或 URL。

实际 Pi 1.0.3 Agent/Models/provider 的隔离 SSE 验收通过：两个 JPEG ImageContent，唯一 record_memory_profile 工具，max_tokens=2048，enable_thinking=false，不发送不适配的 developer/store/reasoning_effort/strict；工具与事件 awaited 持久化。snapshot 型号、错误协议、未登记域名、缺 key 被拒绝。该隔离项目不调用供应商；随后用户配置 key，实际 Alibaba/HTTPS 验收也已通过，见 [live](live.md) 与 [live-evidence.json](live-evidence.json)。

协议/能力参考阿里云[模型说明](https://help.aliyun.com/zh/model-studio/qwen3-vl-flash)和[视觉调用指南](https://help.aliyun.com/zh/model-studio/vision)。使用用户指定北京 alias，不将其他地域及 snapshot 能力直接套用。

用户已在忽略的 `.env.local` 配置 key 并开启 live；Preview 已保存 Secret、重新部署且验证成功。后续更换本地 key 时填写：

~~~dotenv
PI_LLM_API_KEY=你的阿里云APIKey
~~~

然后执行并重启本地服务：

~~~powershell
powershell -NoProfile -File scripts/setup-workbench-qwen.ps1 -Live
npm.cmd run dev
~~~

脚本先验证非空 key，再设置 live；保留 key 且不打印，缺 key 时不修改配置。只增加 key 不会自动调用模型。

预览部署另外将 PI_LLM_API_KEY 保存为该项目 **Preview Secret** 环境变量，并改 PI_EXECUTION_MODE=live，重新部署才生效。本地文件不会自动同步到 Vercel。Q10 的真实图片、工具事件、source=agent、有效 Profile 与真实错误 key 不降级均已验证；使用已有 FAL_KEY 的工作台 live 配乐也已生成且播放成功，QQ 继续 mock。本地配乐仍按独立 WORKBENCH_MUSIC_MODE 设置；未配置时为 demo，预览目前为 live。

真实两图调用发现 people/timeline 被供应商编码成 JSON 字符串。record_memory_profile 工具 v2 使用 Pi 官方 prepareArguments，仅对这两个字段解码 JSON 数组/null，再经过原 schema 和 normalizeProfile 语义校验；不补造数据或跳过校验。超限、错误 JSON/类型、未知字段、非法索引和重复顺序均拒绝。原工具 v1 保留原行为，未知版本拒绝；历史结果没有改写。

# demo / live 状态

2026-10-07：默认 PI_EXECUTION_MODE=demo、WORKBENCH_MUSIC_MODE=demo。已有 FAL_KEY 不会让工作台自动收费。真实 Pi Agent loop 经独立 faux provider 调用 record_memory_profile，source=demo；规则使用故事/照片数量与顺序，未宣称真实分析图片。配乐为已实际加载的本地 WAV，QQ 为明确 mock。

接入前已验证：生产显式 live 且空 key 时配置预览为 503 CONFIG_UNAVAILABLE，不回退；历史 demo 可读并可 original 重跑。非视觉模型、未知版本、协议不匹配、带凭证/查询 URL 均被拒绝。用户现已配置 key，实际 Qwen 视觉理解和工作台 ACE-Step live 均已通过，见下方补验与 live-evidence.json。

当前受控供应商为 Pi OpenAI/Anthropic factory 和用户指定的 Alibaba Qwen3-VL-Flash 适配器。固定北京 endpoint 与 openai-completions 兼容字段，实际 Pi Agent 的隔离 SSE 传输验证通过，没有阿里云请求或真实 key。后续凭证必须与配置匹配，浏览器不能指定任意 provider/URL；见 [Qwen 接入与 key 配置](qwen.md)。

工作台 ACE-Step live 已用本次 Qwen 输入完成生成，独立浏览器实际加载/播放约 27.96 秒 WAV；没有借用 SDD-03 历史音源。mode/父 AbortSignal 边界不改变用户端 auto/300 秒语义。历史 DTO 仍保留 unverified 的供应商地址状态，播放器失败时显示提示；这次实际播放是独立验收证据，不回写历史。

Q10 补验：两张不同 JPEG（毕业/猫咪），中性故事未提示图像内容。真实 Qwen 正确形成两幅画面的 event/timeline/order，source=agent、driver=pi，record_memory_profile v2 与实际 tool_execution_start/end 事件 awaited 保存于远端数据库。运行 `f1b66992-f805-4518-8629-20ff83e93ec9` 和 original 重跑 `804766b6-cf5c-4c28-bf4b-bdb6e7ccd485` 六阶段均 succeeded；memory=agent、music_profile=deterministic、ai_music=api、QQ=mock。重跑后原详情完整 JSON 不变，旧 demo 历史仍可读。

失败样本 `a9d9190a-de35-438f-8058-a625eb3723ba` 如实保留：工具 v1 对供应商的字符串化 timeline 连续 schema 拒绝，memory 失败、音乐依赖全 skipped、没有 demo 回退。修复使用 Pi 官方 prepareArguments，工具 v2 仅解码 people/timeline 的 JSON 数组/null，再经相同 schema/语义校验；v1 保留原执行行为。9 个实际 Pi 隔离传输边界项目与未知版本拒绝通过，没有解析任意字段、补造输入或放宽索引约束。

独立无效 key 向真实供应商请求返回 PROVIDER_UNAVAILABLE；合法 profile 持久化 0、工具执行 0、demo fallback=false。无效 key 只在隔离进程使用，没有改部署中的有效 Secret。最新预览已开启 PI_EXECUTION_MODE=live、WORKBENCH_MUSIC_MODE=live，QQ 不冒充真实检索。

浏览器直开详情初次出现跨时区 hydration 错误；统一时间显示/筛选为北京时间后，以 America/Los_Angeles 浏览器时区复验，详情/对比、320/375/430 px、真实音频播放与北京时间查询均通过，运行时错误 0。format/lint/tscheck、本地及云端构建通过，实际浏览器 HTML/JS 不含所检查私钥。

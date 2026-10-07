# US1：可追踪的内部测试

2026-10-07，Node 22.23.1 / Next.js 16.3.8 / Pi 1.0.3；真实 Supabase 表与私有 Storage，LLM 和配乐显式 demo，QQ mock。没有收费供应商调用。

`verify-workbench.cjs` 九组检查通过：未认证、严格登录字段/Origin、8 小时 cookie、真实创建与重复 requestId/409、六阶段 Pi loop/工具开始结束事件、私有照片哈希、独立重跑与旧结果一致、六组对比/未知 ID 整体 404、机器维护独立鉴权。

统计脚本实际创建 20 条记录，10 次为一张 JPEG、10 次为九张 JPEG，20/20 在 10 秒内返回 ID、配置和六阶段状态；最小 1744 ms、最大 5042 ms。照片按最多三张并行上传；每批全部 settle 后才处理失败，资产清单先于对象上传持久化。上述是本机网络样本，不推定线上延迟。

其中 10 条一张照片的运行全部 succeeded，六阶段完整可读，memory 的 driver=pi/source=demo，music_profile=deterministic，ai_music=demo，QQ=mock。示例运行 `07ebf9a5-13c1-4612-8fe5-ee97138806fa`。浏览器生产构建验证提交后自动执行，无人工确认；本地 WAV 实际加载音频元数据成功。

隔离故障脚本使用实际 Pi Agent/官方 faux provider 和实际 runner；DAL/音乐分支替换为受控夹具，因此它不是远端故障注入。有效、无效理解、供应商异常、AI 失败、QQ 失败、双路失败、持久化失败、父取消、理解超时九种情况通过。无效理解最多三次模型调用；每次 maxTokens=2048。无效理解/供应商错误/持久化失败/超时/取消的后续音乐调用数均为 0；单路失败为 partial，保留另一分支；双路失败为 failed。实际理解 timeout 测量 45005 ms。错误摘要不包含夹具供应商原文。

生产真实并发验证：两条不同故事独立 Pi 运行成功，第三条 execute 返回 429 CONCURRENCY_LIMIT，保留 queued；手动重试成功。终态 execute 幂等读取，不重新调用工具。

服务端拒绝未知执行字段；列表无效 limit/status/cursor/重复参数均为 400。JSON 实际流预算 16 KiB 的超量请求返回 413。客户端复用已有源图/JPEG 压缩边界。空照片、十张照片、非 JPEG MIME、无效 JPEG 头、1001 字故事、额外 provider 字段均返回 400，实际 multipart 超过 3.5 MiB 返回 413。九张 JPEG、空故事的实际运行 succeeded，photoOrder 完整为 0–8，六阶段可读；完整数据见 evidence.json。

最终实际 runner 的 210 秒总截止测试通过：慢音乐收到父取消，run=interrupted/error=RUN_TIMEOUT，已完成 memory 和 QQ 保留。使用实际 Pi loop、隔离 DAL/音乐夹具，没有替换 210 秒常量；精确耗时见 evidence.json。此证据不证明线上宿主能维持 240 秒 HTTP 请求。

真实 LLM 理解未执行，不能把 faux provider 的结果称为照片真实语义分析。部署请求时限尚未验收。

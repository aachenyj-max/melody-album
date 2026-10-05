# 研究记录：Agent 创建与记忆理解

## 决策 1：创建流程的客户端边界

**Decision**: 保留 `/create` 的服务端页面与现有 App Shell，在创建区域放置局部客户端组件。照片 `File`、预览对象 URL、故事文本和未确认结果只保存在当前页面内存；对预览 URL 在移除、重选、离开时释放。

**Rationale**: 已安装的 Next.js 16.3.8 指南将浏览器 API、事件与状态放在 Client Component；`File` 不能作为服务端到客户端的可序列化属性传递。规格又要求刷新或离开后不恢复草稿。

**Alternatives considered**: 把整个 App Shell 变为客户端组件会扩大脚本边界；在浏览器存储中恢复草稿与已确认规则相反；通过 URL 传照片或结果不可行且不安全。

**Source**: `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`。

## 决策 2：路由状态与确认交接

**Decision**: `/create?state=understanding` 仅用于与原型 03 对应的可见状态。无有效草稿时，即使 URL 带该参数也显示上传初始状态。确认前离开创建页或刷新均清空；确认后通过 `(album)` 布局中的轻量内存上下文把结果交给 `/result`，不把结果序列化到 URL 或持久化。直接访问 `/result` 显示演示占位。

**Rationale**: 现有设计映射依赖这两个地址；Next.js 的客户端导航与可选 UI 状态保留行为不能替代显式清理。结果页需要接到已确认内容，但 SDD-05 前无持久化。

**Alternatives considered**: 把结果放到查询参数会泄露个人记忆且丢失照片；模块级全局变量难以保证隔离；浏览器存储会让确认前草稿跨刷新恢复。

**Source**: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-router.md`、`node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md`。

## 决策 3：照片与文本输入边界

**Decision**: 接受 1–9 张 JPEG、PNG、WebP 源图；单张不超过 10 MiB、总计不超过 50 MiB。浏览器按顺序生成分析用 JPEG，逐步降低尺寸/质量直到整个 multipart 请求不超过 3.5 MiB；原图仅用于当前页面预览和确认后的当前会话结果。故事上限 1000 字，修正指令上限 300 字。每次新增照片可与已选照片合并，重复选择计为独立项并准确显示数量；不支持格式、读取失败或压缩后仍超限时阻止继续并说明原因。浏览器验证源图，服务端验证收到的分析图及请求大小。

**Rationale**: 此范围覆盖常见网页图片，并使 1–9 张的上界可验收。Vercel 官方文档目前规定 Function 请求/响应体最大 4.5 MB，直传 9 张源图会返回 413；3.5 MiB 为表单字段和编码开销留出余量。顺序处理减少移动端同时解码的内存压力。重复照片在产品规格中允许，只要不会静默错计。HEIC 等未列格式给出明确不支持提示。

**Alternatives considered**: 直传源图会超过目标托管限制；临时上传到对象存储会提前引入 SDD-05 的持久化与清理问题；只验证文件扩展名或只在浏览器验证容易被绕过；静默裁剪超过 9 张会让用户误以为全部照片被处理。

**Source**: [Vercel Functions Limits](https://vercel.com/docs/functions/limitations)、[FUNCTION_PAYLOAD_TOO_LARGE](https://vercel.com/docs/errors/function_payload_too_large)。

## 决策 4：Memory Profile 与部分结果

**Decision**: 统一结果包含版本、事件标题、人物、事件、氛围、时间线、照片顺序和来源标记。人物或时间线等未知项显示“未识别”；只有事件标题存在，且事件或氛围至少有一项时才允许确认。修正成功生成新版本；失败保留前一有效版本。

**Rationale**: 这同时满足用户对部分结果可确认的澄清和下一阶段需要有意义的音乐输入；无内容结果不能伪装成成功。

**Alternatives considered**: 强制五项全部识别会阻断单张照片主流程；允许全部空白结果确认会使下一阶段无法获得可用记忆；在 UI 中臆造人物/时间与真实性目标相反。

## 决策 5：真实 Agent 与演示回退

**Decision**: 先定义理解、修正、结果和错误的统一契约。真实 Agent 地址/凭证缺失时，使用固定且标明 `demo` 的结果；真实能力已配置但请求失败时返回可重试错误，不静默改用演示结果。真实外部调用只发生在服务端，照片不持久化，也不记录原始照片或故事正文。

**Rationale**: 分阶段规划 §4 Q1 已确认同契约回退；产品方案要求最终 Demo 主链路接真实能力。显式来源可避免把本地演示误认作真实理解，且符合项目的服务端密钥边界。

**Alternatives considered**: 等凭证齐全再做页面会阻断 SDD-02；浏览器直连真实 Agent 会暴露密钥；真实调用失败后自动返回假结果会掩盖故障。

## 决策 6：请求、错误与状态

**Decision**: 使用同源 POST Route Handler 接收受控大小的 `FormData`。理解与修正都验证输入并返回统一成功/失败包；修正需要当前 Memory Profile、修正指令和同一组分析用图片，以支持重新理解照片事实。客户端用请求标识或取消机制忽略过期响应，区分图片准备、理解、修正、成功和失败；超时后保留已选照片和上一有效结果。

**Rationale**: 已安装 Next.js 指南支持 Route Handler 的 POST 与 `request.formData()`，POST 不缓存。用户可以在失败后重试或调整输入；旧响应不应覆盖最新修正。

**Alternatives considered**: 仅传当前文本结果无法可靠修正照片事实；不区分请求版本会出现重复点击时的状态倒退；用 GET 传照片不合适。

**Source**: `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`、`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`。

## 未解决的外部条件

真实 Pi Agent 的具体入口、鉴权格式、照片支持范围、供应商字段和错误码尚未提供。本阶段的内部契约不依赖这些值；实际调用适配必须在取得资料后映射并验证。它不影响当前演示模式和 UI 主流程的规划完成。

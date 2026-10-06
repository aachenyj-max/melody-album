# 工作台 HTTP 与界面契约

**契约版本**：1。人类 API 前缀 /api/internal/agent-workbench；数据模型见 [data-model.md](../data-model.md)，执行规则见 [pi-runtime.md](pi-runtime.md)。

## 1. 页面、认证与公共约定

| 路径 | 页面行为 |
| --- | --- |
| /internal/agent-workbench | 内部口令入口、配置预览、输入、运行列表 |
| /internal/agent-workbench/runs/{id} | 当前运行六阶段、历史配置、重跑 |
| /internal/agent-workbench/compare?a={id}&b={id} | 两条运行的只读对比 |

不进入 app/(album) 布局和用户端导航。布局鉴权不能代替每页/API/DAL 鉴权。工作台路径仅旁路用户端 Supabase 会话刷新；自身会话仍强制校验。全部读写默认 Node runtime、动态执行、不共享缓存，响应 Cache-Control: private, no-store。

未配置口令/session secret/可信 origin 时，人类页/API 返回关闭状态（404，不含测试内容）。配置正常但未验证：根页可显示内部口令表单，详情页回口令入口；人类 API 返回 401。未知、已删除、过期 run 均 404，不能区分并泄露记录。合法口令成员共享测试集合，不建立个人账号。

口令验证产生固定 8 小时签名会话，HttpOnly、SameSite=Strict、Path=/，部署 HTTPS 为 Secure。签名绑定当前口令版本；轮换后旧 cookie 无效。口令用定长摘要比较，错误回复不回显输入。浏览器 POST/DELETE 必须匹配预配置 WORKBENCH_PUBLIC_ORIGIN，缺失/异源返回 403；不以 Host 请求头自动信任 origin。

JSON 请求 Content-Type=application/json，最大 16 KiB；拒绝未知影响执行的字段。UUID、日期、状态、游标和 query 参数都须校验。multipart 总量最大 3.5 MiB，服务端实际计量，不只相信 Content-Length。没有客户端可选任意 provider、URL、表、Storage 路径或密钥。

成功 JSON envelope：

~~~json
{
  "contractVersion": 1,
  "data": {}
}
~~~

错误 envelope：

~~~json
{
  "contractVersion": 1,
  "error": {
    "code": "CONFIG_UNAVAILABLE",
    "message": "所选配置当前不可执行。",
    "retryable": false,
    "stage": null
  }
}
~~~

有 runId 只在已鉴权且本次已创建记录时返回。无权访问的错误不含任何照片、故事、音频 URL、配置内容或其他运行标识。

## 2. 会话与配置

### POST /session

JSON {password:string}。可信 Origin 检查后验证口令；成功 204 并 Set-Cookie。错误口令 401，关闭状态 404。不查询运行或调用工具，不打印口令。超过合理长度的输入直接 400。

### DELETE /session

验证可信 Origin，清除内部 cookie，204。退出不修改任何运行。

### GET /config

已鉴权返回当前可执行的脱敏 ConfigSnapshot、configDigest 和能力状态。可选 originalRunId：验证原记录未到期后，额外返回其历史配置及 originalExecutable / 不可执行原因，供重跑前展示；不会替换当前配置。

配置必须具备 prompt/loop/skill/tool 版本和内容哈希。不完整则 503 CONFIG_UNAVAILABLE，不能展示假版本并继续。demo 的缺 LLM/FAL key 不使配置失效；live 的缺 key、非视觉模型、协议或版本不受支持则不可执行。不回传敏感变量值。

## 3. 创建、列表与详情

### POST /runs

multipart fields：
- contractVersion：字符串 1。
- requestId：客户端为本次提交生成的 UUID，网络重试复用。
- story：可空字符串；trim 后 <=1000 字。
- photos：重复文件字段，有序 1–9 个 JPEG 实际模型输入。

客户端复用 validateSources / prepareAnalysisFiles：源文件 JPEG/PNG/WebP、每张 <=10 MiB、合计 <=50 MiB，压缩后提交 JPEG。服务端复核数量、实际请求尺寸、JPEG 文件头、故事和顺序。文件非法 400/413/422，保持界面本地输入以便修正；不发起工具调用。

鉴权后解析当前配置，冻结输入/配置和创建时间，预留 assets 再上传私有对象，全部 ready 后置 queued。201 返回：

~~~json
{
  "contractVersion": 1,
  "data": {
    "runId": "UUID",
    "kind": "internal_test",
    "status": "queued",
    "createdAt": "ISO-8601",
    "expiresAt": "ISO-8601",
    "configDigest": "SHA-256",
    "configSnapshot": {},
    "inputSummary": { "photoCount": 2, "hasStory": true }
  }
}
~~~

相同 requestId、相同输入/配置返回已有记录（200）；不同哈希 409 REQUEST_CONFLICT。并发重复不会再上传或创建第二条。已有上传尚未完成则返回其 uploading 状态，由界面查看进度，不调用 execute；十分钟未完成可回收为 interrupted。发生持久化/上传失败，若已有 run 则保存输入失败与可读取 runId，响应 503 DATA_UNAVAILABLE；完整输入不存在时重跑返回 INPUT_UNAVAILABLE。

界面取得 queued 后立即单独 POST execute，自动观察阶段，不新增人工确认按钮。95% 有效提交应在 10 秒内显示 ID、版本和状态；不能把所有模型等待放进创建请求。

### GET /runs

query：status 可选合法运行状态、runId 可选精确 UUID、from/to 可选 ISO 时间区间、limit 默认 25/最大 50、cursor 可选服务端生成的创建时间+ID 游标。列表按 createdAt DESC,id DESC，过滤过期记录。返回 items 与 nextCursor；item 含 ID/parentRunId、kind、状态、时间、输入摘要、配置版本与来源摘要，不含照片字节或故事原文。

无记录返回空列表；非法过滤/游标 400，数据库不可用 503。时间/状态/ID 查询不修改记录。

### GET /runs/{id}

返回 RunDetail：
- runId、parentRunId、kind、status、createdAt/expiresAt、startedAt/endedAt；
- inputSnapshot（故事、顺序、数量）、照片同源 previewUrl；
- 完整脱敏 configSnapshot/configDigest；
- steps 六阶段，含 status/driver/source、result、calls、白名单 events、开始/结束、错误；
- summary 与脱敏 error。

缺失字段显示未提供；pending/skipped/interrupted 不能呈现成功数据。已授权详情允许看必要的内部测试故事和 Profile，不返回 Storage 路径、execution_token、lease 内部凭证、base64、完整 transcript 或供应商鉴权头。历史详情始终显示原快照。

## 4. 执行与重跑

### POST /runs/{id}/execute

JSON {contractVersion:1}。原子 claim queued 且未过期、全部输入 ready 的 run；全局执行数上限 2。请求同步 await 本次执行，不以 202/后台 Promise 脱离生命周期。执行路由 maxDuration=240，应用总预算 210 秒，理解阶段 45 秒；部署宿主必须真正支持预算。

claim 成功后立即写 running，各阶段分别提交。浏览器保持执行 fetch，同时每 1 秒 GET 详情，终态停止轮询；轮询失败可重试读取，不自动重复执行。响应 200 返回最终 RunDetail，运行失败也用 status/error 精确表达。接口执行结果不是业务成功证明。

已 running 返回 409 RUN_BUSY；输入未 ready 返回 409 RUN_NOT_READY；并发满返回 429 CONCURRENCY_LIMIT，可稍后对仍 queued 的记录重试；已终态返回已有快照（200，不触发工具）。过期/未知 404。阶段结果写入要求 execution_token、状态、租约与 expires_at 均有效；晚到响应不能修改终态。

内部请求 signal 断开时尽力 abort 并保存 interrupted；进程被杀时租约过期由维护回收。不会重建旧执行或自动重试收费请求。恢复入口是手动重跑；旧结果只读。

### POST /runs/{id}/rerun

JSON {contractVersion:1,requestId:"UUID",configSelection:"current"|"original"}，默认 current。原 run 必须未到期且有完整 ready 输入，可来自成功、失败或未完成记录。

current 解析提交时当前配置；original 用旧快照并验证受控版本/能力仍可执行。前端在提交前展示所选版本，服务端不能静默替换。原版本不支持返回 409 CONFIG_UNAVAILABLE，输入不可读取返回 422 INPUT_UNAVAILABLE；旧记录到期返回 404。

新建 run 与输入独立路径，逐张复制/验证 SHA-256，故事和顺序不变，parentRunId 指向原 ID。新 createdAt/expiresAt 按自身创建+30天，原记录不续期、不修改。复制过程中原输入已到期则阻止执行并记录新输入失败，不借复制读取过期内容。201/幂等 200 返回新记录，queued 后界面自动 POST execute。重复 requestId 的规则同创建，不重收费。

## 5. 照片与对比

### GET /runs/{id}/photos/{index}

验证口令会话、run 未过期、index 0–8 且资产 ready 后，由服务端 Storage download 返回 image/jpeg，同源、private no-store。未知/到期/不可读对象 404；无身份 401。不返回直接 Storage 签名 URL；不将内部照片放 next/image 共享优化缓存。到期即不可再次获取，已被访问者下载的内容无法撤回。

### GET /compare?a={id}&b={id}

必须验证两条未到期记录；任一缺失/到期则整次 404，不返回另一条内容。相同 ID 400。返回 left/right 的脱敏快照与六组 differences：
input、config、memory、musicProfile、tools、summary。

DiffEntry={path,left,right,state}，state=equal/changed/missing_left/missing_right/pending。比较故事、照片哈希/顺序、配置内容/版本、Profile、工具名/状态/来源和最终状态；忽略运行 ID、时间戳、供应商 request ID、临时音频 URL 字符串等波动字段，但展示其实际可用性。字段缺失、未完成与空值分别表达。比较只读，不回写原记录。

界面按同样六组组织；照片、输入、prompt 等长内容按需展开，状态/来源/错误不依赖仅颜色。320/375/430 px、字体放大和键盘可操作，局部对比区允许滚动，整页不横向溢出。提供返回、详情和手动重跑入口；内部样式不冒充用户端 01–09。

## 6. 机器维护接口

### POST /maintenance

只接受 Authorization: Bearer WORKBENCH_MAINTENANCE_TOKEN；人类 cookie 不能代替机器 token。此接口即使人类口令未配置仍允许合法维护，以兑现保留期；它只处理内部工作台对象，不登录、不返回内容、不调用 Agent/音乐。非配置/错误机器 token 返回 404/401。

JSON {contractVersion:1}；数据库选择最多 50 条到期记录，应用预算 20 秒。先回收租约过期的 running 与十分钟无 execute/上传未完成的记录为 interrupted，保留已有步骤；再删除过期 run 的 Storage 对象，成功后删除关系数据。失败保留清单下轮重试。返回 200、仅 recoveredRuns/deletedRuns/deletedObjects/failedRuns/hasMore 等计数；并发维护应使用短事务领取/锁和幂等 Storage 删除，不能先删路径。

部署每小时 pg_cron+pg_net 调用可达 HTTPS URL，Vault 保存 URL/机器 token，timeout_milliseconds=30000；本地定时器调用 localhost 同一接口。Bearer 机器请求不要求浏览器 Origin，不接受任意待删 ID/路径参数。调度安装及执行证据属于后续实施验收。

## 7. 错误与状态映射

| code | HTTP / 记录状态 | 行为 |
| --- | --- | --- |
| INVALID_INPUT / INVALID_STORY | 400 | 修正输入，不运行 |
| REQUEST_TOO_LARGE | 413 | 降低/更换照片 |
| INPUT_UNAVAILABLE | 422 | 无完整输入，重新提交 |
| REQUEST_CONFLICT / RUN_BUSY / RUN_NOT_READY | 409 | 不覆盖记录 |
| CONFIG_UNAVAILABLE | config/创建 503；原版本重跑 409 | 阻止不支持配置 |
| CONCURRENCY_LIMIT | 429 | 保留 queued，稍后重试 execute |
| DATA_UNAVAILABLE | 503 | 提示暂不可读/保存，保留已提交结果 |
| MEMORY_TIMEOUT / INVALID_MEMORY_RESULT / PROVIDER_UNAVAILABLE | execute 200，run failed | 保存理解错误，依赖音乐 skipped |
| MUSIC_UNAVAILABLE | execute 200，partial 或 failed | 保留独立分支结果 |
| RUN_TIMEOUT / RUN_INTERRUPTED | execute 有响应则 200，failed/interrupted | 保留完成步骤，允许新记录重跑 |

401/403/404 采用通用脱敏错误。retryable 代表可稍后新建/手动重跑，不能据此自动再次执行旧终态。外部音频只保留元信息或 URL 已失效时显示不可播放，不伪造有效音源。

## 8. 规格追踪

| 要求 | 契约落点 | 验收 |
| --- | --- | --- |
| FR-001 / FR-012 / FR-015 | 独立页面、用户 proxy 旁路、无用户导航 | quickstart Q2/Q9 |
| FR-002 / FR-003 | 输入预算、创建快照、ID/时间 | Q3 |
| FR-004 / FR-005 / FR-006 / FR-007 | 六阶段 DTO、Profile、工具摘要/来源 | Q3/Q6 |
| FR-008 / FR-014 | current/original、新 ID、只读边界 | Q4 |
| FR-009 / FR-010 | 分组对比、时间/状态/ID 与游标 | Q5 |
| FR-011 | 中断、局部结果、恢复不重收费 | Q6/Q7 |
| FR-013 | 所有页面/API/DAL、照片、Origin | Q2 |
| FR-016 | 独立输入副本、到期检查、机器维护 | Q7/Q8 |
| FR-017 / FR-018 | 自动继续、独立分支、内部测试/来源 | Q3/Q6/Q10 |

成功指标 SC-001–SC-011 的测量方法与样本数见 [quickstart.md](../quickstart.md)，不能以页可访问代替业务验收。

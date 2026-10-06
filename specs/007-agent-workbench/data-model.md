# 数据模型：内部 Agent 工作台

## 存储与访问边界

新增三张 public.agent_workbench_* 表，全部启用 RLS，显式撤销 PUBLIC、anon、authenticated 的表/相关 RPC 权限，只向 service_role 授予实际需要的 CRUD/EXECUTE。不存在“已匿名登录即内部人员”的策略。使用 server-only admin client，先由工作台验证口令会话，再访问固定对象；不接受客户端自选表、bucket、对象路径或任意查询。

测试输入放私有 agent-workbench-test-inputs bucket，每条 run 独立路径 runs/{runId}/photos/{index}.jpg。保存的是实际发送模型的压缩 JPEG 快照，不额外保存原始大图。测试模型与工具输出保存结构化快照，不保存凭证、base64 图片、完整供应商响应或模型思考过程。

## 1. Agent 运行记录：agent_workbench_runs

| 字段 | 类型/约束 | 用途 |
| --- | --- | --- |
| id | uuid 主键，服务端生成 | 唯一运行标识 |
| request_id | uuid，唯一且不可变 | 同一次创建的重复提交返回同记录 |
| parent_run_id | uuid，可空，不建外键 | 保留重跑来源 ID；原记录到期删除不改新记录 |
| kind | text，固定 internal_test | 区分用户端业务 |
| status | text + CHECK | uploading / queued / running / succeeded / partial / failed / interrupted |
| created_at / expires_at | timestamptz，不可变 | expires_at=created_at+30 days |
| started_at / ended_at | timestamptz，可空 | 执行时间，不改变保留期 |
| input_snapshot | jsonb，不可变 | trim 后故事、照片数量/顺序/输入校验版本、各输入摘要 |
| input_digest | text，SHA-256 | 标准化故事与照片字节/顺序的合成哈希，判断输入是否相同 |
| config_snapshot / config_digest | jsonb / text，不可变 | 下述完整配置和内容哈希 |
| execution_token | uuid，可空，只服务端可读 | 防止旧执行者写入新的状态 |
| lease_expires_at | timestamptz，可空 | 固定执行预算对应的租约 |
| error | jsonb，可空，脱敏 | code / stage / retryable / message |
| summary | jsonb，可空 | 六阶段汇总、各分支来源、可用/失败/未完成状态 |

request_id 重复且 input/config 哈希相同：返回已有 ID；哈希不同：409 REQUEST_CONFLICT，不覆盖记录。request_id 不是访问凭证，仍须内部鉴权。创建后快照不可修改，运行中只推进状态、租约、步骤和汇总；终态内容不可更新，维护可按到期规则删除。

不设置 user_id 为“共享演示用户”，不建立与用户相册的外键，不自动采集用户端运行。共享口令成员可看到内部测试集合，不承诺个人成员隔离。

## 2. 阶段记录：agent_workbench_steps

| 字段 | 类型/约束 | 用途 |
| --- | --- | --- |
| run_id / stage | uuid FK / text | stage 仅六种；联合主键 |
| status | text + CHECK | pending / running / succeeded / failed / skipped / interrupted |
| driver | text + CHECK | pi / pipeline |
| source | text + CHECK | agent / demo / api / mock / deterministic / none |
| started_at / ended_at | timestamptz，可空 | 时序与耗时 |
| result | jsonb，可空 | 经现有契约校验的 Profile 或工具结果 |
| calls | jsonb 数组，受限 | 工具调用名称/版本/调用 ID/脱敏参数与返回摘要/状态/耗时 |
| events | jsonb 数组，最多 256 项 | 白名单 turn/tool/阶段事件；超限注明摘要截断 |
| error | jsonb，可空 | 统一错误码和脱敏说明 |

六阶段为 input、memory、music_profile、ai_music、qq_recommendations、summary。输入与 summary driver=pipeline；理解 driver=pi，MemoryProfile.source 仍为 agent 或 demo；转换 source=deterministic；AI source=api/demo；QQ source=mock。不改动上游字段枚举来混同来源。

单阶段结束后结果冻结。模型事件白名单仅包括阶段/turn/tool 开始与结束、状态与耗时；每阶段最多 256 条事件，超过时保留结束状态并标明摘要被截断。不逐 token 写库，不保存 thinking/text delta、请求 Authorization、完整模型上下文。

## 3. 测试照片清单：agent_workbench_assets

| 字段 | 类型/约束 | 用途 |
| --- | --- | --- |
| id | uuid 主键 | 内部资产记录 |
| run_id | uuid FK | 与 run 一起清理 |
| position | smallint，0–8；每 run 唯一 | 原输入顺序 |
| storage_path | text，唯一；服务端构造 | 独立运行对象位置 |
| mime_type / byte_size | image/jpeg / bigint >0 | 对压缩字节再校验 |
| sha256 | text | 重跑复制后验证字节一致 |
| state | text + CHECK | reserved / ready / failed / delete_pending |
| created_at | timestamptz | 保留创建与清理证据 |

先写 reserved 清单再上传，成功置 ready；上传失败保留清单并标 run input 失败，便于维护重试清除孤立文件。未完成上传的运行不可执行。新重跑复制原 ready 文件到自己的新路径，逐张验证哈希，不能续期旧运行。

相册文件与工作台文件不得共享对象路径。已有公开演示音乐不归工作台所有；真实供应商音频地址按其原有效期保留元信息，地址失效显示不可用，不保证外部音频地址可用 30 天、不拷贝供应商音频到测试 bucket。

## 4. ConfigSnapshot

~~~text
schemaVersion: 1
engine: { name: "pi", packages: { agentCore: "1.0.3", ai: "1.0.3" } }
prompt: { version, text, sha256 }
loop: { version, maxTurns: 3, maxOutputTokens: 2048, memoryTimeoutMs: 45000 }
skills: [{ name: "memory-understanding", version, text, sha256 }]
tools: [{ name, version, driver, contractVersion }]
memoryModel: { mode: "demo" | "live", provider, api, modelDescriptor }
music: { mode: "demo" | "live", adapterVersion, modelId }
recommendation: { mode: "mock", datasetVersion }
contractVersions: { memory: 1, music: 1 }
runTimeoutMs: 210000
~~~

模型 descriptor 只存非敏感 ID、输入能力、context window、输出 token 限制等必要字段。base URL 不含用户密码或 query token；认证 headers、LLM/FAL/Supabase key、内部口令及会话/维护 token 均不得进入快照或 digest。

配置来自受控版本注册。当前配置由既有代码发布更新；原版本重跑读取当时快照并验证 SDK/工具/契约版本仍受支持。禁止根据 JSON 导入代码、eval 或执行未部署的旧函数；不可执行返回 CONFIG_UNAVAILABLE。

## 5. 关系、索引和校验

- run 1:N steps、run 1:N assets。删除前先通过 Storage API 清除文件，再删除关系记录；可用外键 cascade 删除 steps，但不能先丢失待删除文件路径。
- parent_run_id 仅历史引用：原 run 过期不影响子 run，也不能凭该引用读取过期内容。
- 索引：runs(created_at DESC,id DESC)、runs(status,created_at DESC,id DESC)、runs(expires_at)、assets(run_id,position)、assets(state,created_at)。steps 联合主键覆盖按 run 读取。
- 正常输入数量 1–9；源照片限制和 JPEG 压缩复用既有契约；服务端验证 multipart 总量、JPEG 文件头、故事 1000 字上限、照片哈希及顺序。
- 结构化结果经过 normalizeProfile / validateMusicProfile；标题、事件或氛围、照片序号、枚举和音源有效性沿用上游规则，不相信模型或客户端声明的 source。
- 表/RPC 授权只作用于本特性对象，不执行 schema-wide grants/revokes，不改变用户端表策略。

## 6. 生命周期与并发写入

~~~text
uploading -> queued -> running -> succeeded | partial | failed | interrupted
uploading -> failed
uploading | queued -> interrupted  (10 分钟未完成上传/未发起 execute，后续手动重跑)
任一状态 -> 到期不可访问 -> 物理删除
~~~

memory 成功且有效才进入 music_profile；memory 失败时标记依赖阶段 skipped。music_profile 成功后 AI 与 QQ 独立运行，两路都成功为 succeeded，单路失败/空结果为 partial，两路均失败为 failed；外部地址只有元信息时仍准确标记不可播放，不把运行状态当成播放证明。summary 展示实际状态，未执行的阶段不能填成功。

claim RPC 使用短事务及工作台独立事务锁，原子检查未过期、全部输入 ready、queued 状态和并发执行数<2，随后分配 execution_token 和 240 秒租约。每次写步骤或汇总都在短事务核对 run/status/token/expiry；外部请求期间不持锁。过期租约由维护标为 interrupted，晚到写入拒绝；不重新执行旧记录。数据库故障或请求断开导致状态无法最终写入时，后续维护保留已提交结果并回收。

## 7. 到期与清理

全部人类读取、照片、重跑、对比都用数据库时间判 expires_at>now()；到期返回找不到/已过期，隐藏内容。禁共享缓存，列表不包含过期记录。

维护由机器凭证访问：每小时扫描最多 50 条到期 run，先标其资产 delete_pending 并通过 Storage remove 删除对象，确认成功后删 steps/assets/run；单批应用预算 20 秒，达到预算保留剩余工作下轮重试，只回传计数。到期 run 的 reserved/failed 输入对象同样清理，不删除任何未到期 run 的输入快照。缺失对象视为已删除，其他失败保留路径，不先删数据库记录。

正常调度无积压时到期后下一小时完成物理删除；故障/积压期间实时禁止访问仍生效。不能把纯 API 完成或 SQL 删除 storage.objects 当成实际定时清理通过。

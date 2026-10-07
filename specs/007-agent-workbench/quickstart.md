# 实施后设置与验收指南：内部 Agent 工作台

本指南包含运行设置与完整验收要求。2026-10-07 本地实现、SDK、独立表/bucket/RPC 与本机自动清理已落地，实际证据见 [verification](verification/README.md)；不是所有部署/真人试用项目均已通过。HTTPS Preview 已完成自动清理、真实 240 秒请求和浏览器补验，10 位真人试用仍未验证；用户已配置 key，真实 Qwen/ACE-Step 与实际播放验收通过。对应 [plan.md](plan.md)、[数据模型](data-model.md)、[HTTP 契约](contracts/workbench-api.md)、[Pi 契约](contracts/pi-runtime.md)。

## Q1. 实施前准备与启动

1. 核对 progress.md：SDD-00 至 SDD-05 已完成，SDD-03 fcf5424、SDD-04 2f6933f、SDD-05 5936015；真实配乐为 ACE-Step、QQ 为 mock。确认当前 lib/memory 和 lib/music 契约与 [tasks.md](tasks.md) 一致，保留其他阶段改动。
2. Node >=22.19；本机 22.23.1 已满足。实施时精确添加两个 Pi 1.0.3 SDK 并提交 lockfile；不要用旧 namespace 或浮动 main。
3. 在本地 .env.local 人工填入内部口令、session secret（至少 32 字节随机值）、可信 origin=http://localhost:3000 和独立维护 token。所有值仅本地/部署密钥管理保存，不能发送到聊天或提交。SECRET_KEY 由用户人工填入；现有 Supabase URL/publishable key 沿用。
4. 默认 PI_EXECUTION_MODE=demo、WORKBENCH_MUSIC_MODE=demo。不需要当前提供大模型 key；配置字段完整列表见 Pi 契约。已有 FAL_KEY 不应使工作台 demo 自动调用收费配乐。
5. 实施迁移创建三张私有访问表、受限 RPC 和 private bucket，并逐对象检查 RLS/grants。不要沿用用户相册表或全 schema 撤销权限。验证 select 1，不将连接成功当作权限配置完成。
6. 在部署实施阶段设置每小时清理、Vault URL/token、pg_net 30 秒 HTTP 超时；本地设置定时器调用同一维护 API。部署运行环境验证 Node 下限与真实 240 秒请求能力，不能仅看 maxDuration 声明。

完成实施和配置后，在 E:\腾讯黑客松 运行：

~~~powershell
npm.cmd ci
npm.cmd run dev
~~~

访问 http://localhost:3000/internal/agent-workbench。本机已通过 `scripts/setup-workbench-local.ps1` 配置独立随机口令/secret/token，只写入忽略的 `.env.local`；口令读取该文件的 WORKBENCH_ACCESS_PASSWORD。脚本不会覆盖现有非空值，不处理 SECRET_KEY。若使用其他端口，同步可信 origin；口令表单只属内部工作台。直连数据库不稳定时可配置服务端 WORKBENCH_SUPABASE_PROXY_URL。

本机每小时清理任务已安装并自动触发验证。重新安装可执行 `pwsh -NoProfile -File scripts/workbench-maintenance.ps1 -Install`；一次手动检查为同命令去掉 `-Install`。任务需要 Node 服务正在运行；云端 Cron 无法访问本机 localhost，部署后另配置 Vault HTTPS URL/token。

代码完成后执行一次适当的质量检查，记录结果：

~~~powershell
npm.cmd run format
npm.cmd run lint
npm.cmd run tscheck
npm.cmd run build
~~~

不用新增自动化测试框架；临时脚本/截图放 .sdd00-work/，持久验收放本目录 verification/。生产构建后的部署请求再验 SDK 导入、服务端密钥隔离、执行时限与清理，不以开发服务器通过代替部署验证。

[HTTPS 部署入口与访问方式](verification/deployment.md)已可用于 SDD-06 补验，无需先完成 SDD-07；正式发布独立判断。[Qwen key 配置步骤](verification/qwen.md)区分本地与 Preview，本地 Qwen 为 live、配乐默认 demo；当前 Preview 理解与配乐均 live，QQ mock。

## Q2. 内部访问与权限

本地与实际部署分别执行：
- 移除内部口令/secret：根页、详情、对比和所有人类 API 均关闭；记录内容/照片/故事/音频地址不可读，execute/rerun 无调用发生。
- 恢复配置，不登录和输入错误口令：API 401；只有根页提供口令入口，错误输入不回显。正确口令后详情正常，退出后旧访问失效；轮换口令、会话满 8 小时后同样失效。
- 对 session/create/execute/rerun/退出发送异源或无 Origin 浏览器请求：403，无工具执行。伪造 Host 不能使异源通过。
- 直接猜未知/过期 ID，访问照片、比较其中一条无效记录：404 且没有任何另一条数据。登录后合法照片同源 no-store；Storage 公共/匿名/普通 authenticated 查询和下载被拒绝。
- 使用 publishable key 和普通用户身份尝试读取三表/调用内部 RPC：均被拒绝。生产浏览器 bundle/网络与持久记录没有服务端凭证、对象路径或完整供应商响应。
- 人类 cookie 不能调用维护；维护 token 不能登录。关闭人类口令后合法机器维护仍能清理到期对象，只返回计数。

记录尝试矩阵及工具调用计数，SC-006/SC-008 要求所有越权与未知记录尝试均不泄露、不调用工具。

## Q3. demo 输入与自动链路

分别使用 1 张、9 张有效照片，故事为空/有内容，发起默认 demo：
- 提交前有输入和配置版本预览，提交后显示唯一 ID、实际版本、内部测试标记与阶段。
- 详情出现 input、memory、music_profile、ai_music、qq_recommendations、summary 的状态，Memory/Profile 缺失字段准确显示；Pi record_memory_profile 有实际工具边界证据。
- 理解合法后自动转换音乐意图、生成演示配乐和 QQ mock，无人工确认。memory 标 demo/driver=pi，转换 deterministic、配乐 demo、推荐 mock。不能声称 demo provider 实际分析了照片。
- 配置含实际 prompt、loop、skill、tool/SDK 版本与哈希，步骤的请求/结果摘要可读，不包含 key/thinking/base64。
- 无照片、10 张、非法类型、损坏文件、过大源文件/请求、故事超过 1000 字均有明确提示；超长故事和照片输入保留以便修正，不静默忽略。
- 并发两条输入不同的 run，各自产生独立配置、事件与结果，独立 faux provider 不串脚本；第三条 execute 被明确限制，保留 queued 后可再试。
- 同 requestId 重复创建、重复 execute 已终态不会生成新记录或再次调用工具；改变输入/配置重复 requestId 被拒绝。

测量有效提交到 ID/配置/当前阶段出现的时间，至少 20 次、>=19 次 <=10 秒（SC-001）。取其中 10 次，全部具有完整中间状态与最终摘要，失败样本同样可见（SC-002）。此处是演示链路验收，收费服务次数应为 0。

## Q4. 重跑与版本

从未到期且有完整输入的 run 连续执行 10 次手动重跑：
- 默认 current，每次显示选择的配置、生成新 ID/parentRunId，原记录字段/步骤内容摘要不变，共得到 10 条新记录（SC-003）。
- 每张新照片字节哈希/顺序及故事与原输入一致，但 Storage 路径独立；新期限按新创建时间，不延长原 run。
- 用发布方式更新一个非敏感 prompt 版本，保持原版本受控实现仍可用；分别选择 current/original，核对新快照与实际版本，旧详情显示原版本。
- 在隔离验收配置里移除原工具/契约支持后选择 original：显示具体不可执行原因并阻止，不生成冒充原版本结果；可另行选 current。
- 失败或中断但完整输入 run 仍可重跑；不完整/损坏输入返回提示重新提交。

对两种配置选择与不可执行情况，实际版本正确率 100%（SC-010）。换 key 后不回写历史，原快照无凭证。

## Q5. 查找、对比与操作时间

按时间、状态、运行 ID 定位记录；翻页检查倒序与游标，不重复或漏掉固定样本。空集合有空状态，数据不可用有失败和返回入口。

选择两条同输入/不同配置，再选不同输入/不同结果，检查 input/config/memory/musicProfile/tools/summary 六组。故障样本的 pending、skipped、空值与不存在不同，不把时间戳和临时 URL 波动当核心变化。比较前后两条历史内容不变。

预先注入 20 个已知配置/Profile/工具状态差异，至少 19 个能在同一视图识别（SC-004）；不是凭视觉印象宣称 95%。邀请至少 10 位内部试用者完成提交→详情→重跑→对比，扣除外部等待，>=9 位累计操作 <=3 分钟，并指出一个差异（SC-007）；不足样本则记录“未验证”。可使用 [试用流程](verification/trial-guide.md) 与 [空白计时 CSV](verification/trial-results.csv)；尚未部署时可轮流使用本机，其他电脑不能用自己的 localhost 访问这台电脑。

## Q6. 失败、超时与分支

使用隔离的服务端验收夹具，禁止生产 UI 接受任意 mock 指令：
- 有效理解：所有依赖音乐自动开始。
- 理解 schema/语义无效、空响应、模型服务故障、45 秒超时：memory 失败；music_profile/AI/QQ 全 skipped，调用计数 0。
- AI 失败/超时，QQ 成功：run partial，保留 QQ；QQ 空/报错，AI 成功：保留 AI；两路失败不呈现成功。
- 音乐意图转换无效：不调用两分支；只返回元信息/不可播放音源准确显示。
- 全运行超过 210 秒、持久化失效：不再发起工具，已有结果保留，未完成状态可读，不能说成功已保存。
- API 原始供应商错误/鉴权失败不回显 key/header/body；所有日志和记录只有白名单摘要。

四类必要样本（有效、无效理解、AI 失败、QQ 失败）全部符合自动继续/独立分支规则，kind 与来源正确，用户端确认保存规则不变（SC-011）。

## Q7. 刷新、服务重启与中断恢复

创建 10 条未到期且完整输入 run，完成后刷新、停止再启动服务，逐条读取照片/故事/配置/步骤并新建重跑；10/10 保留（SC-009 的未到期部分）。数据库故障时显示真实不可读，不从客户端旧缓存冒充持久化成功。

另在 memory 与音乐阶段分别终止服务：
- 重启可立即查看已提交结果，未完成阶段仍可见。
- 租约满 240 秒后调用维护/等待调度，状态变 interrupted，已完成结果不变。
- queued 或上传未完成且十分钟无人继续的记录也回收。
- 迟到执行者写入被 token/租约/状态条件拒绝；不会自动重跑旧供应商请求。
- 用户手动重跑得到新 ID，旧数据只读；网络失败时重试查看，不自动重收费。

## Q8. 30 天保留与实际清理

在隔离验收数据创建时，构造不同 createdAt 的未到期/已到期 run 及自己的对象；不要在正式历史中修改创建时间/期限，也不实际等待 30 天。另创建原 run 临近到期、子 run 未到期的独立副本。

1. 过期后列表、详情、照片、对比、重跑全部拒绝；先故意让清理失败，访问仍不能绕过。
2. 手动调用合法 maintenance，检查 Storage API 对象实际不存在、关系记录删除，而未到期子 run 的照片和结果可读。
3. Storage 删除失败时，路径与待删记录仍保留；恢复后重试成功，重复调用幂等；不直接 SQL 删 storage.objects。
4. 让真实部署定时任务至少自动执行一次，留存 Cron/pg_net 状态、维护计数及对象删除检查。正常无积压时下一小时物理清理。
5. 本地调度也需执行一次；托管 cron 访问 localhost 失败不能计为本地调度通过。

SC-009 的到期和独立副本部分全部通过；未配置调度/只手动清理必须列为未完成，不能勾选 SDD-06 交付。

## Q9. 用户端隔离与内部界面

关闭工作台、模拟其数据库/工具异常后，检查上传、理解、生成/推荐、播放、保存五个现有入口仍可达，用户文案无内部错误、导航无工作台（SC-005）。用户端已有 demo 范围与上游未完成事项仍按 progress.md 表述；此检查不替代 SDD-03–05 业务验收。

工作台在 320/375/430 px、字体放大与键盘操作下核对列表、配置折叠、详情、对比和主要按钮；局部长表滚动，页面不整体横向溢出，错误有文字。若实现触及用户端界面，按负责阶段对应 PNG/HTML 单独验证，不能宣称九页全部验收。

## Q10. 后续真实模型验收

用户提供 key 后，在服务端配置匹配的 PI_LLM_PROVIDER/MODEL/API/BASE_URL，显式 PI_EXECUTION_MODE=live。先验证图片输入与工具调用能力，再进行真实照片测试；MemoryProfile.source=agent、driver=pi，并有真实工具事件和有效结构化结果。未知/非视觉模型、缺失/错误 key 明确失败，不回退 demo。

配乐 key 与大模型 key 独立；需要真实配乐时显式 WORKBENCH_MUSIC_MODE=live 并配置 FAL_KEY，失败保留 QQ mock。不要求 QQ 成为真实检索。使用本次输入生成的结果，不能用旧 Agent/用户数据填充。

没有凭证时将这些项目标为“未执行，等待凭证”，完成 demo 验收也不能宣称真实照片理解/真实配乐通过。部署请求时限不足同样是实际阻塞，须记录后再调整方案。

## 验收记录与完成判断

verification/ 的实施后摘要至少记：环境/日期、SDK/配置版本、运行 ID、sample 数、延迟统计、成功/失败/中断截图、权限矩阵、历史摘要一致性、独立副本与物理删除证据、质量命令结果、用户入口回归、live/demo 各自状态。

每项 SC-001–SC-011 均已在 Q2–Q10 给出测量步骤。达到阶段条件后在同一提交更新 progress.md；缺 key 时单独记录真实供应商验收未执行，可按规格进行显式演示验收。缺调度、部署时限或权限/持久化验收则相关完成条件仍未满足。不得以规划产物生成代替业务运行验收或预先勾选实现项。

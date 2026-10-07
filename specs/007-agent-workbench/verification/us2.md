# US2：历史重跑、重启与保留

2026-10-07，实际 Supabase/Storage。十条成功运行各创建独立重跑记录，输入快照、配置 digest 一致，parentRunId 正确，旧详情完整 JSON 未改变。随后停止开发服务器并启动生产构建，10/10 原记录仍能读取照片并核对 SHA-256，逐条再次创建重跑；原记录结果仍不变。浏览器已验证默认 current、自动执行新 ID、列表选择与历史对比。

同一输入另外连续创建并执行 10 次重跑，5 次 current、5 次 original，10 个新 ID 全部 succeeded；逐次比较原详情完整 JSON，均未改变。配置 digest 与实际受控 v1 一致，详见 evidence.json。

独立配置边界通过：未注册 prompt/loop/tool 版本被 CONFIG_UNAVAILABLE 拒绝；live 当前配置缺 key 时返回 503，原版 demo 仍可读取并显示可执行，不静默替换历史。已登记的可执行版本目前仅 v1；未宣称部署了两个不同 prompt 实现。

保留夹具使用新建的独立 internal_test 记录及真实 JPEG 对象，创建时设置临近 30 天到期；没有修改正式历史的创建时间。该夹具明确标为 retentionFixture，未冒充 Agent 成果。父 `44f8a94a-d73f-4500-bad8-f2cdf231938a`、子 `289634c8-c29c-4898-89d5-2f4a18bb222e`。

本机任务 `TencentMusicAgentWorkbenchMaintenance` 在 2026-10-07 13:52:10 自动运行，LastTaskResult=0。父数据库记录已删除，Storage API 下载实际对象返回不存在；父详情/照片/对比/重跑四种访问均为 404。子记录仍可读，私有照片 SHA-256 与原输入一致。重复维护返回计数且不影响子副本。

真实网络故障留下的运行经租约维护变为 interrupted；只回收未完成步骤，已完成步骤冻结。实际远端负面写入检查通过：输入 digest 改写 IMMUTABLE_SNAPSHOT、终态状态改写 TERMINAL_RUN、已完成 memory 改写 FROZEN_STEP、迟到 token 写入 WRITE_REJECTED。

增量迁移 `20261007101735_agent_workbench_active_leases.sql` 已应用，只计算未失效租约的并发数。远端事务夹具构造两条失效租约后，仍可领取两条新运行，第三条被拒绝；失效的原 token 写入亦拒绝。断言通过后主动抛出 LEASE_FIXTURE_VERIFIED_ROLLBACK，整笔事务回滚，不残留假照片或运行记录。

云端 `agent-workbench-hourly-maintenance` 按 `0 * * * *` 已注册。2026-10-07 08:00 UTC 的 SQL 调度 succeeded，但 Vault 中两个所需配置数为 0，因此函数跳过 HTTP；这个 succeeded 不代表实际部署维护成功。用户确认尚未部署，不能使用开发机 localhost 作为云端维护地址。

补充强制进程中断：通过本地生产创建 API 上传真实 JPEG，分别在 memory running、ai_music running 且 QQ 已完成时，强制结束验收脚本自己启动的独立 Node 执行进程。进程使用实际 runner、Pi SDK、DAL 和远端 Supabase/Storage；仅 memory 用隔离慢速官方 faux stream 保持中断窗口，音乐使用既有 development demo 慢响应，均无真实供应商调用。进程结束后立即经生产详情 API 读取：运行仍为 running，已有阶段可见。没有改变 240 秒租约值，实际等待租约到期后调用 maintenance，两条都变 interrupted。

memory 的 input 冻结；音乐的 input/memory/music_profile/qq_recommendations 四阶段完整 JSON 均与中断后保存的副本一致。原 execution token 的迟到 RPC 写入均被 WRITE_REJECTED 拒绝；没有自动重跑。逐条手动 original 重跑创建新 ID，经实际生产 execute API 完成 succeeded，旧详情完整 JSON 未改变。中断 run 为 `3c9113cb-89eb-4962-ac02-169ca8f1c92e` / `478b18f3-e2cf-4231-a2f0-58b91c6bc59a`，新 run 为 `ba9e47fe-9c58-4148-9078-b4c7d2ea9e7d` / `dde452f7-0b18-4143-8b96-bc05bac206ad`。此验收证明本地执行进程硬中断后的持久化和回收，不代表已验收实际部署宿主的 HTTP 生命周期。

补充 Storage 删除故障与重试：新建明确标记 cleanupFailureFixture 的父记录及真实私有 JPEG，再经实际 rerun API 创建独立子副本。父到期后，仅在隔离 Node 进程中将首次 Storage remove 的返回值注入为错误，其余维护逻辑、RPC、数据库和对象均为实际服务。维护返回 failedRuns=1/deletedRuns=0/hasMore=true；数据库保留 delete_pending 资产和原路径，清理租约已释放，Storage 下载仍成功。此时父详情/照片/对比/重跑四种访问全部 404。

随后调用本地生产 maintenance HTTP，返回 deletedRuns=1/deletedObjects=1/failedRuns=0；父关系记录和实际对象均消失，子照片哈希保持一致。另一个独立夹具先通过 Storage API 删除自己的对象，维护仍成功删除关系记录；重复维护 deletedRuns=0/failedRuns=0。没有通过 SQL 删除 storage.objects，没有新增生产故障入口。父 `bf6222c3-e74e-4dd2-a25a-310bfde3924f`、子 `bcb5b39d-c7fa-4c2e-9f19-94d308f885c9`；详情见 evidence.json。

T037/T039 部署补验通过：Vault 配置、受保护 HTTPS、实际加速 Cron 自动 HTTP 200、父数据库/Storage 物理删除、四类 404、独立子副本哈希。临时任务已移除，原每小时任务保持启用；详见 [部署验收](deployment.md)。

live 两图父 f1b66992-f805-4518-8629-20ff83e93ec9、original 子 804766b6-cf5c-4c28-bf4b-bdb6e7ccd485 均完成六阶段，实际 Qwen/FAL 结果保留，原详情完整 JSON 不变，旧 demo 历史可读。自然每小时任务 14:00 UTC runid=20/pg_net=11 HTTP 200，区别于加速删除夹具。

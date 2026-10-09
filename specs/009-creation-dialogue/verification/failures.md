# 失败、竞争与照片版本

2026-10-09，隔离草稿与明确 demo 配置，直接调用同一 repository/dialogue/photos 边界。故障夹具只在 development 且 draft mode=demo 时可用，生产与 live 不接受故障请求头。

- timeout、unavailable、invalid-result 三次失败均保留同一 user/turn；第四次同 turn 重试成功，attempt=4，没有重复消息或失败助手结论。
- 同 clientMessageId 同正文返回原 turn；重复执行成功 turn 不再调用模型，不再追加消息。两次相同行 revision 的数据库 CAS 只有一个成功，另一个 CONFLICT。
- 数据库拒绝改写原消息正文，APPEND_ONLY；确认快照与卡正文同样为不可变前缀，只有卡状态可以变化。
- 新输入令旧卡 stale；新版成功后 superseded，旧确认 409。增加照片重建完整 photoOrder，移除至零仍可讨论但无新可生成卡。
- 照片提交使旧 pending/running turn superseded。额外用已缓冲照片响应的门闩挂起旧执行，提交零图并完成新轮后才释放旧响应；旧执行返回 CONFLICT，没有添加旧助手回应，最新 turn 保持成功。
- 模拟已过期 running 租约，读取转 interrupted，原输入只有一条。工具非法或服务不可用不静默返回 demo。
- 上传 prepare 重试校验原文件 manifest；客户端上传过程中另一标签变更照片集合时拒绝用旧集合覆盖。旧响应不能覆盖更高 revision 的视图。

18 项边界断言通过，另有 7 项界面恢复/滚动/新建断言。完整脚本与临时数据仅在 `.sdd00-work/`，与真实 Agent/ACE-Step 调用证据分开。

# UI Contract：音乐相册 App Shell

来源：音乐相册-ui还原.html 的 screens/hotspots，designs/ui/01–09 PNG。

| PNG | 页面/状态 | URL |
|---|---|---|
| 01 | 首页 | `/` |
| 02 | 上传照片 | `/create` |
| 03 | Agent 记忆理解 | `/create?state=understanding` |
| 04 | 生成结果 | `/result` |
| 05 | 沉浸式播放 | `/play` |
| 06 | 调整音乐 | `/play?state=adjust` |
| 07 | 保存音乐相册 | `/play?state=save` |
| 08 | 我的音乐记忆 | `/memories` |
| 09 | 音乐相册详情 | `/memories/demo-graduation` |

## 主要跳转

01 创建按钮／底栏加号 → 02；02 添加／继续 → 03；03 确认 → 04；04 进入播放 → 05；05 调整 → 06，保存热点 → 07，返回 → 04；06 发送／重新播放 → 05；07 保存 → 08，稍后 → 05；08 首个相册卡片和其播放图标 → 09；09 生成音乐 → 04，返回 → 08。

完整的 17 个热点（原始百分比坐标、名称、目标序号）保存在 components/music-album/design-map.ts 的 prototypeHotspots。实际 DOM 操作承担跳转，不覆盖透明全屏热点。SDD-02 中 02 的添加/继续操作必须先有 1–9 张有效照片并提交理解；03 的确认必须先有符合最低内容要求的 Memory Profile。

05 PNG 右侧按钮写“查看 AI 理解”，HTML 同一位置的热点称“保存相册”并进入 07。SDD-04 保留 PNG 可见文案：仅当前会话存在已验证可播放的 AI 或 QQ 音乐版本时，该热点进入 07；只有通用等待音或音频失败时禁用。AI 理解改由播放画面上的独立上拉区域展开，不重启音乐。05 左上返回 04 时停止声音；05→06 暂停声音；06 发送指令时留在 06 展示生成中/成功/失败，成功后点击音乐卡“重新播放”进入 05。07 的保存写入由 SDD-05 实现。具体运行前提见 `components/music-album/design-map.ts` 的 `playHotspotPreconditions`。

首页和列表显示五项底栏，只有首页、创建、记忆有路由；音乐和个人中心为 disabled。未知相册 ID 使用 App Router notFound 和可返回列表的中文状态。演示保存仅导航，不落库。页面没有 Supabase 业务请求；原有会话代理边界不变。

## 只读连接

通过 Supabase MCP 执行 `select 1 as connected`，2026-10-05 返回 `connected = 1`。没有建表、写入、上传或认证修改。后续命名见 data-model.md。

# SDD-05 质量检查

日期：2026-10-06

| 检查 | 结果 | 备注 |
|---|---|---|
| `npm run format` | 通过 | Biome 格式化 62 个文件 |
| `npm run lint` | 通过 | 仅保留既有 CSS specificity 警告与 Biome 配置弃用提示 |
| `npm run tscheck` | 通过 | `tsc --noEmit` |
| `npm run build` | 通过 | Next.js 16.3.8 生产构建及 4 个相册 API 路由生成成功 |
| Supabase `select 1 as connected` | 通过 | 返回 `connected = 1` |
| 五表/RLS 核对 | 通过 | 五张表存在，RLS 均为启用 |
| 保存→刷新→详情 | 通过（API 冒烟） | demo 会话保存返回 `albumId`，列表和详情读回标题、日期、照片、音乐来源；三个页面 HTTP 200 且 HTML 含音乐相册 shell |
| 重复 requestId | 通过（API 冒烟） | 首次返回 201，重试返回相同 `albumId` 与 `alreadySaved=true` |
| 双身份隔离 | 通过（双 cookie API） | A 可读 `5babddf1-ee4d-4c50-9a37-977563a8482f` 的列表/详情/照片，B 列表为空且交叉详情/照片 404 |
| 浏览器视觉回归 | 通过（Playwright + Edge） | 07→08→09→08 热点通过；320/375/430 截图无横向溢出，页面/console error 为 0 |

SDD-05 尚不能因静态检查通过而标记完成。

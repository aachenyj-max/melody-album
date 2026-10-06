# 实施计划：沉浸式播放与自然语言调整

**Branch**: `master`（当前工作分支） | **Date**: 2026-10-05，实施核对 2026-10-06 | **Spec**: [spec.md](spec.md)

**Input**: `specs/005-immersive-playback/spec.md`；用户要求“遵循当前项目技术栈”。

## Summary

在现有 `/play` 与 `/play?state=adjust` 两个路由状态上完成 05、06 号界面：使用本次已确认照片和 SDD-03 选中的可播放音源，提供真实播放控制、随音频进度缓慢切换的照片、默认收起的 AI 解释，以及自然语言调整和重新试听。沿用 Next.js App Router、React、TypeScript、Tailwind CSS v4、Biome 与现有 App Shell；浏览器音频使用原生媒体能力，不新增播放器或全局状态库。结果只在当前创作会话中存在，07 号保存写入留给 SDD-05。只有当前存在可播放的 AI 配乐或 QQ 音乐时，05 号页才允许进入 07；通用等待音乐不能作为保存成品。

## Technical Context

**Language/Version**: TypeScript 5、React 19.2.8、Next.js 16.3.8

**Primary Dependencies**: 已安装的 Next.js App Router、Tailwind CSS v4、lucide-react；浏览器原生 `HTMLAudioElement`；不新增依赖

**Storage**: SDD-02/03 已确认的照片、记忆和音乐结果保留于当前 `(album)` 导航会话内存；本阶段不写数据库、Storage 或浏览器持久存储。扩展已落地的 `MusicSessionProvider`，不建立第二套会话。

**Testing**: 浏览器手工验收真实音频播放/暂停/拖动、自动播放受阻、调整成功/失败、切换与离开、05/06 视觉和跳转；提交前运行 `npm run format`、`npm run lint`、`npm run tscheck`，阶段交付运行 `npm run build`

**Target Platform**: 以移动宽度网页为主，桌面宽度保持现有手机外壳展示；覆盖减弱动态效果设置

**Project Type**: 现有单体 Next.js Web 应用，服务端页面与局部客户端交互组件

**Performance Goals**: 具备可用本地或已加载音源时，用户触发播放后 2 秒内听到声音或看到明确失败；播放进度与照片位置在用户拖动后 1 秒内更新；调整请求全程显示状态

**Constraints**: 1–9 张照片；目标配乐 15–30 秒；同一时刻仅一段音频发声；不得把等待音乐或 mock 标作真实个性化成果；05/06 与对应 PNG 的画面结构及 HTML 主要热点一致；音频浏览器策略可阻止自动播放；无可播放成品时保存入口不可用，不能进入 07

**Scale/Scope**: 两个用户端界面（05、06）及 04→05、05→04/06/07、06→05 交接；一份当前播放会话、一个已选音乐版本、至多一个有效调整轮次；保存持久化在 SDD-05

## Constitution Check

*GATE: Phase 0 前检查；Phase 1 设计后复核。*

| 宪章原则 | 本阶段规划 | 结果 |
| --- | --- | --- |
| 核心路径优先 | 04 的结果可进入 05 播放，06 调整后可返回，05 可继续到 07；失败保留旧版或可用推荐 | 通过 |
| MVP 边界明确 | 只实现播放和自然语言调整；歌词、分享、复杂剪辑及保存写入不纳入 | 通过 |
| 简单实现优先 | 复用已有路由、App Shell、照片组件和 SDD-02/03 会话；采用浏览器原生音频，不新增依赖 | 通过 |
| 产品体验服务演示 | 05 保留照片主视觉与玻璃播放器，06 保留浅色对话布局；明确等待、成功、失败 | 通过 |
| 可验证交付 | 用可听音源、3 种调整状态、3 个移动宽度及现有静态检查验收 | 通过 |

**前置门槛核对**：实施时 `progress.md` 已将 SDD-02/03 标记完成。`MusicSessionProvider` 保留本次确认记忆、音乐轮次和选择；`/api/music/generate` 接通真实 fal.ai ACE-Step，并在无密钥时明确使用演示配乐；QQ 推荐仍为本地 mock。播放器和调整沿用这套边界。

## Project Structure

### Documentation (this feature)

```text
specs/005-immersive-playback/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── playback-adjustment.md
└── tasks.md                 # 后续由 $speckit-tasks 生成
```

### Source Code (repository root)

```text
app/
├── (album)/
│   ├── layout.tsx             # 复用 SDD-02/03 的当前创作会话边界
│   ├── result/page.tsx        # 04→05 的已选音乐交接
│   └── play/page.tsx          # 05、06、07 的现有 query 状态路由
└── globals.css               # 05、06 样式与减弱动态效果
components/music-album/
├── album-screen.tsx          # 将 05、06 静态占位替换为交互组件，保留 07
├── play-flow.tsx             # 扩展现有播放流程，承载照片、控制、进度和解释抽屉
├── adjust-flow.tsx           # 指令、快捷建议、轮次状态与重新播放
├── music-session.tsx         # 扩展现有音乐会话，单一音频拥有者贯穿 04→05→06
└── design-map.ts             # 热点变化时同步现有导航契约
lib/music/
└── contract.ts               # 对齐 SDD-03 的结果/音源及调整交接类型
```

**Structure Decision**: 保留 `app/(album)/play/page.tsx` 对 `/play`、`?state=adjust`、`?state=save` 的分派，不新建重名页面或引入全局状态库。播放/调整用局部 Client Component 访问媒体、手势和表单；当前创作的照片与音乐版本复用 `app/(album)/layout.tsx` 中现有的 `CreationSessionProvider` 和 `MusicSessionProvider`。扩展现有 `components/music-album/music-session.tsx` 和 `components/music-album/play-flow.tsx`，由单一音频控制者管理 04→05→06 的音源，进入 06 时暂停，离开创作流程时停止；如上游已实现等同能力则直接补齐而不创建第二套 Provider。`lib/music/contract.ts` 只对齐阶段交接，不复制 SDD-03 的音乐编排实现。`components/music-album/adjust-flow.tsx` 和 `app/api/music/adjust/route.ts` 只负责 SDD-04 的调整交互与同源边界。现有 `/api/music/generate` 继续作为上游生成边界，不在本阶段重复实现生成服务。

## Phase 0：研究结论

见 [research.md](research.md)。已确定当前技术栈内的客户端边界、音频状态、跨路由交接、调整轮次、设计稿冲突和失败回退；无待定的技术选型。外部 AI 生成和 QQ 音乐真实接口仍以 SDD-03 契约及接入资料为准。

## Phase 1：设计与契约

- [data-model.md](data-model.md)：播放会话、音乐版本、调整轮次、解释与状态转换。
- [contracts/playback-adjustment.md](contracts/playback-adjustment.md)：04→05→06/07 的会话交接、用户操作与调整请求/结果契约。
- [quickstart.md](quickstart.md)：音频、调整、失败、视觉和跳转的可执行验收步骤。

## Phase 1 后宪章复核

设计使用现有栈及原生媒体能力，只在当前会话保存状态，不新增持久化或不相关页面。播放器与调整服务围绕 MVP 主链路，失败时保留已有可播放结果。五项宪章门槛仍通过，无复杂度例外。

## 风险与依赖

- SDD-03 已完成当前交接；真实 fal.ai 生成依赖服务和网络可用，本阶段仍须区分真实配乐、演示配乐、QQ mock 与通用等待音乐。
- 设备可能阻止自动播放。以 `play()` 成功/拒绝和真实媒体事件确定界面状态，并保留手动开始入口。
- 05 号 PNG 右侧按钮文案“查看 AI 理解”与 HTML 同位置 05→07 保存热点冲突。按现有导航契约保留该跳转，AI 理解由独立上拉区域打开；在 05–07 联调记录文案语义风险，不宣称已完成保存。
- 音源本身须可使用且允许播放。AI 路径沿用已接入的 fal.ai ACE-Step 或明确标识的本地演示适配器；QQ 曲库仍是 mock，不能计入真实检索验收。
- 调整请求可能迟到或失败；只有有可播放音源的新版本才能成为当前版本，旧音频始终可恢复。
- 05 右侧按钮只有在当前选中音源实际可播放时才进入 07；等待音乐、无音频元信息或失败候选必须保持不可保存，并由上拉区域承担 AI 解释查看。

## Complexity Tracking

无宪章例外。

# 实施计划：音乐结果编排与等待兜底

**Branch**: `master`（当前 Git 工作分支；Spec Kit 特性标识为 `004-music-orchestration`） | **Date**: 2026-10-05 | **Spec**: [spec.md](spec.md)

**Input**: `specs/004-music-orchestration/spec.md`；遵循当前 Next.js、TypeScript、Tailwind CSS v4 与 Biome 技术栈，不新增无关依赖。

## Summary

把 04 号静态结果页改成承接 SDD-02 已确认记忆的双路音乐流程：从 `MemoryProfile` 形成初版 `MusicProfile`，通过同源服务端边界接入后续真实文字生成音乐 API，当前无资料时仅显示明确的 AI 演示模式；QQ 音乐推荐使用用户指定的稳定 mock 数据，并且只有真实可播音频才能充当失败兜底。生成期间使用通用氛围音乐与非伪造进度，默认 AI 路径在 04→05 导航时接续等待音乐，完成后切换；用户主动选中的 QQ mock 不被 AI 完成抢播。完整 05 号播放器和保存留给后续阶段。

## Technical Context

**Language/Version**: TypeScript 5、React 19.2.8、Next.js 16.3.8

**Primary Dependencies**: 现有 Next.js App Router、Tailwind CSS v4、lucide-react、Biome；不新增音频 SDK、状态库或外部服务依赖

**Storage**: SDD-02 已确认的 `MemoryProfile`、`File[]` 和本阶段 `MusicRun` 只保存在当前浏览器导航会话内存；本阶段不写 Supabase、Storage、URL、localStorage 或 sessionStorage

**Testing**: 按 [quickstart.md](quickstart.md) 手工验证成功、慢响应、原创失败、mock 推荐无音频、音频拦截、旧响应与刷新空态；逐项核对 04 PNG/HTML 热点；运行 `npm run format`、`npm run lint`、`npm run tscheck`、`npm run build`

**Target Platform**: 移动宽度优先的网页；浏览器需支持标准音频播放，自动播放被拦截时提供用户手动启动

**Project Type**: 现有单体 Web 应用，App Router 服务端页面、局部 Client Component 与同源 Route Handler

**Performance Goals**: 04 进入后立即展示两路可识别状态；慢响应始终有可见等待反馈；有可用音频时不因 04→05 导航断音；成功切换时不出现双音源重叠。真实生成耗时目标须待 API 文档和实测确认，不把原型“约 20 秒/60%”当服务承诺

**Constraints**: 输入仅为已确认的有效记忆；AI 目标 15–30 秒、无歌词；QQ 当前仅 mock 且显式标识；无真实 API 资料时只可验收演示适配器；真实外部密钥留在服务端；进度只显示可信百分比；音频素材须合法可用

**Scale/Scope**: 一份活动记忆、一个初版 Music Profile、一轮双路生成/推荐及各自重试；负责 04 号结果页和向 05 号交接，不扩展登录、持久化、真实 QQ 曲库、完整播放器或内部 Agent 工作台

## Constitution Check

*GATE：Phase 0 前检查；Phase 1 设计后复核。*

| 宪章原则 | 本阶段设计 | 结果 |
| --- | --- | --- |
| 核心路径优先 | 确认记忆 → AI/推荐并列结果 → 等待音乐或可播推荐 → 播放页交接；原创失败仍可选可播推荐 | 通过 |
| MVP 边界明确 | 只实施 SDD-03；QQ mock 是用户明确变更且标示来源；05 完整播放与 07 保存分别留给 SDD-04/05 | 通过 |
| 简单实现优先 | 复用现有 `(album)` 路由、App Shell、SDD-02 会话；一个服务端生成边界和一个窄范围音乐会话，无新依赖与数据库 | 通过 |
| 产品体验服务演示 | 保持 04 PNG 的主结构和 HTML 热点，等待/失败不留下空白页，来源清晰可辨 | 通过 |
| 可验证交付 | 成功、慢响应、失败和跨页切换都有手工验收路径；现有四项静态/构建命令纳入验收 | 通过 |

**实施核对**：SDD-02 的 `ConfirmedMemory` 已按契约交到 `/result`。真实供应商已按用户最新要求切换为 fal.ai ACE-Step Prompt to Audio；`FAL_KEY` 仅由服务端读取。ACE-Step 已完成真实队列和浏览器音频加载验收。

## Project Structure

### Documentation (this feature)

```text
specs/004-music-orchestration/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
├── contracts/
│   ├── music-generation.md
│   └── result-playback.md
└── tasks.md                    # 后续由 $speckit-tasks 生成
```

### Source Code (repository root)

```text
app/
├── (album)/
│   ├── layout.tsx              # 复用 SDD-02 记忆会话，挂载窄范围音乐会话
│   ├── result/page.tsx         # 04 号页面服务端外壳
│   └── play/page.tsx           # 05 号占位页消费音乐交接，完整控制由 SDD-04 完成
└── api/music/generate/route.ts # 同源 POST，验证 Music Profile 并调用生成适配器
components/music-album/
├── album-screen.tsx            # 保留其他编号画面；04 的静态占位替换为结果流程
├── result-flow.tsx             # 04 状态、两路展示与选择
└── music-session.tsx           # 当前运行、唯一音频控制者与 04→05 交接
lib/music/
├── contract.ts                 # 内部请求/结果/错误形状与验证
├── profile.ts                  # Memory Profile → Music Profile 纯转换
├── generator.ts                # 真实 API 服务端适配边界与显式演示模式
└── mock-recommendations.ts     # 稳定的 QQ 演示推荐与可播状态
public/audio/music-album/      # 实施时补充可合法使用并验证可播的音频素材
```

**Structure Decision**: 维持现有单项目目录和 App Router 路由边界。`/result` 的服务端页面只挂局部客户端交互；标准浏览器音频 API、请求状态和当前选择由客户端音乐会话持有。该会话位于结果与播放共有的 `(album)` 布局，复用 SDD-02 的已确认记忆，不拷贝源图到服务端。服务端生成入口只接收必要的 Music Profile 文本并保护未来真实密钥；QQ mock 留在本地模块，不为不存在的曲库服务增设接口。

**视觉约束**：对照 `音乐相册-ui还原.html` 的第 04 项及 `designs/ui/04-生成结果-为你生成与QQ音乐推荐.png`，按原顺序保留标题、生成状态、切换区、照片、AI 卡片、推荐卡片、底部主按钮，核对颜色、字体、玻璃层级、图片位置和“进入播放”热点。动态标题、照片、音频状态和“演示推荐/演示配乐”标识可以替换样例内容，不移动结构。05 号页的完整视觉与控制仍按 SDD-04 验收。

## Phase 0：研究结论

见 [research.md](research.md)。已确定确认记忆交接、Music Profile 纯转换、fal queue 服务端生成适配、QQ mock 与可播素材、跨页单音源、真实进度和过期响应规则。ACE-Step 接收目标时长；浏览器在超过目标时长时停止播放。

## Phase 1：设计与契约

- [data-model.md](data-model.md)：`MusicProfile`、`MusicRun`、AI/推荐分支、当前选择、音频会话与状态不变量。
- [contracts/music-generation.md](contracts/music-generation.md)：同源生成入口、服务端适配器、成功/失败包与真实 API 待映射边界。
- [contracts/result-playback.md](contracts/result-playback.md)：04 号视觉/导航、QQ mock 可播性、等待音乐与 04→05 交接。
- [quickstart.md](quickstart.md)：实施后的前置条件、命令、成功/慢响应/失败/空音源与视觉验收。

## Phase 1 后宪章复核

设计未增加依赖、数据库或新产品模块；照片与确认记忆仍只在当前导航会话，真实外部密钥只在服务端，QQ mock 不冒充真实曲库，AI 演示模式不冒充真实生成。04 号结构与主要跳转保留；音频失败可以重试或使用可播推荐。五项宪章门槛仍通过，无复杂度例外。

## 风险与依赖

- SDD-02 确认交接已接入；本阶段沿用其浏览器会话，不另建持久化或重复上传路径。
- `public/audio/music-album/` 已补充自制演示音频；没有资源的曲目保持不可播。
- 真实供应商使用异步 queue，完成时间有波动；本地网络需要 `FAL_PROXY_URL` 代理。服务端最长等待 300 秒，超时按失败处理。
- `progress.md` 仍写“真实 QQ 检索 tool”作为 SDD-03 门槛。用户现已明确本次 Demo 用 mock；实施阶段更新进度时须记录这一范围变更及真实 QQ 接入限制，不得声称已接通曲库。
- 现有 04 静态卡片包含固定“60%”与静态 QQ 曲目；实施必须替换为真实状态和有来源标识的 mock，且不破坏设计稿结构。

## Complexity Tracking

无宪章例外。

# Quickstart：SDD-00

## 启动与检查

依赖已安装；`.env.local` 仅在本地保存。浏览器端只使用 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY；不输出其内容。

```powershell
npm run dev
npm run format
npm run lint
npm run tscheck
npm run build
```

打开 http://localhost:3000。九个状态及 17 个主要热点见 [导航契约](contracts/ui-navigation.md)，与音乐相册-ui还原.html、designs/ui/01–09 PNG 对照。

演示链路：首页 → 创建 → 理解 → 结果 → 播放 → 调整 → 播放 → 保存 → 列表 → 详情 → 结果。连续状态使用 `/create?state=understanding`、`/play?state=adjust`、`/play?state=save`；可刷新或直接访问。

演示 ID：demo-graduation、demo-travel、demo-cat、demo-garden。未知 ID 显示找不到相册和返回列表入口。

## 2026-10-05 验收结果

- `npm run dev` 启动成功。
- 无头 Edge 浏览器：9 状态 × 375/390/430px 共 27 项全部 HTTP 200；无横向溢出、缺失图片或 pageerror。
- HTML 对应的 17 项主要跳转全部成功；首页、列表和毕业详情各刷新 5 次，内容稳定非空；未知 ID 可返回列表。记录见 [browser-results.json](verification/browser-results.json)。
- `npm run format`、`npm run lint`、`npm run tscheck`、`npm run build` 通过。lint 保留 CSS 不同组件间的 descending specificity 警告及现有 Biome 配置 recommended 弃用提示；没有错误。
- Supabase MCP 对项目 lekgrusgdxdbmbyaejzt 执行 `select 1 as connected`，返回 `connected = 1`。研究时 public schema 无业务表；本阶段没有创建表、bucket、写入数据、上传文件或修改认证。
- 设计资源 01–09 均存在，九个状态映射覆盖 100%。图片只裁取摄影区域，脚本为 scripts/extract-design-assets.py；界面标题、卡片、按钮、输入框与导航均为 DOM/CSS。
- 首页使用 draw-ui 的 measure_reference → prepare_capture → 浏览器采集 → verify_capture 流程，校准视口 863×1822、DPR 1、CSS 像素截图。显式将容器上限放大至 863px，隐藏开发工具入口，等待图片与字体完成。测量只证明标注框的几何关系；不能换算成整体还原率。修正前后偏差见 [geometry.md](verification/geometry.md)。

## 已知限制与后续阶段

- SDD-00 交付可运行框架和设计基线，上传、Agent、生成、音源、筛选、保存持久化和分享未实现；进度、对话、歌曲和相册为静态演示。输入不会触发真实业务，保存只导航。不可用的播放/收藏/筛选控件 disabled。
- 逐页截图已人工对照 01–09，但尚未完成完整视觉验收：摄影裁切与清晰度、卡片上缘的不规则轮廓、玻璃材质、字体/图标存在细节差异；05 的背景构图与 09 的照片比例需精修。不得将这些页面标记为像素一致或完成 SDD-01 至 SDD-05。
- 原稿仅提供带 UI 的 PNG，提取的摄影素材分辨率和构图受限；最终验收需优化裁切或补充原始摄影素材。
- 05 PNG 的“查看 AI 理解”与 HTML 同位置“保存相册”热点存在命名差异；当前保留 PNG 文案并按 HTML 进入 07。产品规则需在 SDD-04/05 闭合。
- 原稿历史相册含 12/18 张照片，历史数量按稿保留；新建相册 1–9 张限制由 SDD-02 实现。
- 后续命名：music_albums、music_album_photos、music_album_versions、music_album_recommendations、music_generation_runs；私有 bucket music-album-photos。

下一阶段：SDD-01，完善首页与历史记忆，并完成 01、08、09 的逐页视觉验收。

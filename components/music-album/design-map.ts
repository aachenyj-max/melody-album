export type AppRouteKey =
  | "home"
  | "create"
  | "result"
  | "play"
  | "memories"
  | "memory-detail";

export type RouteStatus = "ready" | "placeholder";

export type AppRoute = {
  key: AppRouteKey;
  path: string;
  title: string;
  navItem?: "home" | "create" | "memories";
  status: RouteStatus;
};

export type DesignScreenMapping = {
  designId: string;
  assetPath: string;
  routeKey: AppRouteKey;
  stateLabel: string;
  nextAction: string;
};

// HTML screens 的顺序固定；query state 保留刷新后的连续界面。
export const screenPaths = [
  "/",
  "/create",
  "/create?state=understanding",
  "/result",
  "/play",
  "/play?state=adjust",
  "/play?state=save",
  "/memories",
  "/memories/demo-graduation",
] as const;

export const prototypeHotspots = [
  { screen: 1, label: "创建音乐相册", box: [26, 50, 49, 9], target: 2 },
  { screen: 1, label: "开始制作", box: [40, 86, 25, 8], target: 2 },
  { screen: 2, label: "添加照片", box: [69, 31, 18, 14], target: 3 },
  { screen: 2, label: "继续上传", box: [7, 86, 16, 7], target: 3 },
  { screen: 3, label: "一键确认，开始生成", box: [57, 90, 38, 8], target: 4 },
  { screen: 4, label: "进入播放", box: [8, 88, 84, 8], target: 5 },
  { screen: 5, label: "调整音乐", box: [8, 89, 40, 8], target: 6 },
  { screen: 5, label: "保存相册", box: [50, 89, 43, 8], target: 7 },
  { screen: 5, label: "返回结果", box: [3, 5, 13, 7], target: 4 },
  { screen: 6, label: "发送调整指令", box: [75, 89, 18, 7], target: 5 },
  { screen: 6, label: "重新播放", box: [35, 61, 30, 15], target: 5 },
  { screen: 7, label: "保存到我的音乐记忆", box: [7, 84, 86, 9], target: 8 },
  { screen: 7, label: "稍后再说", box: [38, 94, 24, 5], target: 5 },
  { screen: 8, label: "查看详情", box: [4, 18, 92, 15], target: 9 },
  { screen: 8, label: "播放毕业相册", box: [4, 18, 28, 15], target: 9 },
  { screen: 9, label: "生成音乐", box: [8, 87, 84, 8], target: 4 },
  { screen: 9, label: "返回列表", box: [3, 4, 13, 8], target: 8 },
] as const;

export type ReadonlyConnectionCheck = {
  connected: boolean;
  checkedAt: string;
  query: "select 1 as connected";
  message: string;
};

export const appRoutes: AppRoute[] = [
  {
    key: "home",
    path: "/",
    title: "音乐相册",
    navItem: "home",
    status: "ready",
  },
  {
    key: "create",
    path: "/create",
    title: "创建音乐相册",
    navItem: "create",
    status: "placeholder",
  },
  { key: "result", path: "/result", title: "生成结果", status: "placeholder" },
  { key: "play", path: "/play", title: "沉浸式播放", status: "placeholder" },
  {
    key: "memories",
    path: "/memories",
    title: "我的音乐记忆",
    navItem: "memories",
    status: "ready",
  },
  {
    key: "memory-detail",
    path: "/memories/demo-graduation",
    title: "音乐相册详情",
    status: "ready",
  },
];

export const designScreenMappings: DesignScreenMapping[] = [
  {
    designId: "01",
    assetPath: "designs/ui/01-首页-音乐相册.png",
    routeKey: "home",
    stateLabel: "首页",
    nextAction: "创建音乐相册",
  },
  {
    designId: "02",
    assetPath: "designs/ui/02-创建音乐相册-上传照片.png",
    routeKey: "create",
    stateLabel: "上传照片初始状态",
    nextAction: "继续上传",
  },
  {
    designId: "03",
    assetPath: "designs/ui/03-创建音乐相册-Agent记忆理解.png",
    routeKey: "create",
    stateLabel: "Agent 记忆理解状态",
    nextAction: "一键确认，开始生成",
  },
  {
    designId: "04",
    assetPath: "designs/ui/04-生成结果-为你生成与QQ音乐推荐.png",
    routeKey: "result",
    stateLabel: "AI 配乐与 QQ 音乐推荐",
    nextAction: "进入播放",
  },
  {
    designId: "05",
    assetPath: "designs/ui/05-沉浸式播放页.png",
    routeKey: "play",
    stateLabel: "首次沉浸式播放",
    nextAction: "调整音乐或保存相册",
  },
  {
    designId: "06",
    assetPath: "designs/ui/06-调整音乐-Agent对话页.png",
    routeKey: "play",
    stateLabel: "调整音乐对话状态",
    nextAction: "重新播放",
  },
  {
    designId: "07",
    assetPath: "designs/ui/07-保存音乐相册页.png",
    routeKey: "play",
    stateLabel: "保存过渡状态",
    nextAction: "保存到我的音乐记忆",
  },
  {
    designId: "08",
    assetPath: "designs/ui/08-我的音乐记忆页.png",
    routeKey: "memories",
    stateLabel: "音乐记忆列表",
    nextAction: "查看相册详情",
  },
  {
    designId: "09",
    assetPath: "designs/ui/09-音乐相册详情页.png",
    routeKey: "memory-detail",
    stateLabel: "音乐相册详情",
    nextAction: "生成音乐（进入结果页）",
  },
];

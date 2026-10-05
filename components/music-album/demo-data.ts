export type DemoTrack = {
  id: string;
  title: string;
  artist: string;
  kind: "ai" | "qq";
  status: "ready" | "placeholder";
  duration: string;
  caption: string;
  image: string;
};
export type DemoMemoryAlbum = {
  id: string;
  title: string;
  coverImage: string;
  photos: string[];
  tracks: DemoTrack[];
  createdAt: string;
  eventDate: string;
  caption: string;
  subtitle: string;
  photoCount: number;
  trackCount: number;
  category: string;
};
export const photo = (name: string) => `/images/memories/${name}.webp`;
export const demoTracks: DemoTrack[] = [
  {
    id: "yesterday",
    title: "再见，昨天",
    artist: "QQ音乐",
    kind: "qq",
    status: "placeholder",
    duration: "3:12",
    caption: "告别不是结束，而是新的开始。",
    image: photo("sunset"),
  },
  {
    id: "you",
    title: "是你",
    artist: "告五人",
    kind: "qq",
    status: "placeholder",
    duration: "3:45",
    caption: "感谢一路上有你，让平凡的日子闪闪发光。",
    image: photo("garden"),
  },
  {
    id: "sunny",
    title: "晴天",
    artist: "周杰伦",
    kind: "qq",
    status: "placeholder",
    duration: "4:29",
    caption: "愿我们在更大的世界里，依然热爱生活。",
    image: photo("travel"),
  },
];
export const demoMemoryAlbums: DemoMemoryAlbum[] = [
  {
    id: "demo-graduation",
    title: "2026 · 毕业那天",
    coverImage: photo("graduation"),
    photos: [photo("graduation"), photo("travel"), photo("cat")],
    tracks: demoTracks,
    createdAt: "2026-06-20",
    eventDate: "2026-06-20",
    caption: "这一段旅程，感谢所有的相遇。",
    subtitle: "青春的最后一页，把时光写成一首歌。",
    photoCount: 12,
    trackCount: 1,
    category: "其他",
  },
  {
    id: "demo-travel",
    title: "厦门旅行",
    coverImage: photo("travel"),
    photos: [photo("travel")],
    tracks: demoTracks,
    createdAt: "2026-05-03",
    eventDate: "2026-05-03",
    caption: "海风与自由",
    subtitle: "海风与自由，还有那段闪闪发光的日子。",
    photoCount: 18,
    trackCount: 3,
    category: "旅行",
  },
  {
    id: "demo-cat",
    title: "团子来到家的第一天",
    coverImage: photo("cat"),
    photos: [photo("cat")],
    tracks: demoTracks,
    createdAt: "2026-04-12",
    eventDate: "2026-04-12",
    caption: "小小的幸福",
    subtitle: "小小的幸福，从此有了新的旋律。",
    photoCount: 9,
    trackCount: 1,
    category: "宠物",
  },
  {
    id: "demo-garden",
    title: "春天的公园",
    coverImage: photo("garden"),
    photos: [photo("garden")],
    tracks: demoTracks,
    createdAt: "2026-03-18",
    eventDate: "2026-03-18",
    caption: "阳光透过树叶，连风都变得温柔。",
    subtitle: "阳光透过树叶，连风都变得温柔。",
    photoCount: 14,
    trackCount: 2,
    category: "生活",
  },
];
export function getDemoMemoryAlbum(id: string) {
  return demoMemoryAlbums.find((album) => album.id === id);
}

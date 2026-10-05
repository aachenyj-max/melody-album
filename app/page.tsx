import {
  ArrowRight,
  Headphones,
  Image as ImageIcon,
  Sparkles,
} from "lucide-react";

const features = [
  {
    icon: ImageIcon,
    title: "收集一刻",
    text: "上传校园照片，让每个瞬间都有清晰的时间线。",
  },
  {
    icon: Headphones,
    title: "配一首歌",
    text: "用熟悉的旋律串起情绪，把回忆变成可播放的章节。",
  },
  {
    icon: Sparkles,
    title: "生成故事",
    text: "AI 帮你写下照片背后的故事，分享给未来的自己。",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f8f7f3] text-[#171717]">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-between px-6 py-8 sm:px-10 lg:px-16">
        <header className="flex items-center justify-between border-b border-[#171717]/10 pb-5">
          <div className="flex items-center gap-3 text-sm font-semibold tracking-[0.16em]">
            <span className="grid size-8 place-items-center rounded-full bg-[#ff5c35] text-white">
              <Sparkles className="size-4" aria-hidden="true" />
            </span>
            音乐相册
          </div>
          <span className="font-mono text-xs text-[#171717]/55">
            MUSIC MEMORY / 001
          </span>
        </header>
        <div className="grid gap-12 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-20">
          <div>
            <p className="mb-6 font-mono text-xs uppercase tracking-[0.28em] text-[#ff5c35]">
              腾讯音乐高校 AI Hackathon
            </p>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[0.98] tracking-[-0.06em] sm:text-7xl lg:text-[6.8rem]">
              让回忆，<span className="text-[#ff5c35]">有声</span>可见。
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-8 text-[#171717]/65 sm:text-xl">
              把照片、歌和那段还没说完的故事放在一起，做成一张只属于你的音乐相册。
            </p>
            <button
              type="button"
              className="mt-10 inline-flex items-center gap-3 rounded-full bg-[#171717] px-6 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
            >
              开始制作
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
          </div>
          <div className="relative mx-auto w-full max-w-md">
            <div className="aspect-[4/5] rotate-3 rounded-[2rem] bg-[#ffd9c9] p-5 shadow-[18px_18px_0_#171717]">
              <div className="flex h-full flex-col justify-between rounded-[1.5rem] border border-[#171717]/15 bg-[#fffaf4] p-6">
                <div className="flex items-center justify-between font-mono text-xs text-[#171717]/55">
                  <span>2026.10.05</span>
                  <span>PLAYLIST 01</span>
                </div>
                <div>
                  <div className="mb-6 grid size-20 place-items-center rounded-full bg-[#ff5c35] text-white shadow-[6px_6px_0_#171717]">
                    <Headphones className="size-9" aria-hidden="true" />
                  </div>
                  <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#171717]/55">
                    A SIDE / 校园回声
                  </p>
                  <p className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
                    那些闪光的日子
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="grid gap-8 border-t border-[#171717]/10 pt-8 sm:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-4">
              <Icon
                className="mt-1 size-5 shrink-0 text-[#ff5c35]"
                aria-hidden="true"
              />
              <div>
                <h2 className="font-semibold">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-[#171717]/55">
                  {text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

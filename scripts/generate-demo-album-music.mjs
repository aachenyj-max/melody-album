import { registerHooks, createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

// Run: node --experimental-transform-types scripts/generate-demo-album-music.mjs
// Node >=22.19; credentials stay in .env.local.
const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only")
      return { url: "data:text/javascript,export{}", shortCircuit: true };
    if (specifier.startsWith("@/"))
      return next(
        pathToFileURL(resolve(`${specifier.slice(2)}.ts`)).href,
        context,
      );
    if (specifier.startsWith(".") && context.parentURL?.includes("/lib/")) {
      const url = new URL(specifier, context.parentURL);
      if (
        !url.pathname.endsWith(".ts") &&
        existsSync(`${fileURLToPath(url)}.ts`)
      )
        return next(`${url.href}.ts`, context);
    }
    return next(specifier, context);
  },
});
if (!process.env.PI_LLM_API_KEY || !process.env.FAL_KEY)
  throw new Error("Live Pi and fal credentials are required.");
const { createAgentConfig } = await import("../lib/agent/config.ts");
const { understandWithPi } = await import("../lib/agent/pi-runtime.ts");
const { toMusicProfile } = await import("../lib/music/profile.ts");
const { validateMusicProfile } = await import("../lib/music/contract.ts");
const { generateMusic } = await import("../lib/music/generator.ts");
const { fetch: proxyFetch, ProxyAgent } = await import("undici");
const sharp = require("sharp");
const outputDir = "public/audio/music-album";
const evidenceDir = "specs/006-save-memory-album/verification/generated-music";
mkdirSync(evidenceDir, { recursive: true });
const themes = [
  {
    id: "demo-graduation",
    title: "青春的回声",
    photos: ["demo-graduation", "graduation"],
    story:
      "毕业那天，在校园夕阳下举起学士帽。回望一起走过的青春，温暖、感激，带着一点告别的不舍和对未来的希望。",
    style: "电影感钢琴与弦乐",
    arrangement:
      "Cinematic coming-of-age instrumental, warm expressive acoustic piano lead, lush legato string ensemble, gentle acoustic guitar, subtle brushed drums. 82 BPM. Memorable lyrical melody with varied phrasing, evolving major seventh harmonies. Intimate piano intro, hopeful full ensemble lift, tender resolved ending. Natural human dynamics, rich professional film-score production, no vocals.",
  },
  {
    id: "demo-travel",
    title: "海风与自由",
    photos: ["demo-coast", "travel"],
    story:
      "厦门旅行，沿着蔚蓝海岸慢慢走，海风吹过，心情自由、轻松而明亮。想保留阳光下度假的快乐。",
    style: "海岸木吉他流行",
    arrangement:
      "Sunny coastal indie folk instrumental, bright fingerpicked acoustic guitar melody, warm electric bass, soft shakers and organic brushed drums, delicate piano answers. 106 BPM. Fresh uplifting melody, syncopated gentle groove, changing chord progression and melodic variations. Breezy intro, joyful melodic chorus, smooth resolved outro. Warm natural acoustic instruments, polished spacious studio mix, no vocals.",
  },
  {
    id: "demo-cat",
    title: "团子的午后",
    photos: ["cat"],
    story:
      "团子来到家的第一天，小猫躺在温暖的被子里，阳光照进房间。小小的幸福，慵懒、亲密、安心，也有一点好奇与俏皮。",
    style: "温柔爵士与木贝斯",
    arrangement:
      "Cozy playful acoustic jazz instrumental, soft felt piano lead with a charming lyrical melody, warm plucked upright bass, quiet brushed drums, delicate nylon-string guitar. 76 BPM gentle swing. Rich jazz seventh chords, little melodic call-and-response phrases, subtle harmonic movement. Tender intro, playful middle, sleepy resolved ending. Intimate natural room sound, expressive human performance, balanced professional mix, no vocals.",
  },
  {
    id: "demo-garden",
    title: "春日微风",
    photos: ["garden"],
    story:
      "春天的公园，阳光透过树叶，微风吹动枝叶，散步时感到宁静、舒展、充满新生的希望。",
    style: "清新原声民谣",
    arrangement:
      "Fresh pastoral chamber folk instrumental, delicate fingerstyle acoustic guitar, airy wooden flute singing a graceful melody, soft piano, warm cello, very light hand percussion. 90 BPM. Flowing melodic phrases, gentle evolving harmonies, organic breathing dynamics. Peaceful garden morning intro, blossoming melodic lift, soft complete ending. Detailed natural acoustic timbres, warm spacious professional recording, no vocals.",
  },
];
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function run(theme) {
  const evidencePath = `${evidenceDir}/${theme.id}.json`;
  const audioPath = `${outputDir}/${theme.id}-ace-step.mp3`;
  if (existsSync(evidencePath) && existsSync(audioPath)) {
    const saved = JSON.parse(readFileSync(evidencePath, "utf8"));
    if (saved.audio.sha256 === hash(readFileSync(audioPath))) {
      console.log(`${theme.id}: verified existing live asset`);
      return;
    }
  }
  const started = Date.now();
  const config = createAgentConfig("live", "live");
  const signal = AbortSignal.timeout(config.runTimeoutMs);
  const photos = await Promise.all(
    theme.photos.map((name) =>
      sharp(`public/images/memories/${name}.webp`)
        .resize({ width: 768, withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer(),
    ),
  );
  console.log(`${theme.id}: Pi/Qwen understanding ${photos.length} photos`);
  mkdirSync(".sdd00-work", { recursive: true });
  const memory = await understandWithPi(
    config,
    { story: theme.story, photos },
    signal,
    async (result) => {
      writeFileSync(
        `.sdd00-work/${theme.id}-live-memory.json`,
        JSON.stringify(result, null, 2),
      );
    },
    async (calls, events) => {
      writeFileSync(
        `.sdd00-work/${theme.id}-live-trace.json`,
        JSON.stringify({ calls, events }, null, 2),
      );
    },
  );
  if (memory.profile.source !== "agent")
    throw new Error(`${theme.id}: live memory required`);
  const base = toMusicProfile(memory.profile);
  const profile = validateMusicProfile({
    ...base,
    style: theme.style,
    instrumentalPrompt:
      `无歌词、无人声。 ${theme.arrangement} Mood: ${base.mood.slice(0, 100)}`.slice(
        0,
        600,
      ),
    targetDurationSec: 30,
  });
  if (!profile) throw new Error(`${theme.id}: invalid music profile`);
  console.log(`${theme.id}: ACE-Step live music generation`);
  const result = await generateMusic(profile, { mode: "live", signal });
  if (!result.ok || result.source !== "api")
    throw new Error(
      `${theme.id}: ${result.ok ? "live audio required" : result.error.code}`,
    );
  const url = new URL(result.track.audioUrl);
  if (
    url.protocol !== "https:" ||
    !(url.hostname === "fal.media" || url.hostname.endsWith(".fal.media"))
  )
    throw new Error("Unexpected generated audio host");
  const proxy = process.env.FAL_PROXY_URL
    ? new ProxyAgent(process.env.FAL_PROXY_URL)
    : null;
  let bytes;
  try {
    const response = proxy
      ? await proxyFetch(url, { dispatcher: proxy, signal })
      : await fetch(url, { signal });
    if (!response.ok)
      throw new Error(`Audio download failed: ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
  } finally {
    await proxy?.close();
  }
  const rawPath = `.sdd00-work/${theme.id}-ace-step-source.wav`;
  mkdirSync(".sdd00-work", { recursive: true });
  writeFileSync(rawPath, bytes);
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-v",
      "error",
      "-i",
      rawPath,
      "-codec:a",
      "libmp3lame",
      "-b:a",
      "192k",
      audioPath,
    ],
    { windowsHide: true },
  );
  const metadata = JSON.parse(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration:stream=sample_rate,channels,codec_name",
        "-of",
        "json",
        audioPath,
      ],
      { encoding: "utf8", windowsHide: true },
    ),
  );
  const durationSec = Number(metadata.format.duration);
  if (!Number.isFinite(durationSec) || durationSec < 25 || durationSec > 32)
    throw new Error(`${theme.id}: invalid actual duration`);
  const evidence = {
    albumId: theme.id,
    title: theme.title,
    generatedAt: new Date().toISOString(),
    elapsedMs: Date.now() - started,
    story: theme.story,
    inputs: theme.photos.map((name, index) => ({
      path: `public/images/memories/${name}.webp`,
      agentInputSha256: hash(photos[index]),
    })),
    model: config.memoryModel.modelDescriptor.id,
    memorySource: "agent",
    memory: memory.profile,
    toolCalls: memory.calls.map((call) => ({
      name: call.name,
      version: call.version,
      status: call.status,
    })),
    events: memory.events,
    musicProfile: profile,
    arrangementRefinement:
      "Theme-specific editorial arrangement added to the deterministic music profile after real photo understanding.",
    musicSource: "api",
    musicModel: config.music.modelId,
    audio: {
      path: audioPath,
      durationSec,
      sha256: hash(readFileSync(audioPath)),
      originalSha256: hash(bytes),
      bytes: readFileSync(audioPath).length,
      metadata,
    },
  };
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`${theme.id}: saved real music ${durationSec.toFixed(2)}s`);
}

// Respect the existing concurrency cap of two runs.
const failures = [];
for (let index = 0; index < themes.length; index += 2) {
  const results = await Promise.allSettled(
    themes.slice(index, index + 2).map(run),
  );
  results.forEach((result, offset) => {
    if (result.status === "rejected") {
      failures.push(themes[index + offset].id);
      console.error(
        `${themes[index + offset].id}: failed (${result.reason?.code ?? result.reason?.message ?? "unknown"})`,
      );
    }
  });
}
if (failures.length)
  throw new Error(`Incomplete live albums: ${failures.join(", ")}`);
const tracks = Object.fromEntries(
  themes.map((theme) => {
    const evidence = JSON.parse(
      readFileSync(`${evidenceDir}/${theme.id}.json`, "utf8"),
    );
    return [
      theme.id,
      {
        title: theme.title,
        style: theme.style,
        audioUrl: `/${evidence.audio.path.replace(/^public\//, "")}`,
        durationSec: evidence.audio.durationSec,
      },
    ];
  }),
);
writeFileSync(
  "components/music-album/generated-demo-music.json",
  `${JSON.stringify(tracks, null, 2)}\n`,
);
console.log(
  "All four real Agent → ACE-Step tracks completed; client manifest saved.",
);

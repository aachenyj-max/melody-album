import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { fetch, ProxyAgent } from "undici";

// Offline asset generation only; never run during a user's waiting period.
createRequire(import.meta.url)("@next/env").loadEnvConfig(process.cwd());
if (!process.env.FAL_KEY) throw new Error("FAL_KEY is required");
const model = "fal-ai/ace-step/prompt-to-audio";
const prompt =
  "Instrumental only, no vocals, no lyrics. Gentle expressive felt piano melody with soft warm legato strings, 72 BPM, peaceful and reassuring, intimate acoustic recording. Natural varied melodic phrases, warm major seventh harmonies, delicate human dynamics. A complete flowing miniature with a quiet introduction, tender evolving middle and softly resolved ending. No beeps, no synth pulses, no drums, no dramatic build. Background music for patiently revisiting happy memories.";
const proxy = process.env.FAL_PROXY_URL
  ? new ProxyAgent(process.env.FAL_PROXY_URL)
  : undefined;
const signal = AbortSignal.timeout(300_000);
async function request(url, body, authenticated = true) {
  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: authenticated
      ? {
          Authorization: `Key ${process.env.FAL_KEY}`,
          "Content-Type": "application/json",
        }
      : {},
    body: body ? JSON.stringify(body) : undefined,
    dispatcher: proxy,
    signal: AbortSignal.any([
      signal,
      AbortSignal.timeout(authenticated ? 30_000 : 120_000),
    ]),
  });
  if (!response.ok)
    throw new Error(`Music request failed (${response.status})`);
  return response;
}
async function readRequest(url, binary = false) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await request(url, null, !binary);
      return binary
        ? Buffer.from(await response.arrayBuffer())
        : await response.json();
    } catch (error) {
      signal.throwIfAborted();
      if (attempt === 3) throw error;
      console.log(
        `Retrying music ${binary ? "audio download" : "queue response"} (${error.name})`,
      );
      await delay(2_000, undefined, { signal });
    }
  }
}
function checkedUrl(value, queue) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    (queue
      ? url.hostname !== "queue.fal.run"
      : !(url.hostname === "fal.media" || url.hostname.endsWith(".fal.media")))
  )
    throw new Error("Unexpected music host");
  return url.href;
}
try {
  mkdirSync(".sdd00-work", { recursive: true });
  const queueCache = ".sdd00-work/waiting-piano-queue.json";
  const queued = existsSync(queueCache)
    ? JSON.parse(readFileSync(queueCache, "utf8"))
    : await (
        await request(`https://queue.fal.run/${model}`, {
          prompt,
          instrumental: true,
          duration: 75,
        })
      ).json();
  writeFileSync(queueCache, JSON.stringify(queued));
  const statusUrl = checkedUrl(queued.status_url, true);
  const resultUrl = checkedUrl(queued.response_url, true);
  let lastStatus;
  while (true) {
    const state = await readRequest(statusUrl);
    if (state.status !== lastStatus)
      console.log(`Waiting music: ${state.status}`);
    lastStatus = state.status;
    if (state.status === "COMPLETED") break;
    if (state.status === "FAILED") throw new Error("Music generation failed");
    await delay(2_000, undefined, { signal });
  }
  console.log("Fetching completed music result");
  const result = await readRequest(resultUrl);
  console.log("Downloading generated audio");
  const source = await readRequest(checkedUrl(result.audio.url, false), true);
  mkdirSync(".sdd00-work", { recursive: true });
  const raw = ".sdd00-work/waiting-piano-source.wav";
  const output = "public/audio/music-album/waiting-piano.mp3";
  writeFileSync(raw, source);
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-v",
      "error",
      "-i",
      raw,
      "-af",
      "afade=t=in:d=0.4,afade=t=out:st=73.5:d=1.4",
      "-codec:a",
      "libmp3lame",
      "-b:a",
      "192k",
      output,
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
        "format=duration:stream=codec_name,sample_rate,channels",
        "-of",
        "json",
        output,
      ],
      { encoding: "utf8", windowsHide: true },
    ),
  );
  const durationSec = Number(metadata.format.duration);
  if (durationSec < 60 || durationSec > 90)
    throw new Error("Unexpected waiting music duration");
  const directory = "specs/005-immersive-playback/verification";
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    `${directory}/waiting-music.json`,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        model,
        source: "api",
        prompt,
        requestedDurationSec: 75,
        seed: result.seed,
        audio: {
          path: output,
          durationSec,
          metadata,
          sha256: createHash("sha256")
            .update(readFileSync(output))
            .digest("hex"),
        },
      },
      null,
      2,
    )}\n`,
  );
  console.log(`Saved waiting music: ${durationSec.toFixed(2)}s`);
} finally {
  await proxy?.close();
}

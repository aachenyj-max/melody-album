import {
  musicError,
  validateMusicProfile,
  type AiTrack,
  type MusicErrorCode,
  type MusicProfile,
} from "./contract";
import { fetch as proxyFetch, ProxyAgent } from "undici";
import { setTimeout as delay } from "node:timers/promises";

export type GenerationResult =
  | { ok: true; source: "api" | "demo"; track: AiTrack }
  | { ok: false; error: ReturnType<typeof musicError> };

const MODEL = "fal-ai/ace-step/prompt-to-audio";
const QUEUE_URL = `https://queue.fal.run/${MODEL}`;
const RESULT_DEADLINE_MS = 300_000;
let proxyAgent: ProxyAgent | null = null;

type FalAudio = { url?: unknown; content_type?: unknown };
type FalQueueResponse = {
  request_id?: unknown;
  status_url?: unknown;
  response_url?: unknown;
  status?: unknown;
  audio?: FalAudio;
  data?: { audio?: FalAudio };
};

function queueUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "queue.fal.run"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

async function falFetch(url: string, key: string, init: RequestInit = {}) {
  const options = {
    ...init,
    headers: {
      Authorization: `Key ${key}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
    signal: init.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(20_000)])
      : AbortSignal.timeout(20_000),
  } satisfies RequestInit;
  const proxyUrl = process.env.FAL_PROXY_URL?.trim();
  if (proxyUrl) {
    proxyAgent ??= new ProxyAgent(proxyUrl);
    try {
      return await proxyFetch(url, {
        method: options.method,
        body: typeof options.body === "string" ? options.body : undefined,
        headers: options.headers,
        signal: options.signal ?? undefined,
        dispatcher: proxyAgent,
      });
    } catch (error) {
      proxyAgent.destroy();
      proxyAgent = null;
      throw error;
    }
  }
  return fetch(url, options);
}

function responseError(status: number): MusicErrorCode {
  if (status === 408 || status === 504) return "GENERATION_TIMEOUT";
  if (status === 401 || status === 403 || status === 429)
    return "GENERATION_UNAVAILABLE";
  return "PROVIDER_ERROR";
}

async function queueGet(
  url: string,
  key: string,
  deadline: number,
  signal?: AbortSignal,
) {
  while (Date.now() < deadline) {
    signal?.throwIfAborted();
    try {
      const response = await falFetch(url, key, { signal });
      if (response.ok) return response;
      if (response.status < 500 && response.status !== 429) {
        throw new Error(`fal queue request ${response.status}`);
      }
    } catch (error) {
      signal?.throwIfAborted();
      if (
        error instanceof Error &&
        error.message.startsWith("fal queue request")
      )
        throw error;
      console.warn("fal music queue connection retry", {
        name: error instanceof Error ? error.name : "unknown",
      });
    }
    await delay(2_000, undefined, { signal });
  }
  throw new DOMException("fal queue timed out", "TimeoutError");
}

async function completedResponse(
  initial: FalQueueResponse,
  key: string,
  signal?: AbortSignal,
): Promise<FalQueueResponse> {
  if (!initial.request_id) return initial;
  const statusUrl = queueUrl(initial.status_url);
  const resultUrl = queueUrl(initial.response_url);
  if (!statusUrl || !resultUrl) throw new Error("Invalid fal queue URLs");
  console.info("fal music queued", { requestId: String(initial.request_id) });

  const deadline = Date.now() + RESULT_DEADLINE_MS;
  let lastStatus: unknown;
  while (Date.now() < deadline) {
    signal?.throwIfAborted();
    const response = await queueGet(statusUrl, key, deadline, signal);
    const state = (await response.json()) as FalQueueResponse;
    if (state.status !== lastStatus) {
      console.info("fal music status", { status: state.status ?? "unknown" });
      lastStatus = state.status;
    }
    if (state.status === "FAILED") throw new Error("fal queue failed");
    if (state.status === "COMPLETED") {
      const result = await queueGet(resultUrl, key, deadline, signal);
      return (await result.json()) as FalQueueResponse;
    }
    await delay(2_000, undefined, { signal });
  }
  throw new DOMException("fal queue timed out", "TimeoutError");
}

function playableAudio(raw: FalQueueResponse): FalAudio | null {
  const audio = raw.audio ?? raw.data?.audio;
  if (!audio || typeof audio.url !== "string") return null;
  try {
    const url = new URL(audio.url);
    if (url.protocol !== "https:") return null;
  } catch {
    return null;
  }
  return audio;
}

export async function generateMusic(
  profile: MusicProfile,
  options: { mode?: "auto" | "demo" | "live"; signal?: AbortSignal } = {},
): Promise<GenerationResult> {
  const validated = validateMusicProfile(profile);
  if (!validated) return { ok: false, error: musicError("INVALID_PROFILE") };

  const key = process.env.FAL_KEY?.trim();
  options.signal?.throwIfAborted();
  if (options.mode === "live" && !key)
    return { ok: false, error: musicError("GENERATION_UNAVAILABLE") };
  if (options.mode === "demo" || (!key && options.mode !== "live")) {
    const scenario =
      process.env.NODE_ENV === "development"
        ? process.env.FAL_DEMO_SCENARIO
        : undefined;
    await delay(scenario === "slow" ? 45_000 : 650, undefined, {
      signal: options.signal,
    });
    if (scenario === "error")
      return { ok: false, error: musicError("PROVIDER_ERROR") };
    return {
      ok: true,
      source: "demo",
      track: {
        title: "青春的回声（演示配乐）",
        durationSec: 20,
        audioUrl: "/audio/music-album/demo-ai.wav",
        audioMimeType: "audio/wav",
        source: "demo",
        expiresAt: null,
      },
    };
  }

  try {
    const submitted = await falFetch(QUEUE_URL, key as string, {
      method: "POST",
      signal: options.signal,
      body: JSON.stringify({
        prompt: validated.instrumentalPrompt,
        instrumental: true,
        duration: validated.targetDurationSec,
      }),
    });
    if (!submitted.ok) {
      console.error("fal music submit failed", { status: submitted.status });
      return { ok: false, error: musicError(responseError(submitted.status)) };
    }

    const result = await completedResponse(
      (await submitted.json()) as FalQueueResponse,
      key as string,
      options.signal,
    );
    const audio = playableAudio(result);
    if (!audio) {
      return { ok: false, error: musicError("INVALID_GENERATED_AUDIO") };
    }
    return {
      ok: true,
      source: "api",
      track: {
        title: "ACE-Step · 无歌词配乐",
        durationSec: validated.targetDurationSec,
        audioUrl: audio.url as string,
        audioMimeType:
          typeof audio.content_type === "string"
            ? audio.content_type
            : "audio/wav",
        source: "api",
        expiresAt: null,
      },
    };
  } catch (error) {
    options.signal?.throwIfAborted();
    // Do not log prompts, credentials, provider bodies, or generated URLs.
    console.error("fal music transport failed", {
      name: error instanceof Error ? error.name : "unknown",
      code:
        error instanceof Error && "code" in error
          ? String(error.code)
          : error instanceof Error &&
              error.cause &&
              typeof error.cause === "object" &&
              "code" in error.cause
            ? String(error.cause.code)
            : "unknown",
    });
    return {
      ok: false,
      error: musicError(
        error instanceof DOMException && error.name === "TimeoutError"
          ? "GENERATION_TIMEOUT"
          : "GENERATION_UNAVAILABLE",
      ),
    };
  }
}

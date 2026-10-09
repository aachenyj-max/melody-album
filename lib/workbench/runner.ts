import "server-only";
import { randomUUID } from "node:crypto";
import { understandWithPi } from "@/lib/agent/pi-runtime";
import { validateMusicProfile } from "@/lib/music/contract";
import { generateMusic } from "@/lib/music/generator";
import { getMockRecommendations } from "@/lib/music/mock-recommendations";
import { toMusicProfile } from "@/lib/music/profile";
import { requireHuman } from "./auth";
import { assertExecutable } from "./config";
import { approvedInitialProposal } from "./dialogue";
import {
  errorData,
  jsonValue,
  WorkbenchError,
  type Json,
  type Source,
  type Stage,
  type ToolCall,
} from "./contract";
import {
  claimRun,
  finishRun,
  getRun,
  loadInputs,
  writeStep,
} from "./repository";

export async function executeRun(id: string, requestSignal: AbortSignal) {
  await requireHuman();
  const initial = await getRun(id);
  if (!["uploading", "queued", "running"].includes(initial.status))
    return initial;
  if (initial.inputSnapshot.chatMode && !(await approvedInitialProposal(id)))
    throw new WorkbenchError(
      "INTENT_NOT_CONFIRMED",
      "请先在对话中确认音乐意图。",
      409,
    );
  assertExecutable(initial.configSnapshot, initial.configDigest);
  const claim = await claimRun(id);
  if (claim.terminal) return getRun(id);
  if (!claim.token)
    throw new WorkbenchError("DATA_UNAVAILABLE", "执行领取未完成。", 503);
  const token = claim.token;
  const timeout = AbortSignal.timeout(initial.configSnapshot.runTimeoutMs);
  const signal = AbortSignal.any([requestSignal, timeout]);
  let activeStage: Stage = "memory";
  const summary: Record<string, Json> = {
    kind: "internal_test",
    memorySource:
      initial.configSnapshot.memoryModel.mode === "demo" ? "demo" : "agent",
    musicSource: initial.configSnapshot.music.mode === "demo" ? "demo" : "api",
    recommendationSource: "mock",
  };
  async function begin(stage: Stage, source: Source) {
    signal.throwIfAborted();
    await writeStep(id, token, stage, { status: "running", source });
  }
  try {
    signal.throwIfAborted();
    const inputs = await loadInputs(id);
    await begin(
      "memory",
      initial.configSnapshot.memoryModel.mode === "demo" ? "demo" : "agent",
    );
    let memorySnapshot: Json = null;
    const approved = await approvedInitialProposal(id).catch((error) => {
      if (error instanceof WorkbenchError && error.code === "NOT_FOUND")
        return null;
      throw error;
    });
    const memory = approved
      ? { profile: approved.memory, calls: [], events: [] }
      : await understandWithPi(
          initial.configSnapshot,
          inputs,
          signal,
          async (value) => {
            memorySnapshot = jsonValue(value.profile);
            await writeStep(id, token, "memory", {
              status: "running",
              source: value.profile.source,
              result: jsonValue(value.profile),
              calls: value.calls,
              events: value.events,
            });
          },
          async (calls, events) => {
            await writeStep(id, token, "memory", {
              status: "running",
              source:
                initial.configSnapshot.memoryModel.mode === "demo"
                  ? "demo"
                  : "agent",
              result: memorySnapshot,
              calls,
              events,
            });
          },
        );
    await writeStep(id, token, "memory", {
      status: "succeeded",
      source: memory.profile.source,
      result: jsonValue(memory.profile),
      calls: memory.calls,
      events: memory.events,
    });
    summary.memory = "succeeded";
    activeStage = "music_profile";
    await begin("music_profile", "deterministic");
    const started = Date.now();
    const profile = validateMusicProfile(
      approved?.music ?? toMusicProfile(memory.profile),
    );
    if (!profile)
      throw new WorkbenchError(
        "INVALID_MEMORY_RESULT",
        "记忆理解未能转换为有效音乐意图。",
        200,
        "music_profile",
      );
    await writeStep(id, token, "music_profile", {
      status: "succeeded",
      source: "deterministic",
      result: jsonValue(profile),
      calls: [
        {
          name: "to_music_profile",
          version: "1",
          id: randomUUID(),
          status: "succeeded",
          durationMs: Date.now() - started,
          input: jsonValue(memory.profile),
          output: jsonValue(profile),
        },
      ],
    });
    summary.musicProfile = "succeeded";
    activeStage = "ai_music";
    const branches = await Promise.allSettled([
      branch(
        "ai_music",
        initial.configSnapshot.music.mode === "demo" ? "demo" : "api",
        "generate_music",
        "ace-step-1",
        async () => {
          const result = await generateMusic(profile, {
            mode: initial.configSnapshot.music.mode,
            signal,
          });
          if (!result.ok)
            throw new WorkbenchError(
              "MUSIC_UNAVAILABLE",
              result.error.message,
              200,
              "ai_music",
              true,
            );
          return jsonValue({
            ...result,
            availability: result.track.audioUrl
              ? result.source === "demo"
                ? "available"
                : "unverified"
              : "metadata_only",
          });
        },
      ),
      branch(
        "qq_recommendations",
        "mock",
        "qq_recommendations",
        "mock-1",
        async () => {
          const tracks = getMockRecommendations(profile);
          if (!tracks.length)
            throw new WorkbenchError(
              "RECOMMENDATION_UNAVAILABLE",
              "没有匹配的 mock 推荐。",
              200,
              "qq_recommendations",
              true,
            );
          return jsonValue({
            source: "mock",
            tracks: tracks.map((track) => ({
              ...track,
              availability: track.audioUrl ? "available" : "metadata_only",
            })),
          });
        },
      ),
    ]);
    signal.throwIfAborted();
    const rejected = branches.find((item) => item.status === "rejected");
    if (rejected?.status === "rejected") throw rejected.reason;
    const successCount = branches.filter(
      (item) => item.status === "fulfilled" && item.value,
    ).length;
    const status =
      successCount === 2
        ? "succeeded"
        : successCount === 1
          ? "partial"
          : "failed";
    summary.status = status;
    await finishRun(id, token, status, summary);
    return await getRun(id);

    async function branch(
      stage: "ai_music" | "qq_recommendations",
      source: Source,
      name: string,
      version: string,
      action: () => Promise<Json>,
    ) {
      const started = Date.now();
      await begin(stage, source);
      const call: ToolCall = {
        name,
        version,
        id: randomUUID(),
        status: "succeeded",
        durationMs: 0,
        input: jsonValue(profile),
        output: null,
      };
      try {
        const result = await action();
        signal.throwIfAborted();
        call.durationMs = Date.now() - started;
        call.output = result;
        await writeStep(id, token, stage, {
          status: "succeeded",
          source,
          result,
          calls: [call],
        });
        summary[stage] = "succeeded";
        return true;
      } catch (error) {
        if (signal.aborted) throw error;
        const detail = errorData(error, stage);
        call.status = "failed";
        call.durationMs = Date.now() - started;
        call.output = jsonValue(detail);
        await writeStep(id, token, stage, {
          status: "failed",
          source,
          error: detail,
          calls: [call],
        });
        summary[stage] = "failed";
        return false;
      }
    }
  } catch (error) {
    const interrupted = signal.aborted;
    const detail = interrupted
      ? errorData(
          new WorkbenchError(
            timeout.aborted ? "RUN_TIMEOUT" : "RUN_INTERRUPTED",
            timeout.aborted
              ? "运行超过 210 秒，未完成阶段已中断。"
              : "执行请求已中断，请手动重跑。",
            200,
            activeStage,
            true,
          ),
        )
      : errorData(error, activeStage);
    const status = interrupted ? "interrupted" : "failed";
    summary.status = status;
    try {
      if (!interrupted) {
        const current = await getRun(id);
        const step = current.steps.find((s) => s.stage === activeStage);
        if (step && ["pending", "running"].includes(step.status))
          await writeStep(id, token, activeStage, {
            status: "failed",
            source: step.source,
            result: step.result,
            calls: step.calls,
            events: step.events,
            error: detail,
          });
      }
      await finishRun(id, token, status, summary, detail);
    } catch {
      throw new WorkbenchError(
        "DATA_UNAVAILABLE",
        "最终状态暂未保存，维护程序会按租约回收。",
        503,
        activeStage,
        true,
      );
    }
    return getRun(id);
  }
}

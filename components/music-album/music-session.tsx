"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type AdjustmentRun,
  type AiBranch,
  type AiTrack,
  isConfirmedMusicInput,
  type MockRecommendation,
  type MusicRun,
  musicError,
  normalizeAdjustmentInstruction,
  type PlayableAudio,
} from "@/lib/music/contract";
import { getMockRecommendations } from "@/lib/music/mock-recommendations";
import { toMusicProfile } from "@/lib/music/profile";
import type { ConfirmedMemory } from "./creation-session";

export type AudioKind = "none" | "ambient" | "ai" | "qq";
export type AudioState =
  | "idle"
  | "starting"
  | "playing"
  | "paused"
  | "ended"
  | "blocked"
  | "failed";

type MusicSession = {
  run: MusicRun | null;
  audioKind: AudioKind;
  audioState: AudioState;
  activeTrack: PlayableAudio | MockRecommendation | null;
  currentTime: number;
  duration: number | null;
  adjustments: AdjustmentRun[];
  confirmed: ConfirmedMemory | null;
  start: (confirmed: ConfirmedMemory) => void;
  selectRecommendation: (trackId: string) => void;
  selectAi: () => void;
  retryAi: () => void;
  retryRecommendations: () => void;
  play: () => Promise<void>;
  pause: () => void;
  seek: (time: number) => void;
  replay: () => Promise<void>;
  adjust: (instruction: string) => Promise<void>;
  cancelAdjustment: () => void;
  stop: () => void;
};

export type ResultViewModel = MusicSession;

const Context = createContext<MusicSession | null>(null);
const ambientTrack: PlayableAudio = {
  title: "等待时的钢琴与弦乐",
  durationSec: 75,
  audioUrl: "/audio/music-album/waiting-piano.mp3",
  audioMimeType: "audio/mpeg",
  source: "ambient",
};
const AMBIENT_VOLUME = 0.35;

async function fadeVolume(
  audio: HTMLAudioElement,
  target: number,
  isCurrent: () => boolean,
) {
  const initial = audio.volume;
  const started = performance.now();
  while (isCurrent()) {
    const progress = Math.min((performance.now() - started) / 600, 1);
    audio.volume = initial + (target - initial) * progress;
    if (progress === 1) return true;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  return false;
}

function id(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function pendingAi(attemptId: string): AiBranch {
  return {
    status: "pending",
    attemptId,
    source: null,
    progressPercent: null,
    track: null,
    error: null,
  };
}

function probeAudio(
  url: string,
  requireDuration: boolean,
): Promise<number | null> {
  return new Promise((resolve) => {
    const audio = new Audio();
    let finished = false;
    const finish = (value: number | null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      audio.removeAttribute("src");
      audio.load();
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), 10_000);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const duration = audio.duration;
      finish(
        Number.isFinite(duration) && duration >= (requireDuration ? 15 : 0.1)
          ? duration
          : null,
      );
    };
    audio.onerror = () => finish(null);
    audio.src = url;
    audio.load();
  });
}

export function MusicSessionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [run, setRun] = useState<MusicRun | null>(null);
  const [audioKind, setAudioKind] = useState<AudioKind>("none");
  const [audioState, setAudioState] = useState<AudioState>("idle");
  const [activeTrack, setActiveTrack] = useState<
    PlayableAudio | MockRecommendation | null
  >(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);
  const [adjustments, setAdjustments] = useState<AdjustmentRun[]>([]);
  const [confirmed, setConfirmed] = useState<ConfirmedMemory | null>(null);
  const runRef = useRef<MusicRun | null>(null);
  const confirmedRef = useRef<ConfirmedMemory | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeIdentityRef = useRef<string | null>(null);
  const audioSerialRef = useRef(0);
  const transitionSerialRef = useRef(0);
  const epochRef = useRef(0);
  const adjustmentRef = useRef<AbortController | null>(null);
  const adjustmentIdRef = useRef<string | null>(null);
  const userPausedRef = useRef(false);
  const previousPathRef = useRef(pathname);

  const commit = useCallback((next: MusicRun | null) => {
    runRef.current = next;
    setRun(next);
  }, []);

  const stop = useCallback(() => {
    transitionSerialRef.current += 1;
    audioSerialRef.current += 1;
    const current = audioRef.current;
    if (current) {
      current.pause();
      current.removeAttribute("src");
      current.load();
      audioRef.current = null;
    }
    setAudioKind("none");
    activeIdentityRef.current = null;
    setAudioState("idle");
    setActiveTrack(null);
    setCurrentTime(0);
    setDuration(null);
  }, []);

  const switchTrack = useCallback(
    async (
      kind: AudioKind,
      track: PlayableAudio | MockRecommendation,
      smooth = false,
    ) => {
      const url = track.audioUrl;
      if (!url) return;
      const current = audioRef.current;
      const identity = `${kind}:${url}:${track.title}`;
      if (current && activeIdentityRef.current === identity) return;
      const transition = ++transitionSerialRef.current;
      const shouldFade = smooth && current && !current.paused;
      if (shouldFade) {
        const completed = await fadeVolume(
          current,
          0,
          () =>
            transition === transitionSerialRef.current &&
            !userPausedRef.current,
        );
        if (!completed) return;
      }
      if (smooth && userPausedRef.current) return;
      stop();
      const serial = audioSerialRef.current;
      const fadeSerial = transitionSerialRef.current;
      const audio = new Audio(url);
      audio.preload = "auto";
      const volume = kind === "ambient" ? AMBIENT_VOLUME : 1;
      audio.volume = shouldFade ? 0 : volume;
      if (kind === "ambient") audio.loop = true;
      audioRef.current = audio;
      activeIdentityRef.current = identity;
      setAudioKind(kind);
      setActiveTrack(track);
      setCurrentTime(0);
      setDuration(null);
      audio.onloadedmetadata = () => {
        if (serial !== audioSerialRef.current) return;
        const actual = audio.duration;
        setDuration(
          Number.isFinite(actual) && actual > 0
            ? Math.min(actual, track.durationSec)
            : null,
        );
      };
      audio.onplay = () => {
        if (serial === audioSerialRef.current) setAudioState("playing");
      };
      audio.onpause = () => {
        if (serial === audioSerialRef.current && !audio.ended)
          setAudioState(
            audio.currentTime >= track.durationSec - 0.1 ? "ended" : "paused",
          );
      };
      audio.onended = () => {
        if (serial === audioSerialRef.current) setAudioState("ended");
      };
      audio.ontimeupdate = () => {
        if (serial === audioSerialRef.current)
          setCurrentTime(Math.min(audio.currentTime, track.durationSec));
        if (
          kind === "ai" &&
          serial === audioSerialRef.current &&
          audio.currentTime >= track.durationSec
        ) {
          audio.pause();
          setAudioState("ended");
        }
      };
      audio.onerror = () => {
        if (serial === audioSerialRef.current) setAudioState("failed");
      };
      try {
        setAudioState("starting");
        await audio.play();
        if (serial !== audioSerialRef.current) return;
        if (userPausedRef.current) {
          audio.pause();
          audio.volume = volume;
          setAudioState("paused");
          return;
        }
        setAudioState("playing");
        if (shouldFade)
          await fadeVolume(
            audio,
            volume,
            () =>
              serial === audioSerialRef.current &&
              fadeSerial === transitionSerialRef.current &&
              !userPausedRef.current,
          );
      } catch {
        if (serial === audioSerialRef.current) {
          audio.volume = volume;
          setAudioState(userPausedRef.current ? "paused" : "blocked");
        }
      }
    },
    [stop],
  );

  const requestAi = useCallback(
    (runId: string, attemptId: string) => {
      const current = runRef.current;
      if (!current || current.runId !== runId) return;
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      void (async () => {
        try {
          const response = await fetch("/api/music/generate", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              contractVersion: 1,
              requestId: attemptId,
              profile: current.profile,
              ...(confirmedRef.current?.snapshotId
                ? {
                    snapshotId: confirmedRef.current.snapshotId,
                    draftId: confirmedRef.current.draftId,
                  }
                : {}),
            }),
            cache: "no-store",
            signal: controller.signal,
          });
          const body = await response.json();
          const latest = runRef.current;
          if (
            latest?.runId !== runId ||
            latest.ai.attemptId !== attemptId ||
            controller.signal.aborted
          )
            return;
          if (!response.ok || !body.track) {
            if (latest.selection.kind === "ai") stop();
            commit({
              ...latest,
              ai: {
                ...latest.ai,
                status: "failed",
                source: null,
                track: null,
                error: body.error ?? musicError("UNKNOWN"),
              },
            });
            return;
          }
          const track = body.track as AiTrack;
          const duration = await probeAudio(track.audioUrl, true);
          const afterProbe = runRef.current;
          if (
            afterProbe?.runId !== runId ||
            afterProbe.ai.attemptId !== attemptId ||
            controller.signal.aborted
          )
            return;
          if (!duration) {
            if (afterProbe.selection.kind === "ai") stop();
            commit({
              ...afterProbe,
              ai: {
                ...afterProbe.ai,
                status: "failed",
                source: null,
                track: null,
                error: musicError("INVALID_GENERATED_AUDIO"),
              },
            });
            return;
          }
          // Keep playback within the requested duration if metadata is longer.
          const readyTrack: AiTrack = {
            ...track,
            durationSec: Math.min(
              afterProbe.profile.targetDurationSec,
              duration,
            ),
            source: body.source === "api" ? "api" : "demo",
          };
          commit({
            ...afterProbe,
            ai: {
              status: "ready",
              attemptId,
              source: readyTrack.source,
              progressPercent: 100,
              track: readyTrack,
              error: null,
            },
            currentVersionId:
              afterProbe.selection.kind === "ai"
                ? attemptId
                : afterProbe.currentVersionId,
          });
          if (afterProbe.selection.kind === "ai" && !userPausedRef.current)
            void switchTrack("ai", readyTrack, true);
        } catch {
          const latest = runRef.current;
          if (
            !controller.signal.aborted &&
            latest?.runId === runId &&
            latest.ai.attemptId === attemptId
          ) {
            if (latest.selection.kind === "ai") stop();
            commit({
              ...latest,
              ai: {
                ...latest.ai,
                status: "failed",
                source: null,
                track: null,
                error: musicError("GENERATION_UNAVAILABLE"),
              },
            });
          }
        }
      })();
    },
    [commit, stop, switchTrack],
  );

  const requestRecommendations = useCallback(
    (runId: string, attemptId: string) => {
      const current = runRef.current;
      if (!current || current.runId !== runId) return;
      void (async () => {
        try {
          const scenario =
            process.env.NODE_ENV === "development"
              ? sessionStorage.getItem("sdd03:recommendations")
              : null;
          if (scenario === "failed")
            throw new Error("Demo recommendation failure");
          const candidates =
            scenario === "empty" ? [] : getMockRecommendations(current.profile);
          const tracks = await Promise.all(
            candidates.map(async (track) => ({
              ...track,
              audioUrl: scenario === "metadata" ? null : track.audioUrl,
              playable:
                scenario !== "metadata" && track.audioUrl !== null
                  ? (await probeAudio(track.audioUrl, false)) !== null
                  : false,
            })),
          );
          const latest = runRef.current;
          if (
            latest?.runId !== runId ||
            latest.recommendations.attemptId !== attemptId
          )
            return;
          commit({
            ...latest,
            recommendations: {
              status: tracks.some((track) => track.playable)
                ? "ready"
                : "empty",
              attemptId,
              tracks,
              error: null,
            },
          });
        } catch {
          const latest = runRef.current;
          if (
            latest?.runId !== runId ||
            latest.recommendations.attemptId !== attemptId
          )
            return;
          commit({
            ...latest,
            recommendations: {
              status: "failed",
              attemptId,
              tracks: [],
              error: musicError("PROVIDER_ERROR"),
            },
          });
        }
      })();
    },
    [commit],
  );

  const start = useCallback(
    (confirmed: ConfirmedMemory) => {
      if (!isConfirmedMusicInput(confirmed)) return;
      if (confirmedRef.current === confirmed && runRef.current) return;
      confirmedRef.current = confirmed;
      setConfirmed(confirmed);
      adjustmentRef.current?.abort();
      adjustmentIdRef.current = null;
      setAdjustments([]);
      userPausedRef.current = false;
      controllerRef.current?.abort();
      stop();
      const attemptId = id("ai");
      const recommendationAttemptId = id("rec");
      const profile =
        confirmed.musicProfile || toMusicProfile(confirmed.profile);
      const next: MusicRun = {
        runId: id("run"),
        creationEpoch: ++epochRef.current,
        profile,
        ai: pendingAi(attemptId),
        recommendations: {
          status: "pending",
          attemptId: recommendationAttemptId,
          tracks: [],
          error: null,
        },
        selection: { kind: "ai" },
        ambientTrack,
        currentVersionId: null,
        adjustedTrack: null,
      };
      commit(next);
      void switchTrack("ambient", ambientTrack);
      requestAi(next.runId, attemptId);
      requestRecommendations(next.runId, recommendationAttemptId);
    },
    [commit, requestAi, requestRecommendations, stop, switchTrack],
  );

  const selectRecommendation = useCallback(
    (trackId: string) => {
      const current = runRef.current;
      const track = current?.recommendations.tracks.find(
        (item) => item.id === trackId && item.playable && item.audioUrl,
      );
      if (!current || !track) return;
      commit({
        ...current,
        selection: { kind: "qq", trackId },
        currentVersionId: trackId,
      });
      userPausedRef.current = false;
      void switchTrack("qq", track);
    },
    [commit, switchTrack],
  );

  const selectAi = useCallback(() => {
    const current = runRef.current;
    if (!current) return;
    commit({
      ...current,
      selection: { kind: "ai" },
      currentVersionId:
        current.adjustedTrack?.versionId ??
        (current.ai.status === "ready" ? current.ai.attemptId : null),
    });
    userPausedRef.current = false;
    if (current.adjustedTrack) void switchTrack("ai", current.adjustedTrack);
    else if (current.ai.status === "ready" && current.ai.track)
      void switchTrack("ai", current.ai.track);
    else if (current.ai.status === "pending" && current.ambientTrack)
      void switchTrack("ambient", current.ambientTrack);
    else stop();
  }, [commit, stop, switchTrack]);

  const retryAi = useCallback(() => {
    const current = runRef.current;
    if (!current) return;
    const attemptId = id("ai");
    commit({
      ...current,
      ai: pendingAi(attemptId),
      adjustedTrack: null,
      currentVersionId:
        current.selection.kind === "ai" ? null : current.currentVersionId,
    });
    if (current.selection.kind === "ai" && current.ambientTrack)
      void switchTrack("ambient", current.ambientTrack);
    requestAi(current.runId, attemptId);
  }, [commit, requestAi, switchTrack]);

  const retryRecommendations = useCallback(() => {
    const current = runRef.current;
    if (!current) return;
    const attemptId = id("rec");
    const switchedFromQq = current.selection.kind === "qq";
    commit({
      ...current,
      selection: switchedFromQq ? { kind: "ai" } : current.selection,
      recommendations: {
        status: "pending",
        attemptId,
        tracks: [],
        error: null,
      },
    });
    if (switchedFromQq) {
      if (current.ai.status === "ready" && current.ai.track)
        void switchTrack("ai", current.ai.track);
      else if (current.ai.status === "pending" && current.ambientTrack)
        void switchTrack("ambient", current.ambientTrack);
      else stop();
    }
    requestRecommendations(current.runId, attemptId);
  }, [commit, requestRecommendations, stop, switchTrack]);

  const play = useCallback(async () => {
    const current = runRef.current;
    if (!current) return;
    let kind: AudioKind = "ai";
    let track: PlayableAudio | MockRecommendation | null = null;
    if (current.selection.kind === "qq") {
      kind = "qq";
      const selectedTrackId = current.selection.trackId;
      track =
        current.recommendations.tracks.find(
          (item) => item.id === selectedTrackId && item.playable,
        ) ?? null;
    } else if (current.adjustedTrack) {
      track = current.adjustedTrack;
    } else if (current.ai.status === "ready") {
      track = current.ai.track;
    } else if (current.ai.status === "pending") {
      kind = "ambient";
      track = current.ambientTrack;
    }
    if (!track) return;
    userPausedRef.current = false;
    if (
      audioRef.current &&
      audioKind === kind &&
      activeTrack?.audioUrl === track.audioUrl &&
      activeTrack?.title === track.title
    ) {
      try {
        if (audioRef.current.ended || audioState === "ended")
          audioRef.current.currentTime = 0;
        setAudioState("starting");
        await audioRef.current.play();
        setAudioState("playing");
      } catch {
        setAudioState("blocked");
      }
    } else {
      await switchTrack(kind, track);
    }
  }, [
    activeTrack?.audioUrl,
    activeTrack?.title,
    audioKind,
    audioState,
    switchTrack,
  ]);

  const pause = useCallback(() => {
    userPausedRef.current = true;
    transitionSerialRef.current += 1;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.volume = audio.loop ? AMBIENT_VOLUME : 1;
    }
  }, []);

  const seek = useCallback(
    (time: number) => {
      const audio = audioRef.current;
      if (!audio || !Number.isFinite(time) || !Number.isFinite(audio.duration))
        return;
      audio.currentTime = Math.max(
        0,
        Math.min(
          time,
          Math.min(audio.duration, activeTrack?.durationSec ?? audio.duration),
        ),
      );
      setCurrentTime(audio.currentTime);
    },
    [activeTrack?.durationSec],
  );

  const replay = useCallback(async () => {
    if (audioRef.current) audioRef.current.currentTime = 0;
    await play();
  }, [play]);

  const cancelAdjustment = useCallback(() => {
    adjustmentRef.current?.abort();
    adjustmentIdRef.current = null;
    setAdjustments((previous) =>
      previous.map((item) =>
        item.status === "pending"
          ? { ...item, status: "cancelled", responseText: "已取消本次调整" }
          : item,
      ),
    );
  }, []);

  const adjust = useCallback(
    async (rawInstruction: string) => {
      const instruction = normalizeAdjustmentInstruction(rawInstruction);
      const current = runRef.current;
      const memory = confirmedRef.current;
      if (!instruction || !current || !memory || adjustmentIdRef.current)
        return;
      const selected =
        current.selection.kind === "qq"
          ? current.recommendations.tracks.find(
              (item) =>
                item.id ===
                  (current.selection.kind === "qq"
                    ? current.selection.trackId
                    : null) && item.playable,
            )
          : (current.adjustedTrack ?? current.ai.track);
      if (!selected?.audioUrl) return;
      const requestId = id("adjust");
      const runId = current.runId;
      const path = current.selection.kind;
      const baseTrackId =
        path === "qq" && current.selection.kind === "qq"
          ? current.selection.trackId
          : (current.currentVersionId ?? selected.title);
      adjustmentIdRef.current = requestId;
      const controller = new AbortController();
      adjustmentRef.current = controller;
      setAdjustments((previous) => [
        ...previous,
        {
          id: requestId,
          instruction,
          baseTrackId,
          path,
          status: "pending",
          responseText: null,
          error: null,
        },
      ]);
      try {
        const response = await fetch("/api/music/adjust", {
          method: "POST",
          headers: { "content-type": "application/json" },
          cache: "no-store",
          signal: controller.signal,
          body: JSON.stringify({
            contractVersion: 1,
            requestId,
            profile: current.profile,
            instruction,
            path,
            baseTrackId,
          }),
        });
        const body = await response.json();
        if (
          controller.signal.aborted ||
          adjustmentIdRef.current !== requestId ||
          runRef.current?.runId !== runId
        )
          return;
        if (
          !response.ok ||
          body.requestId !== requestId ||
          body.contractVersion !== 1 ||
          !body.track?.audioUrl
        )
          throw (
            body.error ?? {
              code: "NO_PLAYABLE_RESULT",
              message: "这次没有得到可播放的音乐，请重试。",
              retryable: true,
            }
          );
        const checkedDuration = await probeAudio(
          body.track.audioUrl,
          path === "ai",
        );
        if (
          controller.signal.aborted ||
          adjustmentIdRef.current !== requestId ||
          runRef.current?.runId !== runId
        )
          return;
        if (!checkedDuration)
          throw {
            code: "NO_PLAYABLE_RESULT",
            message: "新音乐暂时无法播放，已保留原来的版本。",
            retryable: true,
          };
        const latest = runRef.current;
        if (!latest) return;
        if (path === "ai") {
          const nextTrack: AiTrack & {
            versionId: string;
            explanation: string;
          } = {
            ...body.track,
            durationSec: Math.min(body.track.durationSec, checkedDuration),
            versionId: requestId,
            explanation:
              body.responseText ?? `根据“${instruction}”调整了音乐。`,
          };
          commit({
            ...latest,
            adjustedTrack: nextTrack,
            currentVersionId: requestId,
          });
        } else {
          const nextTrack: MockRecommendation = {
            ...body.track,
            durationSec: Math.min(body.track.durationSec, checkedDuration),
            playable: true,
          };
          commit({
            ...latest,
            recommendations: {
              ...latest.recommendations,
              tracks: [
                ...latest.recommendations.tracks.filter(
                  (item) => item.id !== nextTrack.id,
                ),
                nextTrack,
              ],
            },
            selection: { kind: "qq", trackId: nextTrack.id },
            currentVersionId: requestId,
          });
        }
        setAdjustments((previous) =>
          previous.map((item) =>
            item.id === requestId
              ? {
                  ...item,
                  status: "succeeded",
                  responseText: body.responseText ?? "已经为你准备好新的音乐。",
                }
              : item,
          ),
        );
      } catch (error) {
        if (
          !controller.signal.aborted &&
          adjustmentIdRef.current === requestId
        ) {
          const issue =
            error && typeof error === "object" && "message" in error
              ? (error as {
                  code?: string;
                  message: string;
                  retryable?: boolean;
                })
              : { message: "调整暂时失败，请重试。" };
          setAdjustments((previous) =>
            previous.map((item) =>
              item.id === requestId
                ? {
                    ...item,
                    status: "failed",
                    responseText: issue.message,
                    error: {
                      code: issue.code ?? "UNKNOWN",
                      message: issue.message,
                      retryable: issue.retryable ?? true,
                    },
                  }
                : item,
            ),
          );
        }
      } finally {
        if (adjustmentIdRef.current === requestId)
          adjustmentIdRef.current = null;
      }
    },
    [commit],
  );

  useEffect(() => {
    const previous = previousPathRef.current;
    previousPathRef.current = pathname;
    if (pathname === "/play") return;
    if (pathname === "/result") {
      if (previous === "/play") stop();
      return;
    }
    controllerRef.current?.abort();
    adjustmentRef.current?.abort();
    stop();
    commit(null);
    confirmedRef.current = null;
    setConfirmed(null);
    setAdjustments([]);
  }, [pathname, commit, stop]);

  useEffect(
    () => () => {
      transitionSerialRef.current += 1;
      audioSerialRef.current += 1;
      controllerRef.current?.abort();
      adjustmentRef.current?.abort();
      audioRef.current?.pause();
    },
    [],
  );

  const value = useMemo(
    () => ({
      run,
      audioKind,
      audioState,
      activeTrack,
      currentTime,
      duration,
      adjustments,
      confirmed,
      start,
      selectRecommendation,
      selectAi,
      retryAi,
      retryRecommendations,
      play,
      pause,
      seek,
      replay,
      adjust,
      cancelAdjustment,
      stop,
    }),
    [
      run,
      audioKind,
      audioState,
      activeTrack,
      currentTime,
      duration,
      adjustments,
      confirmed,
      start,
      selectRecommendation,
      selectAi,
      retryAi,
      retryRecommendations,
      play,
      pause,
      seek,
      replay,
      adjust,
      cancelAdjustment,
      stop,
    ],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useMusicSession() {
  const value = useContext(Context);
  if (!value) throw new Error("Music session provider missing");
  return value;
}

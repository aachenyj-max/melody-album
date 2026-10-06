"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import type { ConfirmedMemory } from "./creation-session";
import { getMockRecommendations } from "@/lib/music/mock-recommendations";
import { toMusicProfile } from "@/lib/music/profile";
import {
  isConfirmedMusicInput,
  musicError,
  type AiBranch,
  type AiTrack,
  type MockRecommendation,
  type MusicRun,
  type PlayableAudio,
} from "@/lib/music/contract";

export type AudioKind = "none" | "ambient" | "ai" | "qq";
export type AudioState = "idle" | "playing" | "paused" | "blocked" | "failed";

type MusicSession = {
  run: MusicRun | null;
  audioKind: AudioKind;
  audioState: AudioState;
  activeTrack: PlayableAudio | MockRecommendation | null;
  start: (confirmed: ConfirmedMemory) => void;
  selectRecommendation: (trackId: string) => void;
  selectAi: () => void;
  retryAi: () => void;
  retryRecommendations: () => void;
  play: () => Promise<void>;
  stop: () => void;
};

export type ResultViewModel = MusicSession;

const Context = createContext<MusicSession | null>(null);
const ambientTrack: PlayableAudio = {
  title: "记忆的氛围",
  durationSec: 8,
  audioUrl: "/audio/music-album/ambient.wav",
  audioMimeType: "audio/wav",
  source: "ambient",
};

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
  const runRef = useRef<MusicRun | null>(null);
  const confirmedRef = useRef<ConfirmedMemory | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioSerialRef = useRef(0);
  const epochRef = useRef(0);

  const commit = useCallback((next: MusicRun | null) => {
    runRef.current = next;
    setRun(next);
  }, []);

  const stop = useCallback(() => {
    audioSerialRef.current += 1;
    const current = audioRef.current;
    if (current) {
      current.pause();
      current.removeAttribute("src");
      current.load();
      audioRef.current = null;
    }
    setAudioKind("none");
    setAudioState("idle");
    setActiveTrack(null);
  }, []);

  const switchTrack = useCallback(
    async (kind: AudioKind, track: PlayableAudio | MockRecommendation) => {
      const url = track.audioUrl;
      if (!url) return;
      const current = audioRef.current;
      if (current?.src === new URL(url, window.location.href).href) return;
      stop();
      const serial = audioSerialRef.current;
      const audio = new Audio(url);
      audio.preload = "auto";
      if (kind === "ambient") audio.loop = true;
      audioRef.current = audio;
      setAudioKind(kind);
      setActiveTrack(track);
      audio.onended = () => {
        if (serial === audioSerialRef.current) setAudioState("paused");
      };
      audio.ontimeupdate = () => {
        if (
          kind === "ai" &&
          serial === audioSerialRef.current &&
          audio.currentTime >= track.durationSec
        ) {
          audio.pause();
          setAudioState("paused");
        }
      };
      audio.onerror = () => {
        if (serial === audioSerialRef.current) setAudioState("failed");
      };
      try {
        await audio.play();
        if (serial === audioSerialRef.current) setAudioState("playing");
      } catch {
        if (serial === audioSerialRef.current) setAudioState("blocked");
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
          });
          if (afterProbe.selection.kind === "ai")
            void switchTrack("ai", readyTrack);
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
      controllerRef.current?.abort();
      stop();
      const attemptId = id("ai");
      const recommendationAttemptId = id("rec");
      const profile = toMusicProfile(confirmed.profile);
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
      commit({ ...current, selection: { kind: "qq", trackId } });
      void switchTrack("qq", track);
    },
    [commit, switchTrack],
  );

  const selectAi = useCallback(() => {
    const current = runRef.current;
    if (!current) return;
    commit({ ...current, selection: { kind: "ai" } });
    if (current.ai.status === "ready" && current.ai.track)
      void switchTrack("ai", current.ai.track);
    else if (current.ai.status === "pending" && current.ambientTrack)
      void switchTrack("ambient", current.ambientTrack);
    else stop();
  }, [commit, stop, switchTrack]);

  const retryAi = useCallback(() => {
    const current = runRef.current;
    if (!current) return;
    const attemptId = id("ai");
    commit({ ...current, ai: pendingAi(attemptId) });
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
    } else if (current.ai.status === "ready") {
      track = current.ai.track;
    } else if (current.ai.status === "pending") {
      kind = "ambient";
      track = current.ambientTrack;
    }
    if (!track) return;
    if (
      audioRef.current &&
      audioKind === kind &&
      activeTrack?.audioUrl === track.audioUrl
    ) {
      try {
        await audioRef.current.play();
        setAudioState("playing");
      } catch {
        setAudioState("blocked");
      }
    } else {
      await switchTrack(kind, track);
    }
  }, [activeTrack?.audioUrl, audioKind, switchTrack]);

  useEffect(() => {
    if (pathname === "/result" || pathname === "/play") return;
    controllerRef.current?.abort();
    stop();
    commit(null);
    confirmedRef.current = null;
  }, [pathname, commit, stop]);

  useEffect(
    () => () => {
      controllerRef.current?.abort();
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
      start,
      selectRecommendation,
      selectAi,
      retryAi,
      retryRecommendations,
      play,
      stop,
    }),
    [
      run,
      audioKind,
      audioState,
      activeTrack,
      start,
      selectRecommendation,
      selectAi,
      retryAi,
      retryRecommendations,
      play,
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

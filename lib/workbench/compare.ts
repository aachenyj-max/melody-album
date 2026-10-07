import "server-only";
import { canonical } from "./config";
import {
  isTerminal,
  jsonValue,
  type ComparisonGroup,
  type DiffEntry,
  type Json,
  type RunComparison,
  type RunDetail,
} from "./contract";

function normalize(value: Json): Json {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) =>
            ![
              "audioUrl",
              "previewUrl",
              "coverUrl",
              "expiresAt",
              "startedAt",
              "endedAt",
              "createdAt",
              "requestId",
              "request_id",
              "durationMs",
              "timestamp",
              "at",
            ].includes(key),
        )
        .map(([key, item]) => [key, normalize(item)]),
    );
  return value;
}
function flatten(
  value: Json,
  prefix = "",
  output: Record<string, Json> = {},
): Record<string, Json> {
  if (
    value !== null &&
    typeof value === "object" &&
    Object.keys(value).length
  ) {
    for (const [key, item] of Object.entries(value))
      flatten(item, prefix ? `${prefix}.${key}` : key, output);
  } else output[prefix || "value"] = value;
  return output;
}
export function diffValues(
  left: Json,
  right: Json,
  pending = false,
): DiffEntry[] {
  const a = flatten(left),
    b = flatten(right);
  return [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .sort()
    .map((path) => ({
      path,
      left: a[path],
      right: b[path],
      state: pending
        ? "pending"
        : !(path in a)
          ? "missing_left"
          : !(path in b)
            ? "missing_right"
            : canonical(a[path]) === canonical(b[path])
              ? "equal"
              : "changed",
    }));
}
function groups(run: RunDetail): Record<ComparisonGroup, Json> {
  const stage = (name: string) => run.steps.find((step) => step.stage === name);
  const profile = (name: string) => {
    const step = stage(name);
    return jsonValue({
      status: step?.status ?? "pending",
      source: step?.source ?? "none",
      result: step?.result ?? null,
      error: step?.error ?? null,
    });
  };
  return {
    input: jsonValue(run.inputSnapshot),
    config: jsonValue(run.configSnapshot),
    memory: profile("memory"),
    musicProfile: profile("music_profile"),
    tools: normalize(
      jsonValue(
        run.steps
          .filter((step) =>
            [
              "memory",
              "music_profile",
              "ai_music",
              "qq_recommendations",
            ].includes(step.stage),
          )
          .map((step) => ({
            stage: step.stage,
            status: step.status,
            driver: step.driver,
            source: step.source,
            result: step.result,
            error: step.error,
            calls: step.calls.map((call) => ({
              name: call.name,
              version: call.version,
              status: call.status,
              input: call.input,
              output: call.output,
            })),
          })),
      ),
    ),
    summary: normalize(
      jsonValue({ status: run.status, summary: run.summary, error: run.error }),
    ),
  };
}
export function compareRuns(left: RunDetail, right: RunDetail): RunComparison {
  const a = groups(left),
    b = groups(right);
  const pending = (run: RunDetail, stage: string) =>
    ["pending", "running"].includes(
      run.steps.find((step) => step.stage === stage)?.status ?? "pending",
    );
  return {
    left,
    right,
    differences: {
      input: diffValues(a.input, b.input),
      config: diffValues(a.config, b.config),
      memory: diffValues(
        a.memory,
        b.memory,
        pending(left, "memory") || pending(right, "memory"),
      ),
      musicProfile: diffValues(
        a.musicProfile,
        b.musicProfile,
        pending(left, "music_profile") || pending(right, "music_profile"),
      ),
      tools: diffValues(a.tools, b.tools).map((entry) => {
        const stage = [
          "memory",
          "music_profile",
          "ai_music",
          "qq_recommendations",
        ][Number(entry.path.split(".")[0])];
        return stage && (pending(left, stage) || pending(right, stage))
          ? { ...entry, state: "pending" as const }
          : entry;
      }),
      summary: diffValues(
        a.summary,
        b.summary,
        !isTerminal(left.status) || !isTerminal(right.status),
      ),
    },
  };
}

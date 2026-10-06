import { NextResponse } from "next/server";
import { generateMusic } from "@/lib/music/generator";
import { musicError, validateMusicProfile } from "@/lib/music/contract";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: musicError("INVALID_PROFILE") },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }
  if (!body || typeof body !== "object")
    return NextResponse.json(
      { error: musicError("INVALID_PROFILE") },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  const raw = body as Record<string, unknown>;
  const requestId =
    typeof raw.requestId === "string" &&
    /^[a-zA-Z0-9_-]{1,100}$/.test(raw.requestId)
      ? raw.requestId
      : "unknown";
  const profile = validateMusicProfile(raw.profile);
  if (
    raw.contractVersion !== 1 ||
    requestId === "unknown" ||
    Object.keys(raw).some(
      (key) => !["contractVersion", "requestId", "profile"].includes(key),
    ) ||
    !profile
  )
    return NextResponse.json(
      { contractVersion: 1, requestId, error: musicError("INVALID_PROFILE") },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  const result = await generateMusic(profile);
  if (!result.ok) {
    const status =
      result.error.code === "GENERATION_TIMEOUT"
        ? 504
        : result.error.code === "GENERATION_UNAVAILABLE"
          ? 503
          : result.error.code === "INVALID_PROFILE"
            ? 400
            : result.error.code === "INVALID_GENERATED_AUDIO" ||
                result.error.code === "PROVIDER_ERROR"
              ? 502
              : 500;
    return NextResponse.json(
      { contractVersion: 1, requestId, error: result.error },
      { status, headers: { "cache-control": "no-store" } },
    );
  }
  return NextResponse.json(
    {
      contractVersion: 1,
      requestId,
      source: result.source,
      track: result.track,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

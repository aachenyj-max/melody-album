import { albumIdPattern } from "@/lib/albums/contract";
import { demoMusicProfile } from "@/lib/albums/demo-music-context";
import { getAlbumIdentity, sameOrigin } from "@/lib/albums/identity";
import { albumAdmin, getAlbum } from "@/lib/albums/repository";
import { normalizeProfile } from "@/lib/memory/contract";
import { adjustedProfile } from "@/lib/music/adjust-profile";
import { normalizeAdjustmentInstruction } from "@/lib/music/contract";
import { generateMusic } from "@/lib/music/generator";
import { toMusicProfile } from "@/lib/music/profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
const headers = { "cache-control": "private, no-store" };
const fail = (error: string, status: number) =>
  Response.json({ error }, { status, headers });

async function bodyOf(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return null;
  const text = await request.text();
  if (text.length > 4096) return null;
  try {
    const body = JSON.parse(text);
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(request)) return fail("请求来源无效。", 403);
  const { id } = await params;
  const demo = demoMusicProfile(id);
  if (!demo && !albumIdPattern.test(id))
    return fail("找不到这段音乐记忆。", 404);
  const body = await bodyOf(request);
  const instruction = normalizeAdjustmentInstruction(body?.instruction);
  if (
    !body ||
    Object.keys(body).some(
      (key) => !["instruction", "baseTrackId"].includes(key),
    ) ||
    !instruction ||
    typeof body.baseTrackId !== "string" ||
    !body.baseTrackId.trim() ||
    body.baseTrackId.length > 150
  )
    return fail("请输入 1–300 字的调整要求。", 400);
  try {
    const identity = await getAlbumIdentity(true);
    if (!identity) return fail("暂时无法建立相册会话，请重试。", 401);
    let profile = demo;
    if (!profile) {
      const album = await getAlbum(identity.ownerKey, id);
      if (!album) return fail("找不到这段音乐记忆。", 404);
      const current = album.music.find((track) => track.selected);
      if (!current?.audio_url || current.version_id !== body.baseTrackId)
        return fail("相册音乐已更新，请返回详情后重试。", 409);
      const memory = normalizeProfile(album.memory, album.photoCount);
      if (!memory) return fail("相册记忆无法用于调整。", 422);
      profile = toMusicProfile(memory);
    }
    const result = await generateMusic(adjustedProfile(profile, instruction), {
      mode: "live",
      signal: request.signal,
    });
    if (!result.ok)
      return fail(
        result.error.message,
        result.error.code === "GENERATION_TIMEOUT" ? 504 : 503,
      );
    if (result.source !== "api") return fail("没有生成真实配乐，请重试。", 502);
    const versionId = `adjust:${crypto.randomUUID()}`;
    const track = {
      ...result.track,
      title: `${profile.memoryTitle.slice(0, 60)} · 新配乐`,
    };
    if (!demo) {
      const { error } = await albumAdmin()
        .from("memory_album_music_versions")
        .insert({
          album_id: id,
          version_id: versionId,
          base_version_id: body.baseTrackId,
          kind: "ai",
          status: "ready",
          source: "api",
          title: track.title,
          artist: "AI 原创配乐",
          audio_url: track.audioUrl,
          audio_mime_type: track.audioMimeType,
          duration_sec: track.durationSec,
          selected: false,
        });
      if (error) return fail("新配乐暂时无法保存，原音乐未变更，请重试。", 503);
    }
    return Response.json(
      {
        candidate: {
          versionId,
          baseTrackId: body.baseTrackId,
          track,
          responseText: `已根据“${instruction}”生成新配乐。先试听，满意后再确认替换。`,
        },
      },
      { headers },
    );
  } catch {
    return fail("修改音乐暂时失败，原音乐未变更，请重试。", 503);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(request)) return fail("请求来源无效。", 403);
  const { id } = await params;
  if (!albumIdPattern.test(id)) return fail("找不到这段音乐记忆。", 404);
  const body = await bodyOf(request);
  if (
    !body ||
    Object.keys(body).some(
      (key) => !["versionId", "baseTrackId"].includes(key),
    ) ||
    typeof body.versionId !== "string" ||
    !/^adjust:[0-9a-f-]{36}$/.test(body.versionId) ||
    typeof body.baseTrackId !== "string" ||
    body.baseTrackId.length > 150
  )
    return fail("新音乐版本无效，请重新生成。", 400);
  try {
    const identity = await getAlbumIdentity();
    if (!identity) return fail("找不到这段音乐记忆。", 404);
    const { error } = await albumAdmin().rpc("memory_album_confirm_music", {
      p_album_id: id,
      p_owner_key: identity.ownerKey,
      p_version_id: body.versionId,
      p_base_version_id: body.baseTrackId,
    });
    if (error) {
      if (error.message.includes("ALBUM_NOT_FOUND"))
        return fail("找不到这段音乐记忆。", 404);
      if (error.message.includes("MUSIC_CONFLICT"))
        return fail("相册音乐已更新，请返回详情后重试。", 409);
      if (error.message.includes("CANDIDATE_NOT_FOUND"))
        return fail("新音乐版本无效，请重新生成。", 404);
      return fail("保存新配乐失败，原音乐未变更，请重试。", 503);
    }
    return Response.json({ ok: true }, { headers });
  } catch {
    return fail("保存新配乐失败，原音乐未变更，请重试。", 503);
  }
}

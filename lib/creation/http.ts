import "server-only";
import { getAlbumIdentity, sameOrigin } from "@/lib/albums/identity";
import { CreationError } from "./contract";

export const privateHeaders = { "cache-control": "private, no-store" };
export async function creationRoute(
  request: Request,
  run: (owner: string, raw: Record<string, unknown>) => Promise<unknown>,
  create = false,
) {
  try {
    if (request.method !== "GET" && !sameOrigin(request))
      throw new CreationError("INVALID_ORIGIN", "请求来源无效。", 403);
    const identity = await getAlbumIdentity(create);
    if (!identity)
      throw new CreationError(
        "SESSION_REQUIRED",
        "当前会话无法恢复，请创建新相册。",
        401,
      );
    let raw: Record<string, unknown> = {};
    if (request.method !== "GET") {
      if (!request.headers.get("content-type")?.startsWith("application/json"))
        throw new CreationError("INVALID_INPUT", "请求格式无效。");
      const reader = request.body?.getReader();
      let length = 0;
      const chunks: Uint8Array[] = [];
      if (!reader) throw new CreationError("INVALID_INPUT", "请求内容为空。");
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.byteLength;
          if (length > 128 * 1024) {
            await reader.cancel();
            throw new CreationError("TOO_LARGE", "请求内容过大。", 413);
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        throw new CreationError("INVALID_INPUT", "请求内容无效。");
      raw = parsed;
    }
    const result = await run(identity.ownerKey, raw);
    return result instanceof Response
      ? result
      : Response.json(result, { headers: privateHeaders });
  } catch (error) {
    const safe =
      error instanceof CreationError
        ? error
        : new CreationError(
            "DATA_UNAVAILABLE",
            "暂时无法处理，请重试。",
            error instanceof SyntaxError ? 400 : 503,
          );
    return Response.json(
      {
        error: {
          code: safe.code,
          message: safe.message,
          retryable: safe.status >= 500 || safe.status === 409,
        },
      },
      { status: safe.status, headers: privateHeaders },
    );
  }
}

import {
  MAX_PHOTOS,
  MAX_REQUEST_BYTES,
  failure,
  normalizeProfile,
  type MemoryErrorCode,
  type MemoryProfile,
} from "./contract";

export class MemoryRequestError extends Error {
  constructor(public code: MemoryErrorCode) {
    super(code);
  }
}

function fail(code: MemoryErrorCode): never {
  throw new MemoryRequestError(code);
}

async function boundedFormData(request: Request): Promise<FormData> {
  const length = Number(request.headers.get("content-length"));
  if (length > MAX_REQUEST_BYTES) fail("REQUEST_TOO_LARGE");
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;"))
    fail("UNSUPPORTED_FILE");
  if (!request.body) fail("INVALID_PHOTO_COUNT");
  const reader = request.body.getReader();
  const chunks: ArrayBuffer[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REQUEST_BYTES) fail("REQUEST_TOO_LARGE");
      chunks.push(new Uint8Array(value).buffer);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return await new Request("http://local/memory", {
      method: "POST",
      headers: { "content-type": contentType },
      body: new Blob(chunks),
    }).formData();
  } catch {
    return fail("UNSUPPORTED_FILE");
  }
}

export type ParsedMemoryRequest = {
  photos: File[];
  story: string;
  profile?: MemoryProfile;
  instruction?: string;
};

export async function parseMemoryRequest(
  request: Request,
  kind: "understand" | "revise",
): Promise<ParsedMemoryRequest> {
  const form = await boundedFormData(request);
  const values = form.getAll("photos");
  if (values.length < 1 || values.length > MAX_PHOTOS)
    fail("INVALID_PHOTO_COUNT");
  if (
    !values.every((item) => item instanceof File && item.type === "image/jpeg")
  )
    fail("UNSUPPORTED_FILE");
  const photos = values as File[];
  if (photos.some((item) => item.size === 0)) fail("PHOTO_READ_FAILED");
  for (const photo of photos) {
    const signature = new Uint8Array(await photo.slice(0, 3).arrayBuffer());
    if (signature[0] !== 0xff || signature[1] !== 0xd8 || signature[2] !== 0xff)
      fail("UNSUPPORTED_FILE");
  }
  const storyValue = form.get("story");
  if (storyValue !== null && typeof storyValue !== "string")
    fail("INVALID_STORY");
  const story = (storyValue ?? "").trim();
  if (story.length > 1000) fail("INVALID_STORY");
  if (kind === "understand") return { photos, story };
  const instructionValue = form.get("instruction");
  if (typeof instructionValue !== "string") fail("INVALID_INSTRUCTION");
  const instruction = instructionValue.trim();
  if (instruction.length < 1 || instruction.length > 300)
    fail("INVALID_INSTRUCTION");
  const profileValue = form.get("profile");
  if (typeof profileValue !== "string" || profileValue.length > 10000)
    fail("INVALID_PROFILE");
  let parsed: unknown;
  try {
    parsed = JSON.parse(profileValue);
  } catch {
    fail("INVALID_PROFILE");
  }
  const profile = normalizeProfile(parsed, photos.length);
  if (!profile) fail("INVALID_PROFILE");
  const baseVersion = Number(form.get("baseVersion"));
  if (!Number.isSafeInteger(baseVersion) || baseVersion !== profile.version)
    fail("INVALID_PROFILE");
  return { photos, story, profile, instruction };
}

export function requestErrorResponse(
  error: unknown,
  requestId: string,
): Response {
  const code = error instanceof MemoryRequestError ? error.code : "UNKNOWN";
  const result = failure(code, requestId);
  return Response.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store" },
  });
}

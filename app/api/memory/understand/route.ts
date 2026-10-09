import { CONTRACT_VERSION } from "@/lib/memory/contract";
import { understandMemory } from "@/lib/memory/adapter";
import { parseMemoryRequest, requestErrorResponse } from "@/lib/memory/request";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const { photos, story } = await parseMemoryRequest(request, "understand");
    const result = await understandMemory(request, photos, story);
    return Response.json(
      { contractVersion: CONTRACT_VERSION, requestId, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return requestErrorResponse(error, requestId);
  }
}

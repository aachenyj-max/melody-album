import { CONTRACT_VERSION } from "@/lib/memory/contract";
import { understandMemory } from "@/lib/memory/adapter";
import { parseMemoryRequest, requestErrorResponse } from "@/lib/memory/request";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const { photos, story } = await parseMemoryRequest(request, "understand");
    const profile = await understandMemory(request, photos, story);
    return Response.json(
      { contractVersion: CONTRACT_VERSION, requestId, profile },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return requestErrorResponse(error, requestId);
  }
}

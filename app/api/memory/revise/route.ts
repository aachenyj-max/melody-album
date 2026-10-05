import { CONTRACT_VERSION } from "@/lib/memory/contract";
import { reviseMemory } from "@/lib/memory/adapter";
import { parseMemoryRequest, requestErrorResponse } from "@/lib/memory/request";

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const { photos, story, profile, instruction } = await parseMemoryRequest(
      request,
      "revise",
    );
    if (!profile || !instruction) throw new Error("Missing revision data");
    const next = await reviseMemory(
      request,
      photos,
      story,
      profile,
      instruction,
    );
    return Response.json(
      { contractVersion: CONTRACT_VERSION, requestId, profile: next },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return requestErrorResponse(error, requestId);
  }
}

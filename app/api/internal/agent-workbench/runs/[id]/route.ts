import { requireHuman } from "@/lib/workbench/auth";
import { uuid } from "@/lib/workbench/contract";
import { endpoint, queryFields, response } from "@/lib/workbench/http";
import { getRun } from "@/lib/workbench/repository";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    await requireHuman();
    queryFields(request, []);
    return response(await getRun(uuid((await params).id)));
  });
}

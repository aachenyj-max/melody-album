import { requireMachine } from "@/lib/workbench/auth";
import { maintainWorkbench } from "@/lib/workbench/cleanup";
import { assertVersion, readJson } from "@/lib/workbench/contract";
import { endpoint, queryFields, response } from "@/lib/workbench/http";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request) {
  return endpoint(async () => {
    requireMachine(request);
    queryFields(request, []);
    assertVersion(
      (await readJson(request, ["contractVersion"])).contractVersion,
    );
    return response(await maintainWorkbench(request));
  });
}

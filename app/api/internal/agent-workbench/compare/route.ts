import { requireHuman } from "@/lib/workbench/auth";
import { compareRuns } from "@/lib/workbench/compare";
import { uuid, WorkbenchError } from "@/lib/workbench/contract";
import { endpoint, queryFields, response } from "@/lib/workbench/http";
import { getRunsTogether } from "@/lib/workbench/repository";
export const runtime = "nodejs";
export async function GET(request: Request) {
  return endpoint(async () => {
    await requireHuman();
    const query = queryFields(request, ["a", "b"]);
    const a = uuid(query.get("a")),
      b = uuid(query.get("b"));
    if (a === b)
      throw new WorkbenchError("INVALID_INPUT", "请选择两条不同的运行。");
    const [left, right] = await getRunsTogether(a, b);
    return response(compareRuns(left, right));
  });
}

import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMachine } from "./auth";
import { WorkbenchError } from "./contract";

export async function maintainWorkbench(request: Request) {
  requireMachine(request);
  const token = randomUUID();
  const deadline = AbortSignal.timeout(20000);
  const client = createAdminClient(deadline);
  const { data, error } = await client.rpc(
    "agent_workbench_maintenance_claim",
    { p_token: token, p_limit: 50 },
  );
  if (error || !data)
    throw new WorkbenchError(
      "DATA_UNAVAILABLE",
      "维护领取暂不可用。",
      503,
      null,
      true,
    );
  const batch = data as {
    recoveredRuns: number;
    runs: { id: string; paths: string[] }[];
    hasMore: boolean;
  };
  const counts = {
    recoveredRuns: batch.recoveredRuns,
    deletedRuns: 0,
    deletedObjects: 0,
    failedRuns: 0,
    hasMore: batch.hasMore,
  };
  for (const run of batch.runs) {
    if (deadline.aborted) {
      counts.hasMore = true;
      break;
    }
    try {
      if (
        run.paths.some(
          (path) =>
            !new RegExp(`^runs/${run.id}/photos/[0-8]\\.jpg$`).test(path),
        )
      )
        throw new Error("Invalid manifest");
      if (run.paths.length) {
        const result = await client.storage
          .from("agent-workbench-test-inputs")
          .remove(run.paths);
        if (result.error) throw new Error("Storage deletion failed");
      }
      const result = await client.rpc("agent_workbench_maintenance_delete", {
        p_id: run.id,
        p_token: token,
        p_success: true,
      });
      if (result.error || result.data !== true)
        throw new Error("Deletion was not committed");
      counts.deletedRuns++;
      counts.deletedObjects += run.paths.length;
    } catch {
      counts.failedRuns++;
      counts.hasMore = true;
      if (!deadline.aborted)
        await client.rpc("agent_workbench_maintenance_delete", {
          p_id: run.id,
          p_token: token,
          p_success: false,
        });
    }
  }
  return counts;
}

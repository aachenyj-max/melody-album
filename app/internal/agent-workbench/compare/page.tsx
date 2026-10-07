import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RunComparisonView } from "@/components/agent-workbench/run-comparison";
import {
  isAuthenticated,
  requireHuman,
  workbenchEnabled,
} from "@/lib/workbench/auth";
import { compareRuns } from "@/lib/workbench/compare";
import { errorData, uuid, WorkbenchError } from "@/lib/workbench/contract";
import { getRunsTogether } from "@/lib/workbench/repository";
export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  if (!workbenchEnabled()) notFound();
  if (!(await isAuthenticated())) redirect("/internal/agent-workbench");
  await requireHuman();
  try {
    const query = await searchParams;
    const a = uuid(query.a),
      b = uuid(query.b);
    if (a === b)
      throw new WorkbenchError("INVALID_INPUT", "请选择两条不同的运行。");
    const [left, right] = await getRunsTogether(a, b);
    return <RunComparisonView comparison={compareRuns(left, right)} />;
  } catch (error) {
    if (error instanceof WorkbenchError && error.status === 404) notFound();
    return (
      <section className="wb-panel">
        <h1>无法对比这两条记录</h1>
        <p role="alert">{errorData(error).message}</p>
        <Link href="/internal/agent-workbench">返回列表重新选择</Link>
      </section>
    );
  }
}

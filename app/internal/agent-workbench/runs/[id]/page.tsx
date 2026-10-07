import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RunDetailView } from "@/components/agent-workbench/run-detail";
import {
  isAuthenticated,
  requireHuman,
  workbenchEnabled,
} from "@/lib/workbench/auth";
import { errorData, uuid, WorkbenchError } from "@/lib/workbench/contract";
import { getRun } from "@/lib/workbench/repository";
export default async function RunPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ execute?: string }>;
}) {
  if (!workbenchEnabled()) notFound();
  if (!(await isAuthenticated())) redirect("/internal/agent-workbench");
  await requireHuman();
  const { id } = await params;
  let run: Awaited<ReturnType<typeof getRun>>;
  try {
    run = await getRun(uuid(id));
  } catch (error) {
    if (error instanceof WorkbenchError && [400, 404].includes(error.status))
      notFound();
    return (
      <section className="wb-panel">
        <h1>记录暂不可读取</h1>
        <p role="alert">{errorData(error).message}</p>
        <Link href={`/internal/agent-workbench/runs/${id}`} prefetch={false}>
          重新读取
        </Link>
        <p>
          <Link href="/internal/agent-workbench">返回工作台</Link>
        </p>
      </section>
    );
  }
  return (
    <RunDetailView
      key={run.runId}
      initial={run}
      autoStart={(await searchParams).execute === "1"}
    />
  );
}

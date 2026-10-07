import { notFound } from "next/navigation";
import { Workbench } from "@/components/agent-workbench/workbench";
import { isAuthenticated, workbenchEnabled } from "@/lib/workbench/auth";
export default async function WorkbenchPage() {
  if (!workbenchEnabled()) notFound();
  return <Workbench authenticated={await isAuthenticated()} />;
}

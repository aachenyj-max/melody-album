import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { workbenchEnabled } from "@/lib/workbench/auth";
import "./workbench.css";
export const metadata: Metadata = {
  title: "内部 Agent 工作台",
  robots: { index: false, follow: false },
};
export const runtime = "nodejs";
export default function WorkbenchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!workbenchEnabled()) notFound();
  return (
    <main className="wb">
      <div className="wb-content">{children}</div>
    </main>
  );
}

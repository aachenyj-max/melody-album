import Link from "next/link";
import { ChevronLeft, Ellipsis } from "lucide-react";

export function PageFrame({
  title,
  backHref,
  large = false,
}: {
  title?: string;
  backHref?: string;
  large?: boolean;
}) {
  return (
    <header className={`album-header ${large ? "header-large" : ""}`}>
      {backHref && (
        <Link
          className="round-button back-button"
          href={backHref}
          aria-label="返回上一页"
        >
          <ChevronLeft />
        </Link>
      )}
      {title && <h1>{title}</h1>}
      <button
        type="button"
        className="round-button more-button"
        aria-label="更多选项（暂未开放）"
        disabled
      >
        <Ellipsis />
      </button>
    </header>
  );
}

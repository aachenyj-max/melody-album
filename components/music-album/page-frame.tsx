import Link from "next/link";
import { ChevronLeft, Ellipsis } from "lucide-react";

export function PageFrame({
  title,
  backHref,
  large = false,
  moreLabel = "更多选项（暂未开放）",
  sharePlaceholder = false,
}: {
  title?: string;
  backHref?: string;
  large?: boolean;
  moreLabel?: string;
  sharePlaceholder?: boolean;
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
      {sharePlaceholder ? (
        <details className="more-details more-button">
          <summary className="round-button" aria-label={moreLabel}>
            <Ellipsis />
          </summary>
          <p role="status">分享功能暂未开放</p>
        </details>
      ) : (
        <button
          type="button"
          className="round-button more-button"
          aria-label={moreLabel}
          disabled
        >
          <Ellipsis />
        </button>
      )}
    </header>
  );
}

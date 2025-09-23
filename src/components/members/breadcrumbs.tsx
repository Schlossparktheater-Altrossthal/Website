import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { MembersBreadcrumbItem } from "@/lib/members-breadcrumbs";

const ROOT_ID = "__members-root";

interface MembersBreadcrumbsProps {
  items: readonly MembersBreadcrumbItem[];
  includeRoot?: boolean;
  rootLabel?: MembersBreadcrumbItem["label"];
  rootHref?: string;
  className?: string;
}

function renderBreadcrumbContent(item: MembersBreadcrumbItem) {
  const hasIcon = Boolean(item.icon);

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {hasIcon ? (
        <span className="flex flex-shrink-0 items-center text-muted-foreground/70">
          {item.icon}
        </span>
      ) : null}
      <span className="truncate">{item.label}</span>
    </span>
  );
}

export function MembersBreadcrumbs({
  items,
  includeRoot = true,
  rootLabel = "Mitgliederbereich",
  rootHref = "/mitglieder",
  className,
}: MembersBreadcrumbsProps) {
  const normalizedItems = includeRoot
    ? ([
        { id: ROOT_ID, label: rootLabel, href: rootHref } satisfies MembersBreadcrumbItem,
        ...items,
      ] as MembersBreadcrumbItem[])
    : [...items];

  if (normalizedItems.length === 0) {
    return null;
  }

  return (
    <ol className={cn("flex min-w-0 items-center gap-2", className)}>
      {normalizedItems.map((item, index) => {
        const key = item.id ?? item.href ?? `crumb-${index}`;
        const isCurrent = item.isCurrent ?? index === normalizedItems.length - 1;
        const content = renderBreadcrumbContent(item);

        return (
          <li key={key} className="flex min-w-0 items-center gap-2">
            {index > 0 ? (
              <ChevronRight
                aria-hidden="true"
                className="h-3 w-3 flex-shrink-0 text-muted-foreground/60"
              />
            ) : null}
            {item.href && !isCurrent ? (
              <Link
                href={item.href}
                aria-label={item.ariaLabel}
                className={cn(
                  "flex min-w-0 items-center gap-1.5 text-muted-foreground transition hover:text-foreground focus-visible:text-foreground focus-visible:underline",
                  item.className,
                )}
              >
                {content}
              </Link>
            ) : (
              <span
                aria-current={isCurrent ? "page" : undefined}
                className={cn(
                  "flex min-w-0 items-center gap-1.5",
                  isCurrent
                    ? "text-foreground"
                    : "text-muted-foreground/80",
                  item.className,
                )}
              >
                {content}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

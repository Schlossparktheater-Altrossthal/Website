import type { ReactNode } from "react";

import { PageHeader } from "@/components/members/page-header";
import type { MembersBreadcrumbItem } from "@/lib/members-breadcrumbs";

/**
 * Kopf der Kartenseiten. Im Mitgliederbereich der übliche `PageHeader`; unter /kartenbuero
 * (Zugänge ohne Konto, ohne `MembersAppShell`) eine schlichte Variante – `PageHeader` braucht die
 * Shell.
 */
export function TicketsPageHeader({
  standalone,
  title,
  description,
  actions,
  breadcrumbs,
}: {
  standalone: boolean;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: readonly (MembersBreadcrumbItem | null)[];
}) {
  if (!standalone) {
    return (
      <PageHeader
        title={title}
        description={description}
        actions={actions}
        breadcrumbs={breadcrumbs}
      />
    );
  }
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold md:text-3xl">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

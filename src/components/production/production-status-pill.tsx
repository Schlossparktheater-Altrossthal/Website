import type { ProductionStatus } from "@prisma/client";

import { PRODUCTION_STATUS_LABELS } from "@/lib/produktionen/status";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<ProductionStatus, string> = {
  planning: "border-warning/40 bg-warning/10 text-warning",
  active: "border-success/40 bg-success/15 text-success",
  finished: "border-border bg-muted text-muted-foreground",
  archived: "border-dashed border-border text-muted-foreground",
};

/** Status einer Produktion als farbige Pille (Planung · Läuft · Abgeschlossen · Archiviert). */
export function ProductionStatusPill({
  status,
  className,
}: {
  status: ProductionStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4",
        STATUS_STYLES[status],
        className,
      )}
    >
      {PRODUCTION_STATUS_LABELS[status]}
    </span>
  );
}

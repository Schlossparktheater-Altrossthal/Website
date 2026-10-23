import { formatCents } from "@/lib/format/money";
import { cn } from "@/lib/utils";

/** Balken Ausgegeben + Offen gegen das Budget, wie im Mockup (docs/Plan/mockups/finanzen-mockup.html). */
export function BudgetBar({
  plannedCents,
  spentCents,
  openCents,
  className,
}: {
  plannedCents: number;
  spentCents: number;
  openCents: number;
  className?: string;
}) {
  const used = spentCents + openCents;
  const over = plannedCents > 0 && used > plannedCents;
  const base = Math.max(plannedCents, used, 1);
  const spentPct = Math.max(0, (spentCents / base) * 100);
  const openPct = Math.max(0, (openCents / base) * 100);
  const freeCents = plannedCents - used;
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline gap-1.5">
        <span className={cn("text-2xl font-bold tabular-nums", over && "text-destructive")}>
          {formatCents(spentCents)}
        </span>
        <span className="text-sm text-muted-foreground">von {formatCents(plannedCents)}</span>
      </div>
      <div
        className="flex h-2.5 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${formatCents(spentCents)} ausgegeben, ${formatCents(openCents)} offen, Budget ${formatCents(plannedCents)}`}
      >
        <span
          className={cn("h-full", over ? "bg-destructive" : "bg-primary")}
          style={{ width: `${spentPct}%` }}
        />
        <span className="h-full bg-primary/40" style={{ width: `${openPct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">
        <span
          className={cn(
            "mr-1 inline-block size-2 rounded-sm",
            over ? "bg-destructive" : "bg-primary",
          )}
        />
        ausgegeben {formatCents(spentCents)}
        {openCents ? (
          <>
            {" · "}
            <span className="mr-1 inline-block size-2 rounded-sm bg-primary/40" />
            offen {formatCents(openCents)}
          </>
        ) : null}
        {" · "}
        {freeCents >= 0 ? (
          `frei ${formatCents(freeCents)}`
        ) : (
          <span className="font-medium text-destructive">{formatCents(-freeCents)} drüber</span>
        )}
      </p>
    </div>
  );
}

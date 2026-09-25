import { cn } from "@/lib/utils";

type AvailabilityBarProps = {
  total: number;
  blocked: number;
  limited: number;
  /** Beschriftung „40/43“ rechts neben dem Balken. */
  showCount?: boolean;
  className?: string;
};

/**
 * Wie viele sind an einem Tag da? Grün = verfügbar, gelb = eingeschränkt, rot = gesperrt.
 * Vorbild: Verfügbarkeits-Heatmaps aus Terminplanern (Doodle, When2meet).
 */
export function AvailabilityBar({
  total,
  blocked,
  limited,
  showCount = true,
  className,
}: AvailabilityBarProps) {
  const safeTotal = Math.max(total, 1);
  const available = Math.max(total - blocked - limited, 0);
  const label = `${available} von ${total} verfügbar${limited ? `, ${limited} eingeschränkt` : ""}${blocked ? `, ${blocked} gesperrt` : ""}`;
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)} title={label}>
      <span
        className="flex h-1.5 min-w-8 flex-1 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={label}
      >
        <span className="bg-success/70" style={{ width: `${(available / safeTotal) * 100}%` }} />
        <span className="bg-warning" style={{ width: `${(limited / safeTotal) * 100}%` }} />
        <span className="bg-destructive" style={{ width: `${(blocked / safeTotal) * 100}%` }} />
      </span>
      {showCount ? (
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground" aria-hidden>
          {available}/{total}
        </span>
      ) : null}
    </span>
  );
}

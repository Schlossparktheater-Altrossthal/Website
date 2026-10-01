import { daysUntil } from "@/lib/planning/schedule";
import type { MilestoneHealth } from "@/lib/planning/schedule";
import { cn } from "@/lib/utils";

import { HEALTH_BADGE, healthFromDays } from "./health";

export function formatRelativeDays(days: number): string {
  if (days === 0) return "heute";
  if (days === 1) return "morgen";
  if (days === -1) return "seit gestern";
  return days > 0 ? `in ${days} T` : `seit ${-days} T`;
}

/** Fristabzeichen rechts auf Karten und Zeilen, in der Ampelfarbe. */
export function DeadlineBadge({
  dueAt,
  now = new Date(),
  health,
  className,
}: {
  dueAt: Date;
  now?: Date;
  health?: MilestoneHealth;
  className?: string;
}) {
  const days = daysUntil(dueAt, now) ?? 0;
  const tone = health ?? healthFromDays(days);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium tabular-nums",
        HEALTH_BADGE[tone],
        className,
      )}
    >
      {tone === "done" ? "erledigt" : formatRelativeDays(days)}
    </span>
  );
}

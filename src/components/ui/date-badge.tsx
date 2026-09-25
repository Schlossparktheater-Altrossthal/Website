import { cn } from "@/lib/utils";

const TIME_ZONE = "Europe/Berlin";
const WEEKDAY = new Intl.DateTimeFormat("de-DE", { weekday: "short", timeZone: TIME_ZONE });
const DAY = new Intl.DateTimeFormat("de-DE", { day: "numeric", timeZone: TIME_ZONE });
const MONTH = new Intl.DateTimeFormat("de-DE", { month: "long", timeZone: TIME_ZONE });

/** Kalenderblatt (Wochentag + Tag) als `leading` für ListRows. */
export function DateBadge({
  date,
  tone = "muted",
  className,
}: {
  date: Date;
  tone?: "muted" | "primary";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex h-11 w-11 flex-col items-center justify-center rounded-md leading-none",
        tone === "primary" ? "bg-primary/12 text-primary" : "bg-muted/60",
        className,
      )}
    >
      <span
        className={cn(
          "text-[0.625rem] font-medium uppercase",
          tone === "primary" ? "text-primary" : "text-muted-foreground",
        )}
      >
        {WEEKDAY.format(date).replace(".", "")}
      </span>
      <span
        className={cn(
          "text-base font-semibold tabular-nums",
          tone === "primary" ? "text-primary" : "text-foreground",
        )}
      >
        {DAY.format(date).replace(".", "")}
      </span>
      <span className="sr-only">{MONTH.format(date)}</span>
    </span>
  );
}

import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { DateBadge } from "@/components/ui/date-badge";
import type { MyEventItem } from "@/lib/calendar/my-events";
import { DEFAULT_TIME_ZONE } from "@/lib/date-time";
import { cn } from "@/lib/utils";

import { DeclineControl } from "./decline-control";

const DAY = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  timeZone: DEFAULT_TIME_ZONE,
});
const TIME = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: DEFAULT_TIME_ZONE,
});

export function formatTimeRange(start: Date, end: Date | null) {
  return `${TIME.format(start)}${end ? `–${TIME.format(end)}` : ""} Uhr`;
}

export function formatWhen(item: MyEventItem) {
  const start = new Date(item.start);
  if (item.allDay) return `${DAY.format(start)} · ganztägig`;
  return `${DAY.format(start)} · ${formatTimeRange(start, item.end ? new Date(item.end) : null)}`;
}

/** Eine Zeile als Kalenderblatt: Datumsblock links, alles Weitere rechts daneben. */
export function MyEventRow({ item, className }: { item: MyEventItem; className?: string }) {
  const start = new Date(item.start);
  const optional = item.group === "optional";

  return (
    <li
      className={cn(
        "flex items-start gap-3 border-t border-border py-3 first:border-t-0",
        item.decline?.declined && "opacity-70",
        className,
      )}
    >
      <DateBadge date={start} tone={optional ? "muted" : "primary"} />

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {item.href ? (
            <Link href={item.href} className="text-sm font-semibold hover:underline">
              {item.title}
            </Link>
          ) : (
            <span className="text-sm font-semibold">{item.title}</span>
          )}
          <Badge variant="outline">{item.label}</Badge>
          {optional ? <Badge variant="warning">optional</Badge> : null}
        </div>

        <p className="text-xs text-muted-foreground">
          {formatWhen(item)}
          {item.location ? ` · ${item.location}` : item.locationOpen ? " · Ort noch offen" : ""}
        </p>

        {item.fullTime ? (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Deine Zeit:</span>{" "}
            {formatTimeRange(start, item.end ? new Date(item.end) : null)} · gesamte Probe{" "}
            {formatTimeRange(
              new Date(item.fullTime.start),
              item.fullTime.end ? new Date(item.fullTime.end) : null,
            )}
          </p>
        ) : null}

        {item.reasons.length ? (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Dabei als:</span>{" "}
            {item.reasons.join(" · ")}
          </p>
        ) : null}

        {/* Vergangenes lässt sich nicht mehr absagen – der Server lehnt es ohnehin ab. */}
        {item.decline && item.bucket !== "past" ? (
          <DeclineControl
            eventId={item.id}
            title={item.title}
            declined={item.decline.declined}
            note={item.decline.note}
            tentative={item.decline.tentative}
            emergency={item.decline.emergency}
            withinFreeze={item.withinFreeze}
          />
        ) : null}
      </div>
    </li>
  );
}

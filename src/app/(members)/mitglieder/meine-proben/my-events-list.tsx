"use client";

import Link from "next/link";
import { useState } from "react";

import { CalendarIcon } from "@/components/ui/action-icons";
import { Badge } from "@/components/ui/badge";
import { DateBadge } from "@/components/ui/date-badge";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { MyEventBucket, MyEventGroup, MyEventItem } from "@/lib/calendar/my-events";
import { DEFAULT_TIME_ZONE } from "@/lib/date-time";
import { cn } from "@/lib/utils";

import { DeclineControl } from "./decline-control";

type Filter = "all" | MyEventGroup;

const FILTER_LABELS: Record<Filter, string> = {
  all: "Alle",
  required: "Muss ich hin",
  optional: "Optional",
  club: "Für alle",
};

const BUCKET_LABELS: Record<Exclude<MyEventBucket, "past">, string> = {
  today: "Heute & Morgen",
  week: "Diese Woche",
  later: "Später",
};

/** Reihenfolge der Abschnitte; „Vergangen" folgt später (Phase 3) ganz unten. */
const BUCKET_ORDER = ["today", "week", "later"] as const;

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

function formatTimeRange(start: Date, end: Date | null) {
  return `${TIME.format(start)}${end ? `–${TIME.format(end)}` : ""} Uhr`;
}

function formatWhen(item: MyEventItem) {
  const start = new Date(item.start);
  if (item.allDay) return `${DAY.format(start)} · ganztägig`;
  return `${DAY.format(start)} · ${formatTimeRange(start, item.end ? new Date(item.end) : null)}`;
}

/** Eine Zeile als Kalenderblatt: Datumsblock links, alles Weitere rechts daneben. */
function MyEventRow({ item }: { item: MyEventItem }) {
  const start = new Date(item.start);
  const optional = item.group === "optional";

  return (
    <li
      className={cn(
        "flex items-start gap-3 border-t border-border py-3 first:border-t-0",
        item.decline?.declined && "opacity-70",
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

        {item.decline ? (
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

/** Leerzustand nach dem Muster aus `docs/design-system.md`: zentriert, gedämpft, Icon optional. */
function EmptyState({ filtered }: { filtered: boolean }) {
  if (filtered) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        In dieser Auswahl stehen gerade keine Termine an.
      </div>
    );
  }

  return (
    <div className="py-12 text-center text-sm text-muted-foreground">
      <CalendarIcon className="mx-auto mb-3 h-8 w-8 text-muted-foreground" aria-hidden />
      <p>Sobald du zu Terminen eingeladen wirst, erscheinen sie hier.</p>
    </div>
  );
}

export function MyEventsList({ items }: { items: MyEventItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const counts = items.reduce<Record<MyEventGroup, number>>(
    (acc, item) => ({ ...acc, [item.group]: acc[item.group] + 1 }),
    { required: 0, optional: 0, club: 0 },
  );
  const options = (["all", "required", "optional", "club"] as const)
    .filter((value) => value === "all" || counts[value] > 0)
    .map((value) => ({ value, label: FILTER_LABELS[value] }));
  const visible = filter === "all" ? items : items.filter((item) => item.group === filter);

  return (
    <div className="space-y-4">
      {options.length > 2 ? (
        <SegmentedControl
          value={filter}
          onValueChange={setFilter}
          options={options}
          fullWidth
          className="sm:w-auto"
          aria-label="Termine filtern"
        />
      ) : null}
      {visible.length ? (
        <div className="space-y-6">
          {BUCKET_ORDER.map((bucket) => {
            const bucketItems = visible.filter((item) => item.bucket === bucket);
            if (!bucketItems.length) return null;
            return (
              <section key={bucket} className="space-y-1">
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {BUCKET_LABELS[bucket]} ({bucketItems.length})
                </h3>
                <ul>
                  {bucketItems.map((item) => (
                    <MyEventRow key={`${item.group}-${item.id}`} item={item} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <EmptyState filtered={items.length > 0} />
      )}
    </div>
  );
}

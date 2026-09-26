"use client";

import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { MyEventGroup, MyEventItem } from "@/lib/calendar/my-events";

import { DeclineControl } from "./decline-control";

type Filter = "all" | MyEventGroup;

const FILTER_LABELS: Record<Filter, string> = {
  all: "Alle",
  required: "Muss ich hin",
  optional: "Optional",
  club: "Verein",
};

const DATE = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  timeZone: "Europe/Berlin",
});
const TIME = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Berlin",
});

function formatWhen(item: MyEventItem) {
  const start = new Date(item.start);
  if (item.allDay) return `${DATE.format(start)} · ganztägig`;
  const end = item.end ? `–${TIME.format(new Date(item.end))}` : "";
  return `${DATE.format(start)} · ${TIME.format(start)}${end} Uhr`;
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
        <ul className="space-y-3">
          {visible.map((item) => (
            <li key={`${item.group}-${item.id}`} className="space-y-1 rounded-lg bg-muted p-3">
              <div className="flex flex-wrap items-center gap-2">
                {item.href ? (
                  <Link
                    href={item.href}
                    className="text-sm font-semibold text-primary hover:underline"
                  >
                    {item.title}
                  </Link>
                ) : (
                  <span className="text-sm font-semibold">{item.title}</span>
                )}
                <Badge variant="outline">{item.label}</Badge>
                {item.group === "optional" ? (
                  <Badge variant="outline" className="border-warning bg-warning/10 text-warning">
                    optional
                  </Badge>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatWhen(item)}
                {item.location ? ` · ${item.location}` : ""}
              </p>
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
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {items.length
            ? "In dieser Auswahl stehen gerade keine Termine an."
            : "Sobald du zu Terminen eingeladen wirst, erscheinen sie hier."}
        </div>
      )}
    </div>
  );
}

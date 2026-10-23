"use client";

import { useEffect, useRef } from "react";
import type { EventStatus } from "@prisma/client";
import Link from "next/link";

import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { DEFAULT_TIME_ZONE } from "@/lib/format/date";
import { cn } from "@/lib/utils";

export type SwitcherEvent = {
  id: string;
  title: string;
  start: string;
  allDay: boolean;
  status: EventStatus;
  isRehearsal: boolean;
};

const DAY = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "numeric",
  month: "numeric",
  timeZone: DEFAULT_TIME_ZONE,
});
const TIME = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: DEFAULT_TIME_ZONE,
});

const href = (id: string) => `/mitglieder/terminplanung/${id}`;

/** Termine rund um den bearbeiteten – zum Durchwechseln, ohne zurück in den Kalender. */
export function EventSwitcherList({
  events,
  currentId,
}: {
  events: readonly SwitcherEvent[];
  currentId: string;
}) {
  const currentRef = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "center" });
  }, [currentId]);

  return (
    <nav aria-label="Weitere Termine" className="flex min-h-0 flex-col">
      <p className="px-2 pb-2 text-xs font-medium text-muted-foreground">Termine</p>
      <ul className="min-h-0 space-y-0.5 overflow-y-auto overscroll-contain pr-1">
        {events.map((event, index) => {
          const date = new Date(event.start);
          const day = DAY.format(date);
          const previous = events[index - 1];
          const showDay = !previous || DAY.format(new Date(previous.start)) !== day;
          const current = event.id === currentId;
          return (
            <li key={event.id}>
              {showDay ? (
                <p className="px-2 pb-0.5 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {day}
                </p>
              ) : null}
              <Link
                ref={current ? currentRef : undefined}
                href={href(event.id)}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted",
                  current && "bg-muted font-semibold",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "h-4 w-1 shrink-0 rounded-full",
                    event.isRehearsal ? "bg-info" : "bg-primary",
                    event.status === "DRAFT" && "opacity-40",
                  )}
                />
                <span className="w-10 shrink-0 text-xs tabular-nums text-muted-foreground">
                  {event.allDay ? "ganzt." : TIME.format(date)}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate",
                    event.status === "CANCELLED" && "text-muted-foreground line-through",
                  )}
                >
                  {event.title || (event.isRehearsal ? "Probe" : "Termin")}
                </span>
                {event.status === "DRAFT" ? (
                  <span className="shrink-0 text-[11px] text-muted-foreground">Entwurf</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Vorheriger/nächster Termin – auch dort, wo die Liste keinen Platz hat. */
export function EventSwitcherNav({
  events,
  currentId,
}: {
  events: readonly SwitcherEvent[];
  currentId: string;
}) {
  const index = events.findIndex((event) => event.id === currentId);
  const previous = index > 0 ? events[index - 1] : undefined;
  const next = index >= 0 ? events[index + 1] : undefined;
  const label = (event: SwitcherEvent) =>
    `${DAY.format(new Date(event.start))} · ${event.title || (event.isRehearsal ? "Probe" : "Termin")}`;
  return (
    <div className="flex items-center gap-1">
      <Button asChild={Boolean(previous)} variant="outline" size="sm" disabled={!previous}>
        {previous ? (
          <Link href={href(previous.id)} title={label(previous)}>
            <ChevronLeftIcon className="h-4 w-4" aria-hidden />
            <span className="sr-only sm:not-sr-only">Vorheriger</span>
          </Link>
        ) : (
          <span>
            <ChevronLeftIcon className="h-4 w-4" aria-hidden />
            <span className="sr-only sm:not-sr-only">Vorheriger</span>
          </span>
        )}
      </Button>
      <Button asChild={Boolean(next)} variant="outline" size="sm" disabled={!next}>
        {next ? (
          <Link href={href(next.id)} title={label(next)}>
            <span className="sr-only sm:not-sr-only">Nächster</span>
            <ChevronRightIcon className="h-4 w-4" aria-hidden />
          </Link>
        ) : (
          <span>
            <span className="sr-only sm:not-sr-only">Nächster</span>
            <ChevronRightIcon className="h-4 w-4" aria-hidden />
          </span>
        )}
      </Button>
    </div>
  );
}

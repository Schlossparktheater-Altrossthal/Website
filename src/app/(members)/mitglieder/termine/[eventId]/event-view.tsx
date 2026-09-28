"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Check, ChevronDown, CircleSlash, MapPin, Clock, CircleDashed } from "lucide-react";
import type { EventStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import type { TimelineRow } from "@/lib/calendar/event-timeline";
import { cn } from "@/lib/utils";

import { DeclineControl } from "../../meine-proben/decline-control";

export type EventPerson = {
  userId: string;
  name: string;
  me: boolean;
  group: "required" | "optional" | "declined";
  reasons: string[];
  window: { start: string; end: string } | null;
  note: string | null;
};

type EventInfo = {
  id: string;
  title: string;
  kindLabel: string;
  production: string | null;
  status: EventStatus;
  start: string;
  end: string | null;
  allDay: boolean;
  location: string | null;
  description: string | null;
  past: boolean;
};

type Me = {
  window: { start: string; end: string } | null;
  invited: boolean;
  optional: boolean;
  declined: boolean;
  emergency: boolean;
  note: string | null;
  canRespond: boolean;
  withinFreeze: boolean;
  mySceneCount: number;
};

const TZ = "Europe/Berlin";
const DATE = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: TZ,
});
const TIME = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: TZ });

const time = (iso: string) => TIME.format(new Date(iso));
const span = (start: string, end: string | null) =>
  end ? `${time(start)}–${time(end)}` : time(start);

const STATUS_BADGE: Partial<Record<EventStatus, string>> = {
  DRAFT: "Entwurf",
  TENTATIVE: "vorgemerkt",
  CANCELLED: "abgesagt",
};

const GROUP_LABELS: Record<EventPerson["group"], string> = {
  required: "Dabei",
  optional: "Optional",
  declined: "Abgesagt",
};

/** Aktuelle Uhrzeit, erst nach dem Laden (vermeidet Abweichungen beim Hydrieren). */
function subscribeMinute(onChange: () => void) {
  const timer = setInterval(onChange, 60_000);
  return () => clearInterval(timer);
}
const minuteNow = () => Math.floor(Date.now() / 60_000) * 60_000;

function useNow() {
  return useSyncExternalStore(subscribeMinute, minuteNow, () => null);
}

function OutcomeIcon({ outcome }: { outcome: "DONE" | "PARTIAL" | "SKIPPED" | null }) {
  if (outcome === "DONE") return <Check className="size-4 text-success" aria-label="geschafft" />;
  if (outcome === "PARTIAL")
    return <CircleDashed className="size-4 text-warning" aria-label="teilweise" />;
  if (outcome === "SKIPPED")
    return <CircleSlash className="size-4 text-muted-foreground" aria-label="nicht geprobt" />;
  return null;
}

function Timeline({ rows, past }: { rows: TimelineRow[]; past: boolean }) {
  const now = useNow();
  const hasMine = rows.some((row) => row.blocks.some((block) => block.mine));
  const [onlyMine, setOnlyMine] = useState(false);
  const visible = onlyMine
    ? rows
        .map((row) => ({ ...row, blocks: row.blocks.filter((block) => block.mine) }))
        .filter((row) => row.blocks.length)
    : rows;
  // „Jetzt“-Linie vor der ersten Zeile, die noch nicht vorbei ist.
  const nowIndex =
    now === null || past
      ? -1
      : visible.findIndex((row) => row.end && new Date(row.end).getTime() > now);
  const firstStarted =
    nowIndex >= 0 &&
    visible[nowIndex].start &&
    new Date(visible[nowIndex].start!).getTime() <= now!;
  const showNowLine =
    nowIndex > 0 ||
    (nowIndex === 0 && visible[0].start && new Date(visible[0].start).getTime() <= now!);

  if (!rows.length) {
    return (
      <p className="py-6 text-sm text-muted-foreground">
        Für diesen Termin ist noch kein Ablauf geplant.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {hasMine ? (
        <label className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
          nur meine
          <Switch checked={onlyMine} onCheckedChange={setOnlyMine} aria-label="Nur meine Punkte" />
        </label>
      ) : null}
      <ol className="relative">
        {visible.map((row, index) => {
          const running = index === nowIndex && firstStarted;
          return (
            <li key={row.blocks[0].id}>
              {showNowLine && index === nowIndex && !running ? <NowLine now={now!} /> : null}
              <div className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-3 py-1.5">
                <div className="pt-2 text-right text-xs tabular-nums text-muted-foreground">
                  {row.start ? time(row.start) : ""}
                </div>
                <div
                  className={cn(
                    "grid gap-1.5 border-l-2 pl-3",
                    running ? "border-primary" : "border-border",
                    row.blocks.length > 1 && "sm:grid-cols-2",
                  )}
                >
                  {row.blocks.length > 1 ? (
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground sm:col-span-2">
                      {row.blocks.length} parallel
                    </p>
                  ) : null}
                  {row.blocks.map((block) => (
                    <div
                      key={block.id}
                      className={cn(
                        "rounded-md px-3 py-2",
                        block.mine ? "bg-primary/10 ring-1 ring-primary/40" : "bg-muted/60",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-snug">
                          {block.label}
                          {block.mine ? (
                            <span className="ml-1.5 text-xs font-normal text-primary">· du</span>
                          ) : null}
                        </p>
                        <OutcomeIcon outcome={block.outcome} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {[
                          block.startsAt && block.endsAt
                            ? span(block.startsAt, block.endsAt)
                            : null,
                          block.location,
                          block.who,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {block.description ? (
                        <p className="mt-1 text-xs text-muted-foreground">{block.description}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function NowLine({ now }: { now: number }) {
  return (
    <div className="grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-3" aria-label="Jetzt">
      <span className="text-right text-xs font-semibold tabular-nums text-primary">
        {TIME.format(new Date(now))}
      </span>
      <span className="h-0.5 rounded bg-primary" />
    </div>
  );
}

function People({ people }: { people: EventPerson[] }) {
  if (!people.length) {
    return (
      <p className="py-6 text-sm text-muted-foreground">
        Dieser Termin gilt für alle – es gibt keine Einladungsliste.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {(["required", "optional", "declined"] as const).map((group) => {
        const list = people.filter((person) => person.group === group);
        if (!list.length) return null;
        return (
          <section key={group} className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {GROUP_LABELS[group]} · {list.length}
            </h3>
            <ul className="divide-y divide-border">
              {list.map((person) => (
                <li key={person.userId} className="flex items-baseline justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className={cn("truncate text-sm", person.me && "font-semibold")}>
                      {person.name}
                      {person.me ? <span className="font-normal text-primary"> · du</span> : null}
                    </p>
                    {person.reasons.length || person.note ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {person.note ? `„${person.note}“` : person.reasons.join(" · ")}
                      </p>
                    ) : null}
                  </div>
                  {person.window && group !== "declined" ? (
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {span(person.window.start, person.window.end)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function EventView({
  event,
  me,
  editHref,
  editLabel,
  rows,
  people,
}: {
  event: EventInfo;
  me: Me | null;
  editHref: string | null;
  editLabel: string;
  rows: TimelineRow[];
  people: EventPerson[];
}) {
  const [tab, setTab] = useState<"ablauf" | "leute">("ablauf");
  const attending = people.filter((person) => person.group !== "declined").length;
  const statusBadge = STATUS_BADGE[event.status];

  return (
    <div className="space-y-5">
      {/* Kopf: wann, wo, meine Rolle */}
      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{event.kindLabel}</span>
              {event.production ? <span>· {event.production}</span> : null}
              {statusBadge ? (
                <Badge
                  variant="outline"
                  className={cn(
                    event.status === "CANCELLED" && "border-destructive text-destructive",
                  )}
                >
                  {statusBadge}
                </Badge>
              ) : null}
            </div>
            <p className="flex items-center gap-2 text-sm font-medium">
              <Clock className="size-4 text-muted-foreground" aria-hidden />
              {DATE.format(new Date(event.start))} ·{" "}
              {event.allDay ? "ganztägig" : `${span(event.start, event.end)} Uhr`}
            </p>
            {event.location ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="size-4" aria-hidden />
                {event.location}
              </p>
            ) : null}
          </div>
          {editHref ? (
            <Button asChild variant="outline" size="sm">
              <Link href={editHref}>{editLabel}</Link>
            </Button>
          ) : null}
        </div>

        {me ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-3 text-sm">
            <span className="font-medium">
              {me.declined
                ? "Du hast abgesagt"
                : me.window
                  ? `Deine Zeit: ${span(me.window.start, me.window.end)} Uhr`
                  : !me.invited
                    ? "Termin für alle"
                    : me.optional
                      ? "Du bist optional eingeladen"
                      : "Du bist eingeladen"}
            </span>
            {!me.declined && me.mySceneCount ? (
              <span className="text-muted-foreground">
                {me.mySceneCount} {me.mySceneCount === 1 ? "Punkt" : "Punkte"} mit dir
              </span>
            ) : null}
            {me.canRespond ? (
              <div className="ml-auto">
                <DeclineControl
                  eventId={event.id}
                  title={event.title}
                  declined={me.declined}
                  note={me.note}
                  tentative={event.status === "TENTATIVE"}
                  emergency={me.emergency}
                  withinFreeze={me.withinFreeze}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {event.description ? (
          <Collapsible className="border-t border-border pt-2">
            <CollapsibleTrigger className="group flex w-full items-center justify-between py-1 text-sm font-medium">
              Beschreibung
              <ChevronDown
                className="size-4 transition-transform group-data-[state=open]:rotate-180"
                aria-hidden
              />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div
                className="prose prose-sm max-w-none pt-2 text-foreground prose-headings:text-foreground prose-a:text-primary"
                dangerouslySetInnerHTML={{ __html: event.description }}
              />
            </CollapsibleContent>
          </Collapsible>
        ) : null}
      </div>

      {/* Mobil umschaltbar, Desktop nebeneinander */}
      <SegmentedControl
        value={tab}
        onValueChange={setTab}
        options={[
          { value: "ablauf" as const, label: "Ablauf" },
          { value: "leute" as const, label: `Leute · ${attending}` },
        ]}
        fullWidth
        className="lg:hidden"
        aria-label="Ansicht wählen"
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className={cn(tab === "ablauf" ? "block" : "hidden", "lg:block")}>
          <h2 className="mb-2 hidden text-sm font-semibold lg:block">Ablauf</h2>
          <Timeline rows={rows} past={event.past} />
        </section>
        <section className={cn(tab === "leute" ? "block" : "hidden", "lg:block")}>
          <h2 className="mb-2 hidden text-sm font-semibold lg:block">Leute · {attending}</h2>
          <People people={people} />
        </section>
      </div>
    </div>
  );
}

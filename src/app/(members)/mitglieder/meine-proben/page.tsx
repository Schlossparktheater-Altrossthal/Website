import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/members/page-header";
import {
  AlertIcon,
  CalendarCheckIcon,
  CalendarIcon,
  InfoIcon,
  ListIcon,
  SearchIcon,
  TrashIcon,
} from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { readEventView } from "@/lib/calendar/event-view-server";
import {
  MY_EVENTS_PAGE_SIZE,
  readMyUpcomingEvents,
  readNextEvent,
  type MyEventGroup,
} from "@/lib/calendar/my-events";
import { formatIsoDateInTimeZone } from "@/lib/date-time";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { cn } from "@/lib/utils";

import { EventView } from "../termine/[eventId]/event-view";
import { formatWhen } from "./my-event-row";
import { MyEventsCalendar } from "./my-events-calendar";
import { MyEventsList } from "./my-events-list";

const ROUTE = "/mitglieder/meine-proben";
const MAX_LIMIT = 300;

const GROUP_LABELS: Record<MyEventGroup | "all", string> = {
  all: "Alle",
  required: "Muss hin",
  optional: "Optional",
  club: "Für alle",
};

/** Kurzer Countdown für das Widget: erst Stunden, dann Tage – gerechnet in Berliner Tagen. */
function formatCountdown(start: Date, now: Date) {
  const diffMs = start.getTime() - now.getTime();
  if (diffMs <= 0) return "läuft gerade";

  const hours = Math.round(diffMs / (60 * 60 * 1000));
  if (hours < 6) return `in ${Math.max(1, hours)} Stunde${hours <= 1 ? "" : "n"}`;

  const dayOf = (date: Date) =>
    Date.parse(`${formatIsoDateInTimeZone(date.toISOString())}T12:00:00Z`);
  const days = Math.round((dayOf(start) - dayOf(now)) / (24 * 60 * 60 * 1000));
  if (days <= 0) return "heute";
  if (days === 1) return "morgen";
  return `in ${days} Tagen`;
}

type SearchParams = {
  ansicht?: string;
  gruppe?: string;
  q?: string;
  vergangen?: string;
  mehr?: string;
  termin?: string;
};

export default async function MyRehearsalsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "PRIVATE.REHEARSAL.OWN.VIEW");
  if (!allowed) {
    return (
      <div className="text-sm text-destructive">
        Kein Zugriff auf die persönliche Probenübersicht.
      </div>
    );
  }

  const userId = session.user?.id;
  if (!userId) {
    notFound();
  }

  const params = await searchParams;
  const view = params.ansicht === "kalender" ? "kalender" : "liste";
  const past = params.vergangen === "1";
  const term = (params.q ?? "").trim().slice(0, 80);
  const requestedLimit = Number.parseInt(params.mehr ?? "", 10);
  const limit =
    Number.isFinite(requestedLimit) && requestedLimit > 0 ? requestedLimit : MY_EVENTS_PAGE_SIZE;
  const activeGroup: MyEventGroup | "all" =
    params.gruppe === "required" || params.gruppe === "optional" || params.gruppe === "club"
      ? params.gruppe
      : "all";

  const now = new Date();
  const items = await readMyUpcomingEvents(userId, { now, past, search: term, limit });
  const next = await readNextEvent(userId, now);

  /** Link auf dieselbe Seite mit geänderten Parametern – der Zustand steht komplett in der URL. */
  const href = (overrides: Partial<SearchParams>) => {
    const merged: SearchParams = {
      ansicht: view === "kalender" ? "kalender" : undefined,
      gruppe: activeGroup === "all" ? undefined : activeGroup,
      q: term || undefined,
      vergangen: past ? "1" : undefined,
      mehr: params.mehr,
      termin: params.termin,
      ...overrides,
    };
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(merged)) {
      if (value) query.set(key, value);
    }
    const queryString = query.toString();
    return queryString ? `${ROUTE}?${queryString}` : ROUTE;
  };

  const counts = items.reduce<Record<MyEventGroup, number>>(
    (acc, item) => ({ ...acc, [item.group]: acc[item.group] + 1 }),
    { required: 0, optional: 0, club: 0 },
  );
  const groupChips = (["all", "required", "optional", "club"] as const)
    .filter((id) => id === "all" || counts[id] > 0)
    .map((id) => ({
      id,
      label: GROUP_LABELS[id],
      count: id === "all" ? items.length : counts[id],
      href: href({ gruppe: id === "all" ? undefined : id, termin: undefined }),
    }));

  const todayKey = formatIsoDateInTimeZone(now.toISOString());
  const tomorrowKey = formatIsoDateInTimeZone(new Date(now.getTime() + 86_400_000).toISOString());
  const hasMore = items.length >= limit && limit < MAX_LIMIT;
  const breadcrumbs = [membersNavigationBreadcrumb(ROUTE)];

  // Desktop: gewählter Termin (sonst der nächste) als Vorschau neben der Liste.
  const selectedId =
    view === "liste" ? (params.termin ?? (past ? items[0]?.id : next?.id) ?? null) : null;
  const preview = selectedId ? await readEventView(selectedId, session.user, userId) : null;

  const tips = (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Hinweise zu Absagen und Sperrliste">
          <InfoIcon className="h-4 w-4" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <ul className="space-y-3 text-sm text-muted-foreground">
          <li className="flex gap-2.5">
            <CalendarCheckIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              Abwesenheiten früh in die Sperrliste eintragen – dann weiß die Planung Bescheid.
            </span>
          </li>
          <li className="flex gap-2.5">
            <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
            <span>Kurzfristig nur noch als Notfall absagen, mit kurzer Begründung.</span>
          </li>
          <li className="flex gap-2.5">
            <TrashIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>Einträge in der Sperrliste lassen sich jederzeit wieder entfernen.</span>
          </li>
        </ul>
      </PopoverContent>
    </Popover>
  );

  const chip =
    "inline-flex min-h-9 items-center gap-1 rounded-full px-2 text-[13px] transition-colors hover:bg-muted sm:px-3 sm:text-sm";

  return (
    <div className="space-y-4">
      <PageHeader title="Meine Termine" breadcrumbs={breadcrumbs} />

      {/* Werkzeugzeile: Ansicht, Filter, Suche – mobil eine Zeile */}
      <div className="flex flex-wrap items-center gap-1.5 sm:flex-nowrap sm:gap-2">
        <nav aria-label="Ansicht" className="flex shrink-0 rounded-full bg-muted p-0.5">
          {(
            [
              ["liste", ListIcon, "Liste"],
              ["kalender", CalendarIcon, "Kalender"],
            ] as const
          ).map(([id, Icon, label]) => (
            <Link
              key={id}
              href={href({ ansicht: id === "kalender" ? "kalender" : undefined, mehr: undefined })}
              aria-label={label}
              aria-current={view === id ? "page" : undefined}
              className={cn(
                "flex size-9 items-center justify-center rounded-full text-muted-foreground",
                view === id && "bg-background text-foreground shadow-sm ring-1 ring-border",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
            </Link>
          ))}
        </nav>

        {view === "liste" && groupChips.length > 2 ? (
          <nav
            aria-label="Termine filtern"
            className="order-last flex w-full min-w-0 justify-between gap-0.5 sm:order-none sm:w-auto sm:flex-1 sm:justify-start sm:gap-1"
          >
            {groupChips.map((entry) => (
              <Link
                key={entry.id}
                href={entry.href}
                aria-current={activeGroup === entry.id ? "page" : undefined}
                className={cn(
                  chip,
                  activeGroup === entry.id
                    ? "bg-background font-medium shadow-sm ring-1 ring-border"
                    : "text-muted-foreground",
                )}
              >
                {entry.label}
                <span className="text-xs tabular-nums text-muted-foreground">{entry.count}</span>
              </Link>
            ))}
          </nav>
        ) : (
          <div className="hidden flex-1 sm:block" />
        )}
        <div className="flex-1 sm:hidden" />
        {tips}
        {view === "liste" ? (
          <details className="group relative shrink-0">
            <summary
              className="flex size-9 cursor-pointer list-none items-center justify-center rounded-full text-muted-foreground hover:bg-muted [&::-webkit-details-marker]:hidden"
              aria-label="Termin suchen"
            >
              <SearchIcon className="h-4 w-4" aria-hidden />
            </summary>
            <form
              role="search"
              action={ROUTE}
              className="absolute right-0 z-20 mt-1 flex w-72 max-w-[calc(100vw-2rem)] gap-2 rounded-lg border border-border bg-popover p-2 shadow-md"
            >
              {activeGroup !== "all" ? (
                <input type="hidden" name="gruppe" value={activeGroup} />
              ) : null}
              {past ? <input type="hidden" name="vergangen" value="1" /> : null}
              <Input
                type="search"
                name="q"
                defaultValue={term}
                placeholder="Titel oder Ort"
                aria-label="Titel oder Ort"
                className="h-9"
                autoFocus
              />
              <Button type="submit" variant="outline" size="sm">
                Suchen
              </Button>
            </form>
          </details>
        ) : null}
      </div>

      {term ? (
        <p className="text-sm text-muted-foreground">
          Suche nach „{term}“ ·{" "}
          <Link href={href({ q: undefined })} className="text-primary hover:underline">
            zurücksetzen
          </Link>
        </p>
      ) : null}

      {/* Nächster Termin – auf breiten Bildschirmen übernimmt das die Vorschau. */}
      {next && !past && view === "liste" ? (
        <Link
          href={next.href ?? "#"}
          className="block rounded-lg border border-border bg-card p-3 hover:bg-muted xl:hidden"
        >
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">
            Nächster Termin · {formatCountdown(new Date(next.start), now)}
          </p>
          <p className="mt-1 text-sm font-semibold">{next.title}</p>
          <p className="text-xs text-muted-foreground">
            {formatWhen(next)}
            {next.location ? ` · ${next.location}` : next.locationOpen ? " · Ort noch offen" : ""}
          </p>
          {next.withinFreeze && next.decline && !next.decline.declined ? (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-warning">
              <AlertIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Innerhalb der Sperrfrist – absagen nur als Notfall.
            </p>
          ) : null}
        </Link>
      ) : null}

      <div
        className={cn(
          "grid gap-6",
          view === "liste" && "xl:grid-cols-[26rem_minmax(0,1fr)] xl:items-start",
        )}
      >
        <Card>
          <CardContent className="space-y-3 p-2 sm:p-3">
            {past ? <h2 className="px-2 pt-1 text-sm font-semibold">Vergangene Termine</h2> : null}
            {view === "kalender" ? (
              <MyEventsCalendar items={items} todayKey={todayKey} />
            ) : (
              <MyEventsList
                items={items}
                activeGroup={activeGroup}
                todayKey={todayKey}
                tomorrowKey={tomorrowKey}
                previewHref={(id) => href({ termin: id })}
                selectedId={selectedId}
              />
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
              <Button asChild variant="ghost" size="sm">
                <Link
                  href={href({
                    vergangen: past ? undefined : "1",
                    mehr: undefined,
                    termin: undefined,
                  })}
                >
                  {past ? "Anstehende Termine zeigen" : "Vergangene Termine zeigen"}
                </Link>
              </Button>
              {hasMore ? (
                <Button asChild variant="ghost" size="sm">
                  <Link href={href({ mehr: String(limit + MY_EVENTS_PAGE_SIZE) })}>Mehr laden</Link>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {view === "liste" ? (
          <aside className="hidden xl:sticky xl:top-4 xl:block" aria-label="Termin-Vorschau">
            {preview?.ok ? (
              <div className="space-y-2">
                <EventView key={selectedId} {...preview.props} layout="panel" />
                <Link
                  href={`/mitglieder/termine/${selectedId}`}
                  className="block text-right text-sm text-primary hover:underline"
                >
                  Als eigene Seite öffnen
                </Link>
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-muted-foreground">
                {preview?.message ?? "Wähle links einen Termin."}
              </div>
            )}
          </aside>
        ) : null}
      </div>
    </div>
  );
}

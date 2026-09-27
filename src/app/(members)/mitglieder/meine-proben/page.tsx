import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/members/page-header";
import { SearchIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SectionNav } from "@/components/ui/section-nav";
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
import type { SectionNavItem } from "@/lib/ui-standards";

import { formatWhen } from "./my-event-row";
import { MyEventsCalendar } from "./my-events-calendar";
import { MyEventsList } from "./my-events-list";

const ROUTE = "/mitglieder/meine-proben";
const MAX_LIMIT = 300;

const VIEWS = [
  { id: "liste", label: "Liste" },
  { id: "kalender", label: "Kalender" },
] as const;

const GROUP_LABELS: Record<MyEventGroup | "all", string> = {
  all: "Alle",
  required: "Muss ich hin",
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
  const groupItems: SectionNavItem[] = (["all", "required", "optional", "club"] as const)
    .filter((id) => id === "all" || counts[id] > 0)
    .map((id) => ({
      id,
      label: GROUP_LABELS[id],
      href: href({ gruppe: id === "all" ? undefined : id }),
    }));
  const viewItems: SectionNavItem[] = VIEWS.map((entry) => ({
    id: entry.id,
    label: entry.label,
    href: href({ ansicht: entry.id === "kalender" ? "kalender" : undefined, mehr: undefined }),
  }));

  const todayKey = formatIsoDateInTimeZone(now.toISOString());
  const hasMore = items.length >= limit && limit < MAX_LIMIT;
  const breadcrumbs = [membersNavigationBreadcrumb(ROUTE)];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meine Termine"
        description="Deine nächsten Termine – und warum du jeweils dabei bist."
        breadcrumbs={breadcrumbs}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <SectionNav items={viewItems} activeId={view} ariaLabel="Ansicht" />
          {view === "liste" && groupItems.length > 2 ? (
            <SectionNav items={groupItems} activeId={activeGroup} ariaLabel="Termine filtern" />
          ) : null}
        </div>

        {view === "liste" ? (
          <form role="search" action={ROUTE} className="flex w-full items-center gap-2 sm:w-auto">
            {activeGroup !== "all" ? (
              <input type="hidden" name="gruppe" value={activeGroup} />
            ) : null}
            {past ? <input type="hidden" name="vergangen" value="1" /> : null}
            <Input
              type="search"
              name="q"
              defaultValue={term}
              placeholder="Titel oder Ort"
              aria-label="Termin suchen"
              className="h-10 sm:w-64"
            />
            <Button type="submit" variant="outline" size="sm">
              <SearchIcon className="h-4 w-4" aria-hidden />
              Suchen
            </Button>
          </form>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.68fr)_minmax(0,0.32fr)] xl:gap-8">
        <div className="space-y-6">
          <Card>
            <CardHeader className="mb-2">
              <CardTitle>{past ? "Vergangene Termine" : "Anstehende Termine"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {view === "kalender" ? (
                <MyEventsCalendar items={items} todayKey={todayKey} />
              ) : (
                <MyEventsList items={items} activeGroup={activeGroup} />
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                <Button asChild variant="ghost" size="sm">
                  <Link href={href({ vergangen: past ? undefined : "1", mehr: undefined })}>
                    {past ? "Anstehende Termine zeigen" : "Vergangene Termine zeigen"}
                  </Link>
                </Button>
                {hasMore ? (
                  <Button asChild variant="ghost" size="sm">
                    <Link href={href({ mehr: String(limit + MY_EVENTS_PAGE_SIZE) })}>
                      Mehr laden
                    </Link>
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Dein nächster Termin</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {next ? (
                <>
                  <p className="text-sm font-semibold">{next.title}</p>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {formatCountdown(new Date(next.start), now)}
                    </span>
                    {" · "}
                    {formatWhen(next)}
                    {next.location
                      ? ` · ${next.location}`
                      : next.locationOpen
                        ? " · Ort noch offen"
                        : ""}
                  </p>
                  {next.reasons.length ? (
                    <p className="text-xs text-muted-foreground">
                      Dabei als: {next.reasons.join(" · ")}
                    </p>
                  ) : null}
                  {next.withinFreeze && next.decline ? (
                    <p className="text-xs text-warning">
                      Innerhalb der Sperrfrist – absagen geht nur als Notfall mit Begründung.
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Gerade ist nichts angesetzt.</p>
              )}
            </CardContent>
          </Card>

          <div className="rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground">
            <h2 className="mb-2 text-sm font-semibold text-foreground">Kurz gemerkt</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                Trage bekannte Abwesenheiten früh in die Sperrliste ein – dann weiß die Planung
                Bescheid.
              </li>
              <li>
                Innerhalb der Sperrfrist geht eine Absage nur noch als Notfall, mit kurzer
                Begründung. Die Planung wird sofort informiert.
              </li>
              <li>
                Einträge in der Sperrliste lassen sich jederzeit wieder entfernen – auch innerhalb
                der Frist.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

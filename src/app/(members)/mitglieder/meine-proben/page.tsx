import Link from "next/link";
import { notFound } from "next/navigation";
import { format, formatDistanceToNow, differenceInHours } from "date-fns";
import { de } from "date-fns/locale/de";
import { MembersListPage, FilterChips, FilterChip, SwipeActionsList, SwipeActionsItem } from "@/components/members/templates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { hasRole, requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";


type AttendanceStatus = "yes" | "no" | "emergency" | "maybe";
const STATUS_KEYS = ["yes", "no", "emergency", "maybe"] as const satisfies readonly AttendanceStatus[];
type KnownStatus = (typeof STATUS_KEYS)[number];
type StatusKey = KnownStatus | "open";

type StatusFilter = StatusKey | "all";

const STATUS_LABELS: Record<StatusKey, string> = {
  yes: "Zusage",
  no: "Absage",
  emergency: "Notfall",
  maybe: "Unentschieden",
  open: "Offen",
};

const STATUS_DESCRIPTIONS: Record<StatusKey, string> = {
  yes: "Du hast zugesagt und erscheinst bei der Probe.",
  no: "Du hast abgesagt. Die Planung weiß, dass du nicht dabei bist.",
  emergency: "Du hast einen Notfall gemeldet. Die Planung weiß Bescheid und kann reagieren.",
  maybe: "Du hast eine vorläufige Rückmeldung gespeichert. Bitte entscheide dich endgültig, sobald du Klarheit hast.",
  open: "Du hast dich noch nicht zurückgemeldet. Bitte bestätige, ob du teilnehmen kannst.",
};

const STATUS_BADGE_CLASSES: Record<StatusKey, string> = {
  yes: "border-emerald-200 bg-emerald-500/10 text-emerald-700",
  no: "border-rose-200 bg-rose-500/10 text-rose-700",
  emergency: "border-amber-200 bg-amber-500/10 text-amber-700",
  maybe: "border-sky-200 bg-sky-500/10 text-sky-700",
  open: "border-slate-200 bg-muted text-foreground",
};

function isKnownStatus(value: string | null | undefined): value is KnownStatus {
  return value ? (STATUS_KEYS as readonly string[]).includes(value) : false;
}

function toStatusKey(value: string | null | undefined): StatusKey {
  return isKnownStatus(value) ? value : "open";
}

function formatDateTime(date: Date) {
  return format(date, "EEEE, dd.MM.yyyy '·' HH:mm 'Uhr'", { locale: de });
}

function parseStatusFilter(value: string | string[] | undefined): StatusFilter {
  if (!value) return "all";
  const normalized = Array.isArray(value) ? value[0] : value;
  if (!normalized) return "all";
  if (normalized === "all") return "all";
  return toStatusKey(normalized);
}

type UpcomingWithStats = {
  id: string;
  title: string;
  start: Date;
  location: string;
  registrationDeadline: Date | null;
  counts: Record<KnownStatus, number>;
  myStatus: KnownStatus | null;
  responseCount: number;
};

type AttendanceHistoryEntry = {
  id: string;
  status: StatusKey;
  rehearsal: {
    id: string;
    title: string;
    start: Date;
    location: string;
  };
};

interface PageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MeineProbenPage({ searchParams }: PageProps) {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.meine-proben");
  const hasMeasurementPermission = await hasPermission(
    session.user,
    "mitglieder.koerpermasse",
  );
  const isEnsembleMember = hasRole(session.user, "cast");
  const canManageMeasurements = hasMeasurementPermission && isEnsembleMember;
  if (!allowed) {
    return <div className="text-sm text-red-600">Kein Zugriff auf die persönliche Probenübersicht.</div>;
  }

  const resolvedSearch = searchParams ? (await searchParams) ?? {} : {};
  const statusFilter = parseStatusFilter(resolvedSearch.status);

  const userId = session.user?.id;
  if (!userId) {
    notFound();
  }

  const now = new Date();

  const [upcomingRaw, historyRaw] = await Promise.all([
    prisma.rehearsal.findMany({
      where: { start: { gte: now }, status: { not: "DRAFT" } },
      orderBy: { start: "asc" },
      take: 8,
      include: {
        attendance: {
          select: { userId: true, status: true },
        },
      },
    }),
    prisma.rehearsalAttendance.findMany({
      where: {
        userId,
        rehearsal: { start: { lt: now }, status: { not: "DRAFT" } },
      },
      orderBy: { rehearsal: { start: "desc" } },
      take: 5,
      include: {
        rehearsal: {
          select: { id: true, title: true, start: true, location: true },
        },
      },
    }),
  ]);

  const upcoming: UpcomingWithStats[] = upcomingRaw.map((rehearsal) => {
    const counts: Record<KnownStatus, number> = {
      yes: 0,
      no: 0,
      emergency: 0,
      maybe: 0,
    };
    let myStatus: KnownStatus | null = null;

    for (const entry of rehearsal.attendance) {
      const status = entry.status as string;
      if (!isKnownStatus(status)) continue;
      counts[status] += 1;
      if (entry.userId === userId) {
        myStatus = status;
      }
    }

    const responseCount = STATUS_KEYS.reduce((acc, key) => acc + counts[key], 0);

    return {
      id: rehearsal.id,
      title: rehearsal.title,
      start: rehearsal.start,
      location: rehearsal.location,
      registrationDeadline: rehearsal.registrationDeadline ?? null,
      counts,
      myStatus,
      responseCount,
    };
  });

  const history: AttendanceHistoryEntry[] = historyRaw
    .filter((entry) => entry.rehearsal)
    .map((entry) => ({
      id: entry.id,
      status: toStatusKey(entry.status as string),
      rehearsal: {
        id: entry.rehearsal!.id,
        title: entry.rehearsal!.title,
        start: entry.rehearsal!.start,
        location: entry.rehearsal!.location,
      },
    }));

  const filteredUpcoming = statusFilter === "all"
    ? upcoming
    : upcoming.filter((item) => {
        const key = toStatusKey(item.myStatus);
        return key === statusFilter;
      });

  const nextRehearsal = upcoming[0] ?? null;
  const nextStatusKey: StatusKey = nextRehearsal ? toStatusKey(nextRehearsal.myStatus) : "open";

  const summary = upcoming.reduce(
    (acc, item) => {
      if (item.myStatus) {
        acc[item.myStatus] += 1;
      } else {
        acc.open += 1;
      }

      if (!item.myStatus && item.registrationDeadline) {
        if (item.registrationDeadline <= now) {
          acc.overdue += 1;
        } else if (differenceInHours(item.registrationDeadline, now) <= 72) {
          acc.dueSoon += 1;
        }
      }

      return acc;
    },
    {
      yes: 0,
      no: 0,
      emergency: 0,
      maybe: 0,
      open: 0,
      dueSoon: 0,
      overdue: 0,
    } as {
      yes: number;
      no: number;
      emergency: number;
      maybe: number;
      open: number;
      dueSoon: number;
      overdue: number;
    },
  );

  const pendingDeadlines = upcoming
    .filter((item) => !item.myStatus && item.registrationDeadline && item.registrationDeadline > now)
    .sort((a, b) => a.registrationDeadline!.getTime() - b.registrationDeadline!.getTime());
  const nextPendingDeadline = pendingDeadlines[0] ?? null;
  const breadcrumbs = [
    membersNavigationBreadcrumb("/mitglieder"),
    membersNavigationBreadcrumb("/mitglieder/meine-proben"),
  ];

  const statusFilterHref = (value: StatusFilter) => {
    const params = new URLSearchParams();
    for (const [key, rawValue] of Object.entries(resolvedSearch)) {
      if (key === "status") continue;
      const entryValue = Array.isArray(rawValue) ? rawValue[0] : rawValue;
      if (entryValue) {
        params.set(key, entryValue);
      }
    }
    if (value !== "all") {
      params.set("status", value);
    }
    const query = params.toString();
    return query.length ? `?${query}` : "";
  };

  const stickyCta = nextRehearsal ? (
    <Button asChild className="w-full">
      <Link href={`/mitglieder/proben/${nextRehearsal.id}`}>
        Zu &ldquo;{nextRehearsal.title}&rdquo; wechseln
      </Link>
    </Button>
  ) : undefined;

  const headerActions = canManageMeasurements ? (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="secondary">
        <Link href="/mitglieder/koerpermasse">Maße aktualisieren</Link>
      </Button>
    </div>
  ) : undefined;

  const statusFilters = (
    <FilterChips label="Status">
      <FilterChip href={statusFilterHref("all")} active={statusFilter === "all"}>
        Alle
      </FilterChip>
      <FilterChip href={statusFilterHref("open")} active={statusFilter === "open"}>
        Offen
      </FilterChip>
      {STATUS_KEYS.map((key) => (
        <FilterChip key={key} href={statusFilterHref(key)} active={statusFilter === key}>
          {STATUS_LABELS[key]}
        </FilterChip>
      ))}
    </FilterChips>
  );

  return (
    <MembersListPage
      title="Meine Proben"
      description="Persönliche Übersicht über deine nächsten Probentermine, Fristen und Rückmeldungen."
      breadcrumbs={breadcrumbs}
      actions={headerActions}
      filters={statusFilters}
      stickyCta={stickyCta}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.68fr)_minmax(0,0.32fr)] xl:gap-8">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Nächster Termin</CardTitle>
              <p className="text-sm text-muted-foreground">
                Deine nächste Probe inklusive Rückmeldefrist und aktuellem Status.
              </p>
            </CardHeader>
            <CardContent>
              {nextRehearsal ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-border/60 bg-background/60 p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <Link
                          href={`/mitglieder/proben/${nextRehearsal.id}`}
                          className="text-lg font-semibold text-primary hover:underline"
                        >
                          {nextRehearsal.title}
                        </Link>
                        <p className="text-sm text-muted-foreground">{formatDateTime(nextRehearsal.start)}</p>
                        <p className="text-xs text-muted-foreground/80">Ort: {nextRehearsal.location}</p>
                      </div>
                      <Badge variant="outline" className={cn("self-start text-sm", STATUS_BADGE_CLASSES[nextStatusKey])}>
                        {STATUS_LABELS[nextStatusKey]}
                      </Badge>
                    </div>
                    {nextRehearsal.registrationDeadline ? (
                      <div
                        className={cn(
                          "mt-4 rounded-md border px-3 py-2 text-xs sm:text-sm",
                          nextRehearsal.registrationDeadline <= now
                            ? "border-rose-200 bg-rose-50 text-rose-700"
                            : !nextRehearsal.myStatus && differenceInHours(nextRehearsal.registrationDeadline, now) <= 72
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-border/50 bg-muted/40 text-muted-foreground",
                        )}
                      >
                        <strong className="font-semibold">Rückmeldefrist:&nbsp;</strong>
                        {format(nextRehearsal.registrationDeadline, "dd.MM.yyyy 'um' HH:mm 'Uhr'", { locale: de })}
                        {" "}(
                        {formatDistanceToNow(nextRehearsal.registrationDeadline, { locale: de, addSuffix: true })})
                      </div>
                    ) : (
                      <div className="mt-4 rounded-md border border-border/50 bg-muted/40 px-3 py-2 text-xs sm:text-sm text-muted-foreground">
                        Für diesen Termin ist keine Rückmeldefrist hinterlegt.
                      </div>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-border/60 bg-background/60 p-3 text-sm text-muted-foreground">
                      <h4 className="mb-1 text-sm font-semibold text-foreground">Deine Rückmeldung</h4>
                      <p>{STATUS_DESCRIPTIONS[nextStatusKey]}</p>
                    </div>
                    <div className="rounded-lg border border-border/60 bg-background/60 p-3 text-sm text-muted-foreground">
                      <h4 className="mb-1 text-sm font-semibold text-foreground">Rückmeldungen im Ensemble</h4>
                      <div className="flex flex-wrap gap-2 text-[11px] sm:text-xs">
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-500/10 px-2 py-1 text-emerald-700">
                          ✔ {nextRehearsal.counts.yes} Zusagen
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-500/10 px-2 py-1 text-rose-700">
                          ✖ {nextRehearsal.counts.no} Absagen
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-500/10 px-2 py-1 text-amber-700">
                          ⚠ {nextRehearsal.counts.emergency} Notfälle
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-500/10 px-2 py-1 text-sky-700">
                          ? {nextRehearsal.counts.maybe} Unentschieden
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Bisher sind {nextRehearsal.responseCount} Rückmeldungen eingegangen.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aktuell ist keine kommende Probe geplant. Sobald ein neuer Termin veröffentlicht wird, erscheint er hier automatisch.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Anstehende Proben</CardTitle>
              <p className="text-sm text-muted-foreground">
                Alle bestätigten Termine der nächsten Wochen mit deinem jeweiligen Rückmeldungsstatus.
              </p>
            </CardHeader>
            <CardContent>
              {filteredUpcoming.length ? (
                <SwipeActionsList>
                  {filteredUpcoming.map((item) => {
                    const statusKey = toStatusKey(item.myStatus);
                    return (
                      <SwipeActionsItem
                        key={item.id}
                        actions={[
                          {
                            id: `open-${item.id}`,
                            label: "Details",
                            href: `/mitglieder/proben/${item.id}`,
                            tone: "primary",
                          },
                        ]}
                      >
                        <article className="space-y-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <Link
                                href={`/mitglieder/proben/${item.id}`}
                                className="font-semibold text-foreground hover:underline"
                              >
                                {item.title}
                              </Link>
                              <p className="text-sm text-muted-foreground">{formatDateTime(item.start)}</p>
                              <p className="text-xs text-muted-foreground/80">Ort: {item.location}</p>
                            </div>
                            <Badge
                              variant="outline"
                              className={cn("self-start", STATUS_BADGE_CLASSES[statusKey])}
                            >
                              {STATUS_LABELS[statusKey]}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="rounded-full bg-muted/40 px-2 py-1">
                              Zusagen: {item.counts.yes}
                            </span>
                            <span className="rounded-full bg-muted/40 px-2 py-1">
                              Absagen: {item.counts.no}
                            </span>
                            <span className="rounded-full bg-muted/40 px-2 py-1">
                              Notfälle: {item.counts.emergency}
                            </span>
                            <span className="rounded-full bg-muted/40 px-2 py-1">
                              Unentschieden: {item.counts.maybe}
                            </span>
                          </div>
                          {item.registrationDeadline ? (
                            <p className="text-xs text-muted-foreground">
                              Frist: {format(item.registrationDeadline, "dd.MM.yyyy '·' HH:mm 'Uhr'", { locale: de })}
                            </p>
                          ) : null}
                        </article>
                      </SwipeActionsItem>
                    );
                  })}
                </SwipeActionsList>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Für den gewählten Filter liegen keine Termine vor.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Deine Rückmeldungen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground">
                <div className="rounded-lg border border-emerald-200/70 bg-emerald-500/5 p-3 text-emerald-700">
                  <p className="text-xs uppercase tracking-wide">Zugesagt</p>
                  <p className="text-xl font-semibold">{summary.yes}</p>
                </div>
                <div className="rounded-lg border border-sky-200/70 bg-sky-500/5 p-3 text-sky-700">
                  <p className="text-xs uppercase tracking-wide">Unentschieden</p>
                  <p className="text-xl font-semibold">{summary.maybe}</p>
                </div>
                <div className="rounded-lg border border-rose-200/70 bg-rose-500/5 p-3 text-rose-700">
                  <p className="text-xs uppercase tracking-wide">Abgesagt</p>
                  <p className="text-xl font-semibold">{summary.no}</p>
                </div>
                <div className="rounded-lg border border-amber-200/70 bg-amber-500/5 p-3 text-amber-700">
                  <p className="text-xs uppercase tracking-wide">Offen</p>
                  <p className="text-xl font-semibold">{summary.open}</p>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                <p>Fällige Rückmeldungen in den nächsten 72 Stunden: {summary.dueSoon}</p>
                <p>Überfällige Rückmeldungen: {summary.overdue}</p>
                {nextPendingDeadline ? (
                  <p>
                    Nächste Frist: {format(nextPendingDeadline.registrationDeadline!, "dd.MM.yyyy HH:mm", { locale: de })}
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rückblick</CardTitle>
              <p className="text-sm text-muted-foreground">
                Die letzten fünf Rückmeldungen inklusive Statuswechsel.
              </p>
            </CardHeader>
            <CardContent>
              {history.length ? (
                <div className="space-y-3">
                  {history.map((entry) => (
                    <details key={entry.id} className="rounded-lg border border-border/60 bg-background/60 p-3">
                      <summary className="flex items-center justify-between gap-2 text-sm font-medium text-foreground">
                        <span>{entry.rehearsal.title}</span>
                        <Badge variant="outline" className={STATUS_BADGE_CLASSES[entry.status]}>
                          {STATUS_LABELS[entry.status]}
                        </Badge>
                      </summary>
                      <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                        <p>{formatDateTime(entry.rehearsal.start)}</p>
                        <p>Ort: {entry.rehearsal.location}</p>
                        <p>{STATUS_DESCRIPTIONS[entry.status]}</p>
                      </div>
                    </details>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Noch keine Rückmeldungen vorhanden.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MembersListPage>
  );
}

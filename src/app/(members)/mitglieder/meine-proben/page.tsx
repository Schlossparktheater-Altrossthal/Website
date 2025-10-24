import Link from "next/link";
import { notFound } from "next/navigation";
import { differenceInHours, format, formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale/de";
import { DepartmentMembershipRole } from "@prisma/client";

import { PageHeader } from "@/components/members/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";

import { UpcomingRehearsalResponseForm } from "./upcoming-response-form";

type AttendanceStatus = "yes" | "no" | "emergency" | "maybe";
const STATUS_KEYS = ["yes", "no", "emergency", "maybe"] as const satisfies readonly AttendanceStatus[];
type KnownStatus = (typeof STATUS_KEYS)[number];
type StatusKey = KnownStatus | "open";

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

type UpcomingRehearsalItem = UpcomingWithStats & {
  kind: "rehearsal";
};

type UpcomingDepartmentEvent = {
  kind: "department";
  id: string;
  title: string;
  start: Date;
  end: Date | null;
  location: string | null;
  description: string | null;
  departmentId: string;
  departmentName: string;
  departmentSlug: string;
  membershipRole: DepartmentMembershipRole;
};

type UpcomingItem = UpcomingRehearsalItem | UpcomingDepartmentEvent;

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

export default async function MeineProbenPage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.meine-proben");
  if (!allowed) {
    return <div className="text-sm text-red-600">Kein Zugriff auf die persönliche Probenübersicht.</div>;
  }

  const userId = session.user?.id;
  if (!userId) {
    notFound();
  }

  const now = new Date();

  const [upcomingRaw, historyRaw, memberships] = await Promise.all([
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
    prisma.departmentMembership.findMany({
      where: { userId },
      select: {
        departmentId: true,
        role: true,
        department: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    }),
  ]);

  const membershipByDepartment = new Map(
    memberships.map((entry) => [entry.departmentId, entry]),
  );

  const departmentEventsRaw = membershipByDepartment.size
    ? await prisma.departmentEvent.findMany({
        where: {
          departmentId: { in: Array.from(membershipByDepartment.keys()) },
          start: { gte: now },
        },
        orderBy: { start: "asc" },
        take: 8,
        include: {
          department: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      })
    : [];

  const upcomingRehearsals: UpcomingRehearsalItem[] = upcomingRaw.map((rehearsal) => {
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
      kind: "rehearsal" as const,
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

  const upcomingDepartmentEvents: UpcomingDepartmentEvent[] = departmentEventsRaw.map(
    (event) => {
      const membership = membershipByDepartment.get(event.departmentId);
      return {
        kind: "department" as const,
        id: event.id,
        title: event.title,
        start: event.start,
        end: event.end ?? null,
        location: event.location ?? null,
        description: event.description ?? null,
        departmentId: event.departmentId,
        departmentName: event.department.name,
        departmentSlug: event.department.slug,
        membershipRole: membership?.role ?? DepartmentMembershipRole.member,
      };
    },
  );

  const upcomingItems: UpcomingItem[] = [...upcomingRehearsals, ...upcomingDepartmentEvents].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );

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
  const attendedCount = history.filter((entry) => entry.status === "yes").length;
  const missedCount = Math.max(history.length - attendedCount, 0);
  const breadcrumbs = [membersNavigationBreadcrumb("/mitglieder/meine-proben")];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meine Termine"
        description="Persönliche Übersicht über deine nächsten Termine, Fristen und Rückmeldungen."
        breadcrumbs={breadcrumbs}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.68fr)_minmax(0,0.32fr)] xl:gap-8">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Anstehende Termine</CardTitle>
              <p className="text-sm text-muted-foreground">
                Alle bestätigten Proben und Gewerke-Termine der nächsten Wochen – inklusive Rückmeldefristen und optionaler Teilnahmehinweise.
              </p>
            </CardHeader>
            <CardContent>
              {upcomingItems.length ? (
                <ul className="space-y-3">
                  {upcomingItems.map((item) => {
                    if (item.kind === "rehearsal") {
                      const statusKey = toStatusKey(item.myStatus);
                      const deadline = item.registrationDeadline;
                      const deadlineClass = deadline
                        ? cn(
                            "text-xs sm:text-sm",
                            !item.myStatus && deadline <= now
                              ? "text-rose-600"
                              : !item.myStatus && differenceInHours(deadline, now) <= 72
                                ? "text-amber-700"
                                : "text-muted-foreground",
                          )
                        : "text-xs text-muted-foreground";
                      const canDecline = !deadline || deadline.getTime() > now.getTime();

                      return (
                        <li key={`rehearsal-${item.id}`}>
                          <details className="group rounded-xl border border-border/60 bg-background/60 p-3 shadow-sm transition-shadow [&_summary::-webkit-details-marker]:hidden">
                            <summary className="flex cursor-pointer flex-col gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0 space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Link
                                      href={`/mitglieder/proben/${item.id}`}
                                      className="text-sm font-semibold text-primary hover:underline"
                                    >
                                      {item.title}
                                    </Link>
                                    <Badge variant="outline" className="text-[0.65rem] uppercase tracking-wide">Probe</Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground">{formatDateTime(item.start)}</p>
                                  <p className="text-xs text-muted-foreground/80">Ort: {item.location}</p>
                                </div>
                                <Badge variant="outline" className={cn("self-start text-xs", STATUS_BADGE_CLASSES[statusKey])}>
                                  {STATUS_LABELS[statusKey]}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Rückmeldungen insgesamt: {item.responseCount}
                              </p>
                            </summary>
                            <div className="mt-3 space-y-3 border-t border-border/60 pt-3 text-xs text-muted-foreground sm:text-sm">
                              <p className="text-sm text-foreground">{STATUS_DESCRIPTIONS[statusKey]}</p>
                              {deadline ? (
                                <p className={deadlineClass}>
                                  Rückmeldefrist: {format(deadline, "dd.MM.yyyy HH:mm 'Uhr'", { locale: de })}
                                  {" "}({formatDistanceToNow(deadline, { locale: de, addSuffix: true })})
                                </p>
                              ) : (
                                <p className="text-xs text-muted-foreground">Keine Rückmeldefrist hinterlegt.</p>
                              )}
                              <div className="flex flex-wrap gap-2 text-[11px] sm:text-xs">
                                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-500/10 px-2 py-0.5 text-emerald-700">
                                  ✔ {item.counts.yes} Zusagen
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-500/10 px-2 py-0.5 text-rose-700">
                                  ✖ {item.counts.no} Absagen
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-500/10 px-2 py-0.5 text-amber-700">
                                  ⚠ {item.counts.emergency} Notfälle
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-500/10 px-2 py-0.5 text-sky-700">
                                  ? {item.counts.maybe} Unentschieden
                                </span>
                              </div>
                              <UpcomingRehearsalResponseForm
                                key={`${item.id}-${statusKey}`}
                                rehearsalId={item.id}
                                currentStatus={statusKey}
                                canDecline={canDecline}
                              />
                              {!canDecline ? (
                                <p className="text-xs text-amber-700">
                                  Die Rückmeldefrist ist abgelaufen. Bitte informiere die Planung bei kurzfristigen Änderungen.
                                </p>
                              ) : null}
                            </div>
                          </details>
                        </li>
                      );
                    }

                    const optional = item.membershipRole === DepartmentMembershipRole.guest;
                    return (
                      <li key={`department-${item.id}`}>
                        <details className="group rounded-xl border border-border/60 bg-background/60 p-3 shadow-sm transition-shadow [&_summary::-webkit-details-marker]:hidden">
                          <summary className="flex cursor-pointer flex-col gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-semibold text-foreground">{item.title}</span>
                                  <Badge variant="outline" className="text-[0.65rem] uppercase tracking-wide">Gewerk</Badge>
                                  {optional ? (
                                    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                                      Optional
                                    </Badge>
                                  ) : null}
                                </div>
                                <p className="text-xs text-muted-foreground">{formatDateTime(item.start)}</p>
                                {item.location ? (
                                  <p className="text-xs text-muted-foreground/80">Ort: {item.location}</p>
                                ) : null}
                              </div>
                              <Badge variant="outline" className="self-start text-xs">
                                {item.departmentName}
                              </Badge>
                            </div>
                          </summary>
                          <div className="mt-3 space-y-3 border-t border-border/60 pt-3 text-xs text-muted-foreground sm:text-sm">
                            {item.end ? (
                              <p className="text-xs text-muted-foreground">
                                Ende: {format(item.end, "dd.MM.yyyy HH:mm 'Uhr'", { locale: de })}
                              </p>
                            ) : null}
                            {item.description ? (
                              <p className="whitespace-pre-wrap text-sm text-muted-foreground/90">{item.description}</p>
                            ) : null}
                            <Link
                              href={`/mitglieder/meine-gewerke/${item.departmentSlug}`}
                              className="text-xs font-medium text-primary hover:underline"
                            >
                              Zum Gewerk
                            </Link>
                            {optional ? (
                              <p className="text-xs text-muted-foreground">
                                Als Gast ist deine Teilnahme freiwillig – gib dem Team gerne Bescheid, wenn du unterstützt.
                              </p>
                            ) : null}
                          </div>
                        </details>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Sobald neue Termine veröffentlicht werden, erscheinen sie hier automatisch.
                </p>
              )}
            </CardContent>
          </Card>

          <div className="rounded-xl border border-border/60 bg-background/60 p-4 shadow-sm">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">Teilnahmebilanz</h3>
              <p className="text-xs text-muted-foreground">
                Du hast bisher an {attendedCount} {attendedCount === 1 ? "Termin" : "Terminen"} teilgenommen und {missedCount} {missedCount === 1 ? "Termin" : "Terminen"} verpasst.
              </p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-emerald-200 bg-emerald-500/10 p-3 text-emerald-700 shadow-sm">
                <p className="text-xs uppercase tracking-wide">Teilgenommen</p>
                <p className="text-2xl font-semibold text-emerald-700">{attendedCount}</p>
              </div>
              <div className="rounded-lg border border-rose-200 bg-rose-500/10 p-3 text-rose-700 shadow-sm">
                <p className="text-xs uppercase tracking-wide">Verpasst</p>
                <p className="text-2xl font-semibold text-rose-700">{missedCount}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/60 shadow-sm">
            <details className="group [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-start justify-between gap-2 rounded-xl px-4 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">Vergangene Teilnahme</h3>
                  <p className="text-xs text-muted-foreground">
                    Kurzer Rückblick auf deine letzten Rückmeldungen für bereits stattgefundene Termine.
                  </p>
                </div>
                <span
                  aria-hidden
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-border/60 bg-muted/40 text-xs text-muted-foreground transition-transform group-open:rotate-180"
                >
                  ▾
                </span>
              </summary>
              <div className="border-t border-border/60 px-4 py-4">
                {history.length ? (
                  <ul className="space-y-3">
                    {history.map((entry) => (
                      <li key={entry.id} className="rounded-lg border border-border/60 bg-background/60 p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <Link
                              href={`/mitglieder/proben/${entry.rehearsal.id}`}
                              className="text-sm font-medium text-primary hover:underline"
                            >
                              {entry.rehearsal.title}
                            </Link>
                            <p className="text-xs text-muted-foreground">{formatDateTime(entry.rehearsal.start)}</p>
                            {entry.rehearsal.location ? (
                              <p className="text-xs text-muted-foreground/80">Ort: {entry.rehearsal.location}</p>
                            ) : null}
                          </div>
                          <Badge variant="outline" className={cn("self-start text-xs", STATUS_BADGE_CLASSES[entry.status])}>
                            {STATUS_LABELS[entry.status]}
                          </Badge>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">{STATUS_DESCRIPTIONS[entry.status]}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Es liegen noch keine Rückmeldungen vor. Sobald du Zusagen oder Absagen erfasst, erscheint hier eine kurze Historie.
                  </p>
                )}
              </div>
            </details>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>So meldest du dich schnell zurück</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                <li>Nutze die Glocke oben rechts: Dort findest du jede Proben-Benachrichtigung und kannst mit einem Klick zusagen oder absagen.</li>
                <li>Du findest die Nachricht nicht? Schau in deinem E-Mail-Postfach nach oder bitte die Regie um eine erneute Einladung.</li>
                <li>Bei kurzfristigen Änderungen (&lt;24 Stunden) informiere die Regie zusätzlich telefonisch oder per Chat, damit Ersatz organisiert werden kann.</li>
                <li>Trage Termine direkt nach der Zusage in deinen Kalender ein, um Doppelbuchungen zu vermeiden.</li>
              </ul>
              <p className="mt-4 text-xs text-muted-foreground">
                Tipp: Wenn du im Voraus weißt, dass du länger ausfällst, blocke die Zeiträume in der Sperrliste. So wird die Planung automatisch informiert.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


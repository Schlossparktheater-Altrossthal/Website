import Link from "next/link";
import { notFound } from "next/navigation";
import { format, formatDistanceToNow, differenceInHours } from "date-fns";
import { de } from "date-fns/locale/de";
import { PageHeader } from "@/components/members/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";

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
  const canManageMeasurements = await hasPermission(session.user, "mitglieder.koerpermasse");
  if (!allowed) {
    return <div className="text-sm text-red-600">Kein Zugriff auf die persönliche Probenübersicht.</div>;
  }

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
    .sort((a, b) => (a.registrationDeadline!.getTime() - b.registrationDeadline!.getTime()));
  const nextPendingDeadline = pendingDeadlines[0] ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meine Proben"
        description="Persönliche Übersicht über deine nächsten Probentermine, Fristen und Rückmeldungen."
      />

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
              {upcoming.length ? (
                <ul className="space-y-3">
                  {upcoming.map((item) => {
                    const statusKey = toStatusKey(item.myStatus);
                    const deadline = item.registrationDeadline;
                    const deadlineClass = deadline
                      ? cn(
                          "mt-2 text-xs",
                          !item.myStatus && deadline <= now
                            ? "text-rose-600"
                            : !item.myStatus && differenceInHours(deadline, now) <= 72
                              ? "text-amber-700"
                              : "text-muted-foreground",
                        )
                      : "mt-2 text-xs text-muted-foreground";

                    return (
                      <li key={item.id} className="rounded-lg border border-border/60 bg-background/60 p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <Link
                              href={`/mitglieder/proben/${item.id}`}
                              className="text-sm font-semibold text-primary hover:underline"
                            >
                              {item.title}
                            </Link>
                            <p className="text-xs text-muted-foreground">{formatDateTime(item.start)}</p>
                            <p className="text-xs text-muted-foreground/80">Ort: {item.location}</p>
                          </div>
                          <Badge variant="outline" className={cn("self-start text-xs", STATUS_BADGE_CLASSES[statusKey])}>
                            {STATUS_LABELS[statusKey]}
                          </Badge>
                        </div>
                        {deadline ? (
                          <p className={deadlineClass}>
                            Rückmeldefrist: {format(deadline, "dd.MM.yyyy HH:mm 'Uhr'", { locale: de })}
                            {" "}({formatDistanceToNow(deadline, { locale: de, addSuffix: true })})
                          </p>
                        ) : (
                          <p className="mt-2 text-xs text-muted-foreground">Keine Rückmeldefrist hinterlegt.</p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] sm:text-xs">
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
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          Rückmeldungen insgesamt: {item.responseCount}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Sobald Proben geplant sind, erscheinen sie hier mit allen Details.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vergangene Teilnahme</CardTitle>
              <p className="text-sm text-muted-foreground">
                Kurzer Rückblick auf deine letzten Rückmeldungen für bereits stattgefundene Proben.
              </p>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {canManageMeasurements ? (
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle>Körpermaße für Anproben</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Pflege deine Maße zentral, damit das Kostüm-Team dich bei Anproben optimal einplanen kann.
                </p>
              </CardHeader>
              <CardContent>
                <Button asChild size="sm">
                  <Link href="/mitglieder/koerpermasse">Körpermaße verwalten</Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Rückmeldungsstatus</CardTitle>
              <p className="text-sm text-muted-foreground">
                Wie viele Termine du bereits beantwortet hast und wo noch Handlungsbedarf besteht.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {[{ key: "open", label: "Offen", value: summary.open, className: "border-slate-200 bg-muted/50 text-foreground" },
                  { key: "yes", label: "Zugesagt", value: summary.yes, className: "border-emerald-200 bg-emerald-500/10 text-emerald-700" },
                  { key: "no", label: "Abgesagt", value: summary.no, className: "border-rose-200 bg-rose-500/10 text-rose-700" },
                  { key: "maybe", label: "Unentschieden", value: summary.maybe, className: "border-sky-200 bg-sky-500/10 text-sky-700" },
                  { key: "emergency", label: "Notfall gemeldet", value: summary.emergency, className: "border-amber-200 bg-amber-500/10 text-amber-700" }].map((item) => (
                  <div key={item.key} className={cn("rounded-lg border p-3 shadow-sm", item.className)}>
                    <div className="text-xs uppercase tracking-wide text-foreground/70">{item.label}</div>
                    <div className="text-2xl font-semibold">{item.value}</div>
                  </div>
                ))}
              </div>

              {upcoming.length ? (
                summary.open ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                    Du hast noch {summary.open} offene Rückmeld{summary.open === 1 ? "ung" : "ungen"}.
                    {summary.overdue
                      ? ` ${summary.overdue === 1 ? "Eine Frist ist" : `${summary.overdue} Fristen sind`} bereits verstrichen.`
                      : ""}
                    {summary.dueSoon
                      ? ` ${summary.dueSoon === 1 ? "Eine" : `${summary.dueSoon}`} weitere läuft innerhalb der nächsten 72 Stunden ab.`
                      : ""}
                  </div>
                ) : (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                    Alle kommenden Proben sind beantwortet. Vielen Dank für deine schnelle Rückmeldung!
                  </div>
                )
              ) : (
                <div className="rounded-md border border-border/50 bg-muted/40 p-3 text-sm text-muted-foreground">
                  Derzeit liegen keine kommenden Termine vor.
                </div>
              )}

              {nextPendingDeadline ? (
                <div className="rounded-md border border-border/60 bg-background/60 p-3 text-xs text-muted-foreground">
                  Nächste offene Frist:&nbsp;
                  <span className="font-medium text-foreground">
                    {format(nextPendingDeadline.registrationDeadline!, "dd.MM.yyyy HH:mm 'Uhr'", { locale: de })}
                  </span>
                  {" "}({formatDistanceToNow(nextPendingDeadline.registrationDeadline!, { locale: de, addSuffix: true })}) für
                  {" "}
                  <span className="font-medium text-foreground">{nextPendingDeadline.title}</span>.
                </div>
              ) : null}
            </CardContent>
          </Card>

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


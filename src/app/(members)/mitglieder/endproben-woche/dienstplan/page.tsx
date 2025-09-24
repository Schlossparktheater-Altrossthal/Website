import Link from "next/link";
import { AlertTriangle, CalendarDays, ClipboardList, Users2 } from "lucide-react";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { getActiveProductionId } from "@/lib/active-production";
import { getUserDisplayName } from "@/lib/names";
import { PageHeader } from "@/components/members/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";

import {
  createFinalRehearsalDutyAction,
  deleteFinalRehearsalDutyAction,
  updateFinalRehearsalDutyAssignmentAction,
} from "../actions";
import {
  FINAL_WEEK_MANAGE_PERMISSION_KEY,
  FINAL_WEEK_VIEW_PERMISSION_KEY,
} from "../constants";

export const dynamic = "force-dynamic";

const selectClassName =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const collapsibleClassName =
  "group rounded-lg border border-border/60 bg-background/70 p-4 shadow-sm transition [&_summary::-webkit-details-marker]:hidden";

const dutyInclude = {
  assignee: { select: { id: true, firstName: true, lastName: true, name: true, email: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true, name: true, email: true } },
} as const satisfies Prisma.FinalRehearsalDutyInclude;

const dayLabelFormatter = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
});

const rangeLabelFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
});

const dateLabelFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

const timeLabelFormatter = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
});

type DutyWithRelations = Prisma.FinalRehearsalDutyGetPayload<{ include: typeof dutyInclude }>;

type MemberOption = { id: string; label: string };

type WeekDay = {
  iso: string;
  date: Date;
  label: string;
};

function normalizeDateOnly(date: Date): Date {
  const iso = date.toISOString().slice(0, 10);
  return new Date(`${iso}T00:00:00.000Z`);
}

function toDateIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function createWeekDays(start: Date): WeekDay[] {
  const days: WeekDay[] = [];
  for (let index = 0; index < 7; index += 1) {
    const date = new Date(start.getTime() + index * 86_400_000);
    days.push({ iso: toDateIso(date), date, label: dayLabelFormatter.format(date) });
  }
  return days;
}

function formatTimeRange(startMinutes: number | null, endMinutes: number | null): string {
  if (startMinutes === null && endMinutes === null) {
    return "Ganztägig";
  }

  const format = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const minutesPart = minutes % 60;
    return timeLabelFormatter.format(new Date(Date.UTC(2000, 0, 1, hours, minutesPart)));
  };

  if (startMinutes !== null && endMinutes !== null) {
    return `${format(startMinutes)} – ${format(endMinutes)}`;
  }

  if (startMinutes !== null) {
    return `ab ${format(startMinutes)}`;
  }

  if (endMinutes !== null) {
    return `bis ${format(endMinutes)}`;
  }

  return "Ganztägig";
}

function DutyCard({
  duty,
  canManage,
  memberOptions,
  showDate,
}: {
  duty: DutyWithRelations;
  canManage: boolean;
  memberOptions: MemberOption[];
  showDate?: boolean;
}) {
  const dutyDate = normalizeDateOnly(duty.date);
  const timeLabel = formatTimeRange(duty.startTime ?? null, duty.endTime ?? null);
  const assigneeName = duty.assignee
    ? getUserDisplayName({
        firstName: duty.assignee.firstName ?? undefined,
        lastName: duty.assignee.lastName ?? undefined,
        name: duty.assignee.name ?? undefined,
        email: duty.assignee.email ?? undefined,
      })
    : "Noch offen";
  const createdByName = duty.createdBy
    ? getUserDisplayName({
        firstName: duty.createdBy.firstName ?? undefined,
        lastName: duty.createdBy.lastName ?? undefined,
        name: duty.createdBy.name ?? undefined,
        email: duty.createdBy.email ?? undefined,
      })
    : "Unbekannt";
  const isOpen = !duty.assigneeId;

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-background/70 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{duty.title}</h3>
            {duty.location ? (
              <Badge variant="outline" className="border-info/50 bg-info/10 text-info">
                {duty.location}
              </Badge>
            ) : null}
            <Badge
              variant="outline"
              className={
                isOpen
                  ? "border-warning/60 bg-warning/10 text-warning"
                  : "border-success/50 bg-success/10 text-success"
              }
            >
              {assigneeName}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{timeLabel}</p>
          {showDate ? (
            <p className="text-xs text-muted-foreground">
              {dateLabelFormatter.format(dutyDate)}
            </p>
          ) : null}
        </div>
        {canManage ? (
          <form action={deleteFinalRehearsalDutyAction}>
            <input type="hidden" name="dutyId" value={duty.id} />
            <Button variant="ghost" size="sm">
              Entfernen
            </Button>
          </form>
        ) : null}
      </div>

      {duty.description ? (
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{duty.description}</p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users2 className="h-4 w-4" />
          <span>{isOpen ? "Noch offen" : `Verantwortlich: ${assigneeName}`}</span>
        </div>
        {canManage ? (
          <form
            action={updateFinalRehearsalDutyAssignmentAction}
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
          >
            <input type="hidden" name="dutyId" value={duty.id} />
            <select
              name="assigneeId"
              defaultValue={duty.assigneeId ?? ""}
              className={`${selectClassName} sm:w-64`}
            >
              <option value="">Noch offen</option>
              {memberOptions.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.label}
                </option>
              ))}
            </select>
            <Button type="submit" size="sm">
              Zuweisen
            </Button>
          </form>
        ) : null}
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5" />
        <span>Angelegt von {createdByName}</span>
      </div>
    </div>
  );
}

export default async function FinalRehearsalDutyPlanPage() {
  const session = await requireAuth();
  const canView = await hasPermission(session.user, FINAL_WEEK_VIEW_PERMISSION_KEY);
  if (!canView) {
    return (
      <div className="rounded-lg border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
        Kein Zugriff auf den Dienstplan der Endprobenwoche.
      </div>
    );
  }
  const canManage = await hasPermission(session.user, FINAL_WEEK_MANAGE_PERMISSION_KEY);
  const activeProductionId = await getActiveProductionId(session.user?.id);

  const baseSelection = await Promise.all([
    activeProductionId
      ? prisma.show.findUnique({
          where: { id: activeProductionId },
          select: { id: true, title: true, year: true, finalRehearsalWeekStart: true },
        })
      : Promise.resolve(null),
    prisma.show.findFirst({
      where: { finalRehearsalWeekStart: { not: null } },
      orderBy: { finalRehearsalWeekStart: "desc" },
      select: { id: true, title: true, year: true, finalRehearsalWeekStart: true },
    }),
    prisma.show.findFirst({
      orderBy: { year: "desc" },
      select: { id: true, title: true, year: true, finalRehearsalWeekStart: true },
    }),
  ]);

  const [activeShow, latestWithDate, latestByYear] = baseSelection;
  const show = activeShow ?? latestWithDate ?? latestByYear;

  const [duties, memberRecords] = await Promise.all([
    show
      ? prisma.finalRehearsalDuty.findMany({
          where: { showId: show.id },
          include: dutyInclude,
          orderBy: [
            { date: "asc" },
            { startTime: "asc" },
            { title: "asc" },
          ],
        })
      : Promise.resolve([]),
    canManage
      ? prisma.user.findMany({
          where: {
            deactivatedAt: null,
            ...(show
              ? {
                  productionMemberships: {
                    some: {
                      showId: show.id,
                      OR: [{ leftAt: null }, { leftAt: { gt: new Date() } }],
                    },
                  },
                }
              : {}),
          },
          orderBy: [
            { firstName: "asc" },
            { lastName: "asc" },
            { name: "asc" },
            { email: "asc" },
          ],
          select: { id: true, firstName: true, lastName: true, name: true, email: true },
        })
      : Promise.resolve([]),
  ]);

  const memberOptions: MemberOption[] = canManage
    ? memberRecords.map((member) => ({
        id: member.id,
        label: getUserDisplayName({
          firstName: member.firstName ?? undefined,
          lastName: member.lastName ?? undefined,
          name: member.name ?? undefined,
          email: member.email ?? undefined,
        }),
      }))
    : [];

  const finalWeekStart = show?.finalRehearsalWeekStart
    ? normalizeDateOnly(new Date(show.finalRehearsalWeekStart))
    : null;
  const weekDays = finalWeekStart ? createWeekDays(finalWeekStart) : [];
  const weekIsoSet = new Set(weekDays.map((day) => day.iso));

  const dutiesByDay = new Map<string, DutyWithRelations[]>();
  for (const duty of duties) {
    const iso = toDateIso(normalizeDateOnly(duty.date));
    const list = dutiesByDay.get(iso) ?? [];
    list.push(duty);
    dutiesByDay.set(iso, list);
  }

  const extraDuties = duties.filter((duty) => !weekIsoSet.has(toDateIso(normalizeDateOnly(duty.date))));
  const totalDuties = duties.length;
  const assignedCount = duties.filter((duty) => Boolean(duty.assigneeId)).length;
  const openCount = totalDuties - assignedCount;

  const showLabel = show
    ? show.title && show.title.trim()
      ? show.title
      : `Produktion ${show.year}`
    : null;
  const startLabel = finalWeekStart ? dateLabelFormatter.format(finalWeekStart) : null;
  const rangeLabel = finalWeekStart
    ? `${rangeLabelFormatter.format(finalWeekStart)} – ${rangeLabelFormatter.format(
        new Date(finalWeekStart.getTime() + 6 * 86_400_000),
      )}`
    : null;
  const breadcrumbs = [
    membersNavigationBreadcrumb("/mitglieder/endproben-woche/dienstplan"),
  ];

  if (!show) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Dienstplan"
          description="Organisiere Aufgaben und Verantwortlichkeiten für die Endprobenwoche."
          breadcrumbs={breadcrumbs}
        />
        <Card className="border border-dashed border-border/60 bg-background/70">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Noch keine Produktion eingerichtet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Aktuell ist keine Produktion verfügbar. Lege in der Produktionsplanung eine Produktion an und
              hinterlege den Start der Endprobenwoche, um den Dienstplan zu aktivieren.
            </p>
            {canManage ? (
              <Button asChild>
                <Link href="/mitglieder/produktionen">Zur Produktionsplanung</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dienstplan"
        description="Koordiniere Dienste, Verantwortlichkeiten und Tagesaufgaben der Endprobenwoche."
        breadcrumbs={breadcrumbs}
      />

      <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background/80 shadow-[0_25px_60px_rgba(59,130,246,0.18)]">
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold">
              <ClipboardList className="h-5 w-5 text-primary" />
              Überblick Endprobenwoche
            </CardTitle>
            {startLabel ? (
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                Start {startLabel}
              </Badge>
            ) : (
              <Badge variant="outline" className="border-warning/60 bg-warning/10 text-warning">
                Startdatum fehlt
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Verteile Dienste auf die Tage der Endprobenwoche und weise verantwortliche Personen zu. Änderungen
            wirken sich sofort auf alle Mitglieder aus.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-primary/20 bg-background/80 p-3 shadow-sm backdrop-blur">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-primary/70">Dienste</div>
              <div className="mt-1 text-2xl font-semibold text-foreground">{totalDuties}</div>
              <p className="mt-1 text-xs text-muted-foreground">Gesamtanzahl geplanter Aufgaben</p>
            </div>
            <div className="rounded-xl border border-success/30 bg-background/80 p-3 shadow-sm backdrop-blur">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-success/70">Besetzt</div>
              <div className="mt-1 text-2xl font-semibold text-foreground">{assignedCount}</div>
              <p className="mt-1 text-xs text-muted-foreground">Mit verantwortlichen Personen</p>
            </div>
            <div className="rounded-xl border border-warning/30 bg-background/80 p-3 shadow-sm backdrop-blur">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-warning/70">Offen</div>
              <div className="mt-1 text-2xl font-semibold text-foreground">{openCount}</div>
              <p className="mt-1 text-xs text-muted-foreground">Noch ohne Zuordnung</p>
            </div>
            <div className="rounded-xl border border-border/40 bg-background/80 p-3 shadow-sm backdrop-blur">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-foreground/60">
                Produktion
              </div>
              <div className="mt-1 text-2xl font-semibold text-foreground">{showLabel}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Finale Woche {show.year}
              </p>
            </div>
          </div>
          {rangeLabel ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <CalendarDays className="h-4 w-4 text-primary" />
              <span>Geplanter Zeitraum: {rangeLabel}</span>
            </div>
          ) : null}
          {!finalWeekStart ? (
            <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/5 p-3 text-xs text-warning">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                Hinterlege bei der Produktionserstellung im Bereich „Produktionen“ den Start der Endprobenwoche, um den
                Dienstplan zeitlich einzuordnen.
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {finalWeekStart ? (
        <div className="grid gap-6 xl:grid-cols-2">
          {weekDays.map((day) => {
            const dayDuties = dutiesByDay.get(day.iso) ?? [];
            const openPerDay = dayDuties.filter((entry) => !entry.assigneeId).length;
            return (
              <Card key={day.iso} className="space-y-4">
                <CardHeader className="space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg font-semibold capitalize">{day.label}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {dateLabelFormatter.format(day.date)}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        openPerDay > 0
                          ? "border-warning/60 bg-warning/10 text-warning"
                          : "border-success/50 bg-success/10 text-success"
                      }
                    >
                      {openPerDay > 0 ? `${openPerDay} offen` : "Alle besetzt"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {dayDuties.length > 0 ? (
                    <div className="space-y-3">
                      {dayDuties.map((duty) => (
                        <DutyCard
                          key={duty.id}
                          duty={duty}
                          canManage={canManage}
                          memberOptions={memberOptions}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border/50 bg-background/60 p-4 text-sm text-muted-foreground">
                      Für diesen Tag sind noch keine Dienste eingetragen.
                    </div>
                  )}

                  {canManage ? (
                    <details className={collapsibleClassName}>
                      <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-foreground">
                        <span>Neuen Dienst hinzufügen</span>
                        <span className="text-xs text-muted-foreground group-open:hidden">Öffnen</span>
                        <span className="hidden text-xs text-muted-foreground group-open:inline">Schließen</span>
                      </summary>
                      <form action={createFinalRehearsalDutyAction} className="mt-3 space-y-3">
                        <input type="hidden" name="showId" value={show.id} />
                        <input type="hidden" name="date" value={day.iso} />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1">
                            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Titel
                            </label>
                            <Input name="title" required minLength={3} maxLength={120} placeholder="z.B. Aufbau Bühne" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Ort
                            </label>
                            <Input name="location" maxLength={160} placeholder="z.B. Probebühne" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Startzeit
                            </label>
                            <Input type="time" name="startTime" step={300} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Endzeit
                            </label>
                            <Input type="time" name="endTime" step={300} />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Beschreibung
                          </label>
                          <Textarea
                            name="description"
                            rows={3}
                            maxLength={1000}
                            placeholder="Optional: genaue Aufgabenbeschreibung, benötigte Ressourcen oder Hinweise."
                          />
                        </div>
                        <div className="space-y-1 sm:w-64">
                          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Verantwortlich
                          </label>
                          <select name="assigneeId" className={selectClassName} defaultValue="">
                            <option value="">Noch offen</option>
                            {memberOptions.map((member) => (
                              <option key={member.id} value={member.id}>
                                {member.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <Button type="submit" size="sm">
                            Dienst speichern
                          </Button>
                        </div>
                      </form>
                    </details>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border border-dashed border-warning/50 bg-warning/5">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5" />
              <CardTitle className="text-lg font-semibold">Start der Endprobenwoche fehlt</CardTitle>
            </div>
            {canManage ? (
              <Button asChild variant="outline" size="sm">
                <Link href="/mitglieder/produktionen">Startdatum festlegen</Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              Hinterlege bei der Produktionserstellung im Bereich „Produktionen“ den Beginn der Endprobenwoche. Danach
              kannst du die Dienste pro Tag strukturieren und Verantwortliche zuweisen.
            </p>
          </CardContent>
        </Card>
      )}

      {extraDuties.length > 0 ? (
        <Card className="border border-accent/50 bg-accent/10">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Dienste außerhalb der Endprobenwoche</CardTitle>
            <p className="text-sm text-muted-foreground">
              Diese Einträge liegen außerhalb der definierten Woche und sollten geprüft oder neu datiert werden.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {extraDuties.map((duty) => (
              <DutyCard
                key={duty.id}
                duty={duty}
                canManage={canManage}
                memberOptions={memberOptions}
                showDate
              />
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

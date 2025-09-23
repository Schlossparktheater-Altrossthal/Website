import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale/de";

import { PageHeader } from "@/components/members/page-header";
export const dynamic = "force-dynamic";
import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateRehearsalButton } from "./create-rehearsal-button";
import { DiscardDraftButton } from "./discard-draft-button";
import {
  RehearsalCalendar,
  type CalendarBlockedDay,
  type CalendarRehearsal,
} from "./rehearsal-calendar";
import { RehearsalList, type RehearsalLite } from "./rehearsal-list";
import { combineNameParts } from "@/lib/names";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
export default async function ProbenplanungPage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.probenplanung");
  if (!allowed) {
    return <div className="text-sm text-red-600">Kein Zugriff auf die Probenplanung</div>;
  }

  const [publishedRehearsals, blockedDays, memberCount, drafts] = await Promise.all([
    prisma.rehearsal.findMany({
      where: { status: { not: "DRAFT" } },
      orderBy: { start: "asc" },
      include: {
        attendance: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, name: true, email: true } },
          },
        },
        notifications: {
          include: {
            recipients: {
              include: {
                user: { select: { id: true, firstName: true, lastName: true, name: true, email: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }),
    prisma.blockedDay.findMany({
      orderBy: { date: "asc" },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, name: true, email: true } },
      },
      where: { kind: "BLOCKED" },
    }),
    prisma.user.count(),
    prisma.rehearsal.findMany({
      where: { status: "DRAFT" },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        start: true,
        updatedAt: true,
        location: true,
      },
    }),
  ]);

  const calendarBlockedDays: CalendarBlockedDay[] = blockedDays.map((entry) => {
    const iso = entry.date.toISOString();
    return {
      id: entry.id,
      date: iso,
      dateKey: iso.slice(0, 10),
      reason: entry.reason,
      kind: "BLOCKED",
      user: {
        id: entry.user.id,
        firstName: entry.user.firstName ?? null,
        lastName: entry.user.lastName ?? null,
        name: combineNameParts(entry.user.firstName, entry.user.lastName) ?? entry.user.name ?? null,
        email: entry.user.email ?? null,
      },
    };
  });

  const calendarRehearsals: CalendarRehearsal[] = publishedRehearsals.map((r) => {
    const startIso = r.start.toISOString();
    const endIso = r.end ? r.end.toISOString() : null;
    return {
      id: r.id,
      title: r.title,
      start: startIso,
      end: endIso,
      dateKey: startIso.slice(0, 10),
      location: r.location,
    };
  });

  const draftDateFormatter = new Intl.DateTimeFormat("de-DE", {
    dateStyle: "full",
    timeStyle: "short",
  });
  const now = new Date();
  const total = publishedRehearsals.length;
  const upcoming = publishedRehearsals.filter((r) => r.start >= now).length;
  const breadcrumbs = [membersNavigationBreadcrumb("/mitglieder/probenplanung")];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Probenplanung"
        description="Lege neue Proben an, verwalte Termine und Einladungen."
        breadcrumbs={breadcrumbs}
      />

      <div className="rounded-xl border bg-card/60 p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-background/80 px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Insgesamt: {total}
            </span>
            <span className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-background/80 px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Bevorstehend: {upcoming}
            </span>
          </div>
          <div className="flex justify-end">
            <CreateRehearsalButton />
          </div>
        </div>
      </div>

      {drafts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Offene Entwürfe</CardTitle>
            <p className="text-sm text-muted-foreground">
              Entwürfe werden automatisch gespeichert. Du kannst sie hier weiterbearbeiten oder veröffentlichen.
            </p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {drafts.map((draft) => (
                <li
                  key={draft.id}
                  className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background/70 p-3 shadow-sm"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <Link
                        href={`/mitglieder/probenplanung/proben/${draft.id}`}
                        className="text-sm font-semibold text-primary hover:underline"
                      >
                        {draft.title || "Unbenannter Entwurf"}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        Geplanter Termin: {draftDateFormatter.format(draft.start)}
                      </p>
                      {draft.location ? (
                        <p className="text-xs text-muted-foreground/80">Ort: {draft.location}</p>
                      ) : null}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Zuletzt bearbeitet {formatDistanceToNow(draft.updatedAt, { locale: de, addSuffix: true })}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href={`/mitglieder/probenplanung/proben/${draft.id}`}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Entwurf öffnen
                    </Link>
                    <DiscardDraftButton id={draft.id} title={draft.title} />
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <RehearsalCalendar
        blockedDays={calendarBlockedDays}
        rehearsals={calendarRehearsals}
        memberCount={memberCount}
      />

      {publishedRehearsals.length ? (
      <RehearsalList
        initial={publishedRehearsals.map((r) => ({
          id: r.id,
          title: r.title,
          start: r.start.toISOString(),
          location: r.location ?? "",
          attendance: r.attendance.map((a) => ({
            status: a.status,
            userId: a.userId,
            user: {
              id: a.user.id,
              firstName: a.user.firstName ?? null,
              lastName: a.user.lastName ?? null,
              name: combineNameParts(a.user.firstName, a.user.lastName) ?? a.user.name ?? null,
              email: a.user.email ?? null,
            },
          })),
          notifications: r.notifications.map((n) => ({
            recipients: n.recipients.map((x) => ({
              userId: x.userId,
              user: {
                id: x.user.id,
                firstName: x.user.firstName ?? null,
                lastName: x.user.lastName ?? null,
                name: combineNameParts(x.user.firstName, x.user.lastName) ?? x.user.name ?? null,
                email: x.user.email ?? null,
              },
            })),
          })),
        })) as RehearsalLite[]}
      />
      ) : (
        <p className="text-sm text-muted-foreground">Es sind aktuell keine Proben geplant.</p>
      )}
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { de } from "date-fns/locale/de";
import { DepartmentMembershipRole } from "@prisma/client";

import { PageHeader } from "@/components/members/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";

type UpcomingRehearsalItem = {
  kind: "rehearsal";
  id: string;
  title: string;
  start: Date;
  location: string;
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

function formatDateTime(date: Date) {
  return format(date, "EEEE, dd.MM.yyyy '·' HH:mm 'Uhr'", { locale: de });
}

export default async function MyRehearsalsPage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "PRIVATE.REHEARSAL.OWN.VIEW");
  if (!allowed) {
    return (
      <div className="text-sm text-red-600">Kein Zugriff auf die persönliche Probenübersicht.</div>
    );
  }

  const userId = session.user?.id;
  if (!userId) {
    notFound();
  }

  const now = new Date();

  const [upcomingRaw, memberships] = await Promise.all([
    prisma.rehearsal.findMany({
      where: { start: { gte: now }, status: { not: "DRAFT" } },
      orderBy: { start: "asc" },
      take: 8,
      select: {
        id: true,
        title: true,
        start: true,
        location: true,
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

  const membershipByDepartment = new Map(memberships.map((entry) => [entry.departmentId, entry]));

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

  const upcomingRehearsals: UpcomingRehearsalItem[] = upcomingRaw.map((rehearsal) => ({
    kind: "rehearsal" as const,
    id: rehearsal.id,
    title: rehearsal.title,
    start: rehearsal.start,
    location: rehearsal.location,
  }));

  const upcomingDepartmentEvents: UpcomingDepartmentEvent[] = departmentEventsRaw.map((event) => {
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
  });

  const upcomingItems: UpcomingItem[] = [...upcomingRehearsals, ...upcomingDepartmentEvents].sort(
    (a, b) => a.start.getTime() - b.start.getTime(),
  );

  const breadcrumbs = [membersNavigationBreadcrumb("/mitglieder/meine-proben")];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meine Termine"
        description="Persönliche Übersicht über deine nächsten Termine und wichtige Hinweise zur Planung."
        breadcrumbs={breadcrumbs}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.68fr)_minmax(0,0.32fr)] xl:gap-8">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Anstehende Termine</CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingItems.length ? (
                <ul className="space-y-3">
                  {upcomingItems.map((item) => {
                    if (item.kind === "rehearsal") {
                      return (
                        <li key={`rehearsal-${item.id}`}>
                          <div className="rounded-xl border border-border/60 bg-background/60 p-3 shadow-sm">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Link
                                    href={`/mitglieder/proben/${item.id}`}
                                    className="text-sm font-semibold text-primary hover:underline"
                                  >
                                    {item.title}
                                  </Link>
                                  <Badge
                                    variant="outline"
                                    className="text-[0.65rem] uppercase tracking-wide"
                                  >
                                    Probe
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {formatDateTime(item.start)}
                                </p>
                                <p className="text-xs text-muted-foreground/80">
                                  Ort: {item.location}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Rückmeldungen sind nicht nötig – alle Nicht-Gesperrten werden
                                  erwartet.
                                </p>
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    }

                    const optional = item.membershipRole === DepartmentMembershipRole.guest;
                    const hasAdditionalDetails = Boolean(item.end || item.description);

                    return (
                      <li key={`department-${item.id}`}>
                        <div className="rounded-xl border border-border/60 bg-background/60 p-3 shadow-sm">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold text-foreground">
                                  {item.title}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="text-[0.65rem] uppercase tracking-wide"
                                >
                                  {item.departmentName}
                                </Badge>
                                {optional ? (
                                  <Badge
                                    variant="outline"
                                    className="border-amber-200 bg-amber-50 text-amber-700"
                                  >
                                    Optional
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {formatDateTime(item.start)}
                              </p>
                              {item.location ? (
                                <p className="text-xs text-muted-foreground/80">
                                  Ort: {item.location}
                                </p>
                              ) : null}
                            </div>
                          </div>
                          <div className="mt-3 space-y-3 border-t border-border/60 pt-3 text-xs text-muted-foreground sm:text-sm">
                            {item.end ? (
                              <p className="text-xs text-muted-foreground">
                                Ende: {format(item.end, "dd.MM.yyyy HH:mm 'Uhr'", { locale: de })}
                              </p>
                            ) : null}
                            {item.description ? (
                              <p className="whitespace-pre-wrap text-sm text-muted-foreground/90">
                                {item.description}
                              </p>
                            ) : null}
                            {!hasAdditionalDetails ? (
                              <p className="text-xs text-muted-foreground">
                                Für dieses Gewerk sind derzeit keine weiteren Details hinterlegt.
                              </p>
                            ) : null}
                            {optional ? (
                              <p className="text-xs text-muted-foreground">
                                Als Gast ist deine Teilnahme freiwillig – informiere das Team, falls
                                du unterstützen möchtest.
                              </p>
                            ) : null}
                          </div>
                        </div>
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
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sperrliste zuerst nutzen</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                <li>
                  Trage bekannte Abwesenheiten direkt in die Sperrliste ein – dadurch weiß die
                  Planung, dass du fehlst.
                </li>
                <li>
                  Bei kurzfristigen Änderungen informiere zusätzlich telefonisch oder per Chat,
                  damit Ersatz organisiert werden kann.
                </li>
                <li>
                  Neue Termine gelten als zugesagt. Du musst keine Zusage- oder Absage-Buttons mehr
                  verwenden.
                </li>
                <li>
                  Nach dem Eintrag in die Sperrliste kannst du den Termin aus deinem Kalender
                  entfernen.
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

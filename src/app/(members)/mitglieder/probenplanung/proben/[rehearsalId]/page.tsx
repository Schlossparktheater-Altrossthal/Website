import { notFound } from "next/navigation";

import { PageHeader } from "@/components/members/page-header";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

import { RehearsalEditor } from "../../rehearsal-editor";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import {
  DEFAULT_TIME_ZONE,
  formatIsoDateInTimeZone,
  parseDateTimeInTimeZone,
} from "@/lib/date-time";

type MemberOption = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  extraRoles: string[];
};

export default async function RehearsalEditorPage({
  params,
}: {
  params: Promise<{ rehearsalId: string }>;
}) {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "PRIVATE.REHEARSAL.PLANNING.MANAGE");
  if (!allowed) {
    return <div className="text-sm text-destructive">Kein Zugriff auf die Probenplanung</div>;
  }

  const resolvedParams = await params;
  const rehearsalId = resolvedParams?.rehearsalId;
  if (!rehearsalId) {
    notFound();
  }

  const rehearsal = await prisma.calendarEvent.findFirst({
    where: { id: rehearsalId, kind: "REHEARSAL" },
    include: {
      participants: { where: { invited: true }, select: { userId: true } },
    },
  });

  if (!rehearsal) {
    notFound();
  }

  // Produktionsrollen planen nur Proben ihrer eigenen Produktion.
  if (
    rehearsal.showId &&
    !(await hasPermission(session.user, "PRIVATE.REHEARSAL.PLANNING.MANAGE", {
      showId: rehearsal.showId,
    }))
  ) {
    return (
      <div className="text-sm text-destructive">
        Kein Zugriff: Diese Probe gehört zu einer anderen Produktion.
      </div>
    );
  }

  // Allow editing both DRAFT and published rehearsals
  // Drafts use updateRehearsalDraftAction, published use updateRehearsalAction

  const membersRaw = await prisma.user.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { name: "asc" }, { email: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      roles: { select: { role: true } },
    },
  });

  const dateKey = formatIsoDateInTimeZone(rehearsal.start.toISOString(), DEFAULT_TIME_ZONE);
  const dayStart = parseDateTimeInTimeZone(dateKey, "00:00", DEFAULT_TIME_ZONE);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const blocked = await prisma.blockedDay.findMany({
    where: {
      date: {
        gte: dayStart,
        lt: dayEnd,
      },
      kind: "BLOCKED",
    },
    select: { userId: true },
  });

  const members: MemberOption[] = membersRaw.map((member) => ({
    id: member.id,
    name: member.name,
    email: member.email,
    role: member.role,
    extraRoles: member.roles.map((entry) => entry.role),
  }));

  const breadcrumbs = [
    membersNavigationBreadcrumb("/mitglieder/probenplanung"),
    { id: rehearsal.id, label: rehearsal.title || "Probe", isCurrent: true },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Probe bearbeiten"
        description={
          rehearsal.status === "DRAFT"
            ? "Passe Titel, Termine, Beschreibung und Teilnehmer deines Entwurfs an."
            : "Bearbeite diese veröffentlichte Probe. Alle Teilnehmer erhalten eine Benachrichtigung über Änderungen."
        }
        breadcrumbs={breadcrumbs}
      />

      <RehearsalEditor
        rehearsal={{
          id: rehearsal.id,
          status: rehearsal.status,
          title: rehearsal.title,
          start: rehearsal.start.toISOString(),
          end: rehearsal.end ? rehearsal.end.toISOString() : null,
          location: rehearsal.location ?? "",
          description: rehearsal.description,
          inviteeIds: rehearsal.participants.map((entry) => entry.userId),
        }}
        members={members}
        initialBlockedUserIds={blocked.map((entry) => entry.userId)}
      />
    </div>
  );
}

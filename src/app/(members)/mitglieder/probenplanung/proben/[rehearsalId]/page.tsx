import { notFound } from "next/navigation";

import { PageHeader } from "@/components/members/page-header";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

import { RehearsalEditor } from "../../rehearsal-editor";

type MemberOption = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  extraRoles: string[];
};

export default async function RehearsalEditorPage({ params }: { params: { rehearsalId: string } }) {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.probenplanung");
  if (!allowed) {
    return <div className="text-sm text-red-600">Kein Zugriff auf die Probenplanung</div>;
  }

  const rehearsal = await prisma.rehearsal.findUnique({
    where: { id: params.rehearsalId },
    include: {
      invitees: { select: { userId: true } },
    },
  });

  if (!rehearsal) {
    notFound();
  }

  // Allow editing both DRAFT and published rehearsals
  // Drafts use updateRehearsalDraftAction, published use updateRehearsalAction

  const membersRaw = await prisma.user.findMany({
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      roles: { select: { role: true } },
    },
  });

  const dateKey = rehearsal.start.toISOString().slice(0, 10);
  const dayStart = new Date(`${dateKey}T00:00:00`);
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Probe bearbeiten"
        description={
          rehearsal.status === "DRAFT"
            ? "Passe Titel, Termine, Beschreibung und Teilnehmer deines Entwurfs an."
            : "Bearbeite diese veröffentlichte Probe. Alle Teilnehmer erhalten eine Benachrichtigung über Änderungen."
        }
      />

      <RehearsalEditor
        rehearsal={{
          id: rehearsal.id,
          status: rehearsal.status,
          title: rehearsal.title,
          start: rehearsal.start.toISOString(),
          location: rehearsal.location,
          description: rehearsal.description,
          inviteeIds: rehearsal.invitees.map((entry) => entry.userId),
          registrationDeadline: rehearsal.registrationDeadline
            ? rehearsal.registrationDeadline.toISOString()
            : null,
        }}
        members={members}
        initialBlockedUserIds={blocked.map((entry) => entry.userId)}
      />
    </div>
  );
}

import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { AddMemberModal } from "@/components/members/add-member-card";
import { sortRoles, type Role } from "@/lib/roles";
import { hasPermission } from "@/lib/permissions";
import { MembersTable } from "@/components/members/members-table";
import { MemberInviteManager } from "@/components/members/member-invite-manager";

export default async function MitgliederVerwaltungPage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.rollenverwaltung");
  if (!allowed) {
    return <div className="text-sm text-red-600">Kein Zugriff auf die Mitgliederverwaltung</div>;
  }

  const canManageInvites =
    (await hasPermission(session.user, "mitglieder.einladungen")) || allowed;

  const [users, customRoles] = await Promise.all([
    prisma.user.findMany({
      orderBy: { email: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        roles: { select: { role: true } },
        appRoles: { select: { role: { select: { id: true, name: true } } } },
        avatarSource: true,
        avatarImageUpdatedAt: true,
      },
    }),
    prisma.appRole.findMany({ where: { isSystem: false, systemRole: null }, orderBy: { name: "asc" } }),
  ]);

  const formatted = users.map((user) => {
    const combined = sortRoles([
      user.role as Role,
      ...user.roles.map((entry) => entry.role as Role),
    ]);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      roles: combined,
      customRoles: user.appRoles.map((ar) => ar.role),
      avatarSource: user.avatarSource,
      avatarUpdatedAt: user.avatarImageUpdatedAt?.toISOString() ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Mitgliederverwaltung</h1>
        <p className="text-sm text-foreground/70">
          Erstelle neue Mitgliederprofile und verwalte Rollen für bestehende Nutzer in einer Tabelle.
        </p>
      </div>

      {canManageInvites && <MemberInviteManager />}

      <div className="flex justify-end">
        <AddMemberModal />
      </div>

      <MembersTable
        users={formatted}
        canEditOwner={(session.user?.roles ?? []).includes("owner")}
        availableCustomRoles={customRoles}
      />
    </div>
  );
}


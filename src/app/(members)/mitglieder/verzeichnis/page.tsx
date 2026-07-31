import { MemberDirectoryClient, type DirectoryMember } from "./member-directory-client";

import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { combineNameParts } from "@/lib/names";
import { sortRoles } from "@/lib/roles";

export default async function MemberDirectoryPage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "PRIVATE.ADMIN.MEMBERS.MANAGE");
  if (!allowed) {
    return <div className="text-sm text-destructive">Kein Zugriff auf das Mitgliederverzeichnis</div>;
  }

  const users = await prisma.user.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { name: "asc" }, { email: "asc" }],
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      name: true,
      role: true,
      roles: { select: { role: true } },
    },
  });

  const members: DirectoryMember[] = users.map((user) => {
    const email = user.email ?? "Keine E-Mail hinterlegt";
    const name = combineNameParts(user.firstName, user.lastName) ?? user.name ?? email;
    return {
      id: user.id,
      email,
      name,
      roles: sortRoles([user.role, ...user.roles.map((entry) => entry.role)]),
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Verzeichnis</h1>
        <p className="text-sm text-muted-foreground">Durchsuche alle Mitglieder nach Namen und E-Mail-Adresse.</p>
      </div>

      <MemberDirectoryClient members={members} />
    </div>
  );
}

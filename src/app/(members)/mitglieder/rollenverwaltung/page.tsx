import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { RoleManager } from "@/components/members/role-manager";
import { AddMemberModal } from "@/components/members/add-member-card";
import { sortRoles, type Role } from "@/lib/roles";

export default async function RollenVerwaltungPage() {
  await requireAuth(["admin"]);
  const users = await prisma.user.findMany({
    orderBy: { email: "asc" },
    include: { roles: true },
  });

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
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Rollenverwaltung</h1>
        <p className="text-sm text-foreground/70">
          Erstelle neue Mitgliederprofile und verwalte Rollen für bestehende Nutzer.
        </p>
      </div>

      <div className="flex justify-end">
        <AddMemberModal />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {formatted.map((user) => (
          <RoleManager
            key={user.id}
            userId={user.id}
            email={user.email}
            name={user.name}
            initialRoles={user.roles}
          />
        ))}
      </div>
    </div>
  );
}

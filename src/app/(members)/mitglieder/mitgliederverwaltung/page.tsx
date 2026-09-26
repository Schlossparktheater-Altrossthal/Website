import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { AddMemberModal } from "@/components/members/add-member-card";
import { sortRoles, type Role } from "@/lib/roles";
import { hasPermission } from "@/lib/permissions";
import { MembersTable } from "@/components/members/members-table";
import { MemberInviteManager } from "@/components/members/member-invite-manager";
import { SeasonWizard } from "@/components/members/season-wizard";
import { combineNameParts } from "@/lib/names";
import { AUTHENTIK_PROVIDER_ID } from "@/lib/authentik/config";
import { readSeasonResetSettings, resolveProtectedRoles } from "@/lib/season-reset/settings";
import { getActiveProduction } from "@/lib/active-production";
import { UrlTabs, type UrlTab } from "@/components/ui/url-tabs";
import { PageHeader } from "@/components/members/page-header";

export default async function MemberManagementPage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "PRIVATE.ADMIN.MEMBERS.MANAGE");
  if (!allowed) {
    return (
      <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive-foreground">
        Kein Zugriff auf die Mitgliederverwaltung
      </div>
    );
  }

  const canManageInvites =
    (await hasPermission(session.user, "PRIVATE.ADMIN.INVITES.MANAGE")) || allowed;

  const production = await getActiveProduction(session.user?.id);

  const [users, customRoles, seasonResetRecord] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { name: "asc" }, { email: "asc" }],
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        name: true,
        role: true,
        roles: { select: { role: true } },
        appRoles: { select: { role: { select: { id: true, name: true } } } },
        avatarSource: true,
        avatarImageUpdatedAt: true,
        deactivatedAt: true,
        productionMemberships: production
          ? {
              where: { showId: production.id },
              select: { roles: true, function: true, status: true, leftAt: true },
              take: 1,
            }
          : false,
        accounts: { where: { provider: AUTHENTIK_PROVIDER_ID }, select: { id: true }, take: 1 },
      },
    }),
    prisma.appRole.findMany({
      where: { isSystem: false, systemRole: null },
      orderBy: { name: "asc" },
    }),
    readSeasonResetSettings(),
  ]);

  const protectedRoles = resolveProtectedRoles(seasonResetRecord);

  const formatted = users.map((user) => {
    const combined = sortRoles([
      user.role as Role,
      ...user.roles.map((entry) => entry.role as Role),
    ]);
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      name: combineNameParts(user.firstName, user.lastName) ?? user.name,
      roles: combined,
      customRoles: user.appRoles.map((ar) => ar.role),
      avatarSource: user.avatarSource,
      avatarUpdatedAt: user.avatarImageUpdatedAt?.toISOString() ?? null,
      isDeactivated: Boolean(user.deactivatedAt),
      deactivatedAt: user.deactivatedAt?.toISOString() ?? null,
      hasAuthentikAccount: user.accounts.length > 0,
      production: (() => {
        const membership = user.productionMemberships?.[0];
        if (!membership || membership.leftAt || membership.status === "left") return null;
        return {
          roles: sortRoles(membership.roles as Role[]),
          function: membership.function,
          pending: membership.status !== "active",
        };
      })(),
    };
  });

  const tabs: UrlTab[] = [
    {
      value: "mitglieder",
      label: "Mitglieder",
      content: (
        <MembersTable
          users={formatted}
          canEditOwner={(session.user?.roles ?? []).includes("owner")}
          availableCustomRoles={customRoles}
          productionTitle={production?.title ?? null}
          addMemberSlot={<AddMemberModal />}
        />
      ),
    },
    ...(canManageInvites
      ? [{ value: "einladungen", label: "Einladungen", content: <MemberInviteManager /> }]
      : []),
    {
      value: "saison",
      label: "Saisonwechsel",
      content: <SeasonWizard initialProtectedRoles={protectedRoles} />,
    },
    {
      value: "datenpflege",
      label: "Datenpflege",
      content: (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Löschfristen &amp; Doppel-Konten</CardTitle>
              <p className="text-sm text-muted-foreground">
                Abgelaufene Daten anonymisieren und doppelt angelegte Konten zusammenführen.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/mitglieder/mitgliederverwaltung/aufbewahrung">Öffnen</Link>
            </Button>
          </CardHeader>
        </Card>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Mitglieder" />
      <UrlTabs tabs={tabs} />
    </div>
  );
}

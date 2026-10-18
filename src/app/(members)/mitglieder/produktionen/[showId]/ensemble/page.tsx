import { notFound } from "next/navigation";
import type { PhotoConsentStatus, ProductionMembershipStatus } from "@prisma/client";

import { PageHeader } from "@/components/members/page-header";
import { ProductionStatusPill } from "@/components/production/production-status-pill";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { getUserDisplayName } from "@/lib/names";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { sanitizeProductionRoles } from "@/lib/produktionen/production-roles";
import { requireAuth } from "@/lib/rbac";

import {
  EnsembleView,
  type AddableMember,
  type EnsembleMember,
  type FormerMember,
} from "./ensemble-view";

function consentStatusOf(
  consents: ReadonlyArray<{ status: PhotoConsentStatus }>,
): PhotoConsentStatus | "none" {
  return consents.length > 0 ? consents[0].status : "none";
}

const STATUS_ORDER: ProductionMembershipStatus[] = ["active", "onboarding", "invited", "left"];

export default async function ProduktionEnsemblePage({
  params,
}: {
  params: Promise<{ showId: string }>;
}) {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "PRIVATE.PRODUCTION.SHOW.MANAGE"))) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
          Du hast keinen Zugriff auf diese Produktion.
        </div>
      </div>
    );
  }

  const { showId } = await params;
  const show = await prisma.show.findUnique({
    where: { id: showId },
    select: {
      id: true,
      title: true,
      year: true,
      status: true,
      memberships: {
        select: {
          id: true,
          status: true,
          roles: true,
          function: true,
          joinedAt: true,
          leftAt: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              name: true,
              email: true,
              deactivatedAt: true,
              photoConsents: {
                where: { showId, revokedAt: null },
                take: 1,
                select: { status: true },
              },
              productionOnboardings: {
                where: { showId },
                take: 1,
                select: { completedAt: true, isReturning: true },
              },
            },
          },
        },
      },
    },
  });
  if (!show) {
    notFound();
  }

  const title = show.title?.trim() || `Produktion ${show.year}`;
  const members = show.memberships
    .map((membership) => ({
      ...membership,
      name: getUserDisplayName(membership.user, "Unbekanntes Mitglied"),
      photoStatus: consentStatusOf(membership.user.photoConsents),
      onboarding: membership.user.productionOnboardings[0] ?? null,
    }))
    .sort(
      (a, b) =>
        STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
        a.name.localeCompare(b.name, "de"),
    );

  const currentIds = new Set(
    members.filter((member) => member.status !== "left").map((member) => member.user.id),
  );
  const users = await prisma.user.findMany({
    where: { id: { notIn: Array.from(currentIds) } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      name: true,
      email: true,
      deactivatedAt: true,
      productionMemberships: {
        where: { showId: { not: show.id } },
        orderBy: { joinedAt: "desc" },
        take: 1,
        select: { show: { select: { title: true, year: true } } },
      },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
  const candidates: AddableMember[] = users.map((user) => ({
    id: user.id,
    label: `${getUserDisplayName(user, user.email ?? "Unbekannt")}${
      user.deactivatedAt ? " (ehemalig)" : ""
    }`,
  }));

  // Ehemalige: waren in einer anderen Produktion, sind in dieser (noch) nicht dabei.
  const formerMembers: FormerMember[] = users
    .filter((user) => user.productionMemberships.length > 0)
    .map((user) => {
      const last = user.productionMemberships[0].show;
      return {
        id: user.id,
        name: getUserDisplayName(user, user.email ?? "Unbekannt"),
        lastProduction: last.title?.trim() || `Produktion ${last.year}`,
        hasEmail: Boolean(user.email),
      };
    });

  // Wie sendPhotoConsentReminders: fehlend oder abgelehnt, Konto aktiv.
  const remindablePhotoCount = members.filter(
    (member) =>
      member.status === "active" &&
      !member.user.deactivatedAt &&
      (member.photoStatus === "none" || member.photoStatus === "rejected"),
  ).length;
  const ensemble: EnsembleMember[] = members.map((member) => ({
    id: member.id,
    userId: member.user.id,
    name: member.name,
    status: member.status,
    roles: sanitizeProductionRoles(member.roles),
    func: member.function,
    photoStatus: member.photoStatus,
    onboardingDone: Boolean(member.onboarding?.completedAt),
    isReturning: Boolean(member.onboarding?.isReturning),
    deactivated: Boolean(member.user.deactivatedAt),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ensemble"
        description={
          <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <ProductionStatusPill status={show.status} />
            {title} · {show.year}
          </span>
        }
        breadcrumbs={[
          membersNavigationBreadcrumb("/mitglieder/produktionen"),
          { id: "verwalten", label: "Verwalten", href: "/mitglieder/produktionen/verwalten" },
          { id: show.id, label: title, href: `/mitglieder/produktionen/${show.id}` },
        ]}
      />
      <EnsembleView
        showId={show.id}
        members={ensemble}
        candidates={candidates}
        formerMembers={formerMembers}
        remindablePhotoCount={remindablePhotoCount}
      />
    </div>
  );
}

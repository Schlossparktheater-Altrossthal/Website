import Link from "next/link";
import { notFound } from "next/navigation";
import type { PhotoConsentStatus, ProductionMembershipStatus } from "@prisma/client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUserDisplayName } from "@/lib/names";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { sanitizeProductionRoles } from "@/lib/produktionen/production-roles";
import { PRODUCTION_STATUS_LABELS } from "@/lib/produktionen/status";
import { requireAuth } from "@/lib/rbac";

import {
  AddMemberForm,
  InviteFormerMembersForm,
  MemberRoleForm,
  ReminderActions,
  RemoveMemberForm,
  type AddableMember,
  type FormerMember,
} from "./ensemble-forms-client";

const MEMBERSHIP_STATUS_LABELS: Record<ProductionMembershipStatus, string> = {
  active: "Aktiv",
  invited: "Eingeladen",
  onboarding: "Im Onboarding",
  left: "Ausgeschieden",
};

const PHOTO_CONSENT_LABELS: Record<PhotoConsentStatus | "none", string> = {
  none: "Fotoerlaubnis fehlt",
  pending: "Fotoerlaubnis ausstehend",
  approved: "Fotoerlaubnis erteilt",
  rejected: "Fotoerlaubnis abgelehnt",
};

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
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
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

  const counts = {
    active: members.filter((member) => member.status === "active").length,
    open: members.filter((member) => member.status === "invited" || member.status === "onboarding")
      .length,
    missingPhoto: members.filter(
      (member) => member.status === "active" && member.photoStatus !== "approved",
    ).length,
    // Wie sendPhotoConsentReminders: fehlend oder abgelehnt, Konto aktiv.
    remindablePhoto: members.filter(
      (member) =>
        member.status === "active" &&
        !member.user.deactivatedAt &&
        (member.photoStatus === "none" || member.photoStatus === "rejected"),
    ).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {PRODUCTION_STATUS_LABELS[show.status]} · Jahrgang {show.year}
          </p>
          <h1 className="text-2xl font-semibold text-foreground">Ensemble: {title}</h1>
          <p className="text-sm text-muted-foreground">
            Ensemble- und Technik-Rollen gelten nur für diese Produktion. Wer eingeladen ist,
            bekommt Zugriff erst mit abgeschlossenem Onboarding.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/mitglieder/produktionen/${show.id}`}>Zur Produktion</Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">Aktiv: {counts.active}</Badge>
        <Badge variant="outline">Eingeladen/Onboarding offen: {counts.open}</Badge>
        <Badge variant="outline">Ohne erteilte Fotoerlaubnis: {counts.missingPhoto}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Erinnerungen &amp; Fotoliste</CardTitle>
          <p className="text-sm text-muted-foreground">
            Onboarding-Erinnerungen enthalten einen neuen persönlichen Link. Die Fotoliste zeigt,
            wen Fotograf:innen fotografieren dürfen – ausstehende Erlaubnisse zählen bis zur
            Freigabe als „nicht fotografieren“.
          </p>
        </CardHeader>
        <CardContent>
          <ReminderActions
            showId={show.id}
            openCount={counts.open}
            missingPhotoCount={counts.remindablePhoto}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ehemalige einladen</CardTitle>
          <p className="text-sm text-muted-foreground">
            Jede Person bekommt einen persönlichen Link. Damit meldet sie sich mit ihrem bisherigen
            Konto an, prüft ihre vorausgefüllten Angaben und gibt die Fotoerlaubnis für diese
            Produktion. Erst danach ist sie wieder freigeschaltet.
          </p>
        </CardHeader>
        <CardContent>
          <InviteFormerMembersForm showId={show.id} formerMembers={formerMembers} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mitglied aufnehmen</CardTitle>
        </CardHeader>
        <CardContent>
          <AddMemberForm showId={show.id} candidates={candidates} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mitglieder ({members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch niemand in dieser Produktion.</p>
          ) : (
            <ul className="divide-y divide-border">
              {members.map((member) => (
                <li key={member.id} className="space-y-3 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-1">
                      <Link
                        href={`/mitglieder/mitgliederverwaltung/${member.user.id}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {member.name}
                      </Link>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline">{MEMBERSHIP_STATUS_LABELS[member.status]}</Badge>
                        <Badge variant="outline">
                          {member.onboarding?.completedAt
                            ? member.onboarding.isReturning
                              ? "Onboarding (Rückkehr) abgeschlossen"
                              : "Onboarding abgeschlossen"
                            : "Onboarding offen"}
                        </Badge>
                        <Badge variant="outline">{PHOTO_CONSENT_LABELS[member.photoStatus]}</Badge>
                        {member.user.deactivatedAt ? (
                          <Badge variant="outline">Konto deaktiviert</Badge>
                        ) : null}
                      </div>
                    </div>
                    {member.status !== "left" ? (
                      <RemoveMemberForm membershipId={member.id} memberName={member.name} />
                    ) : null}
                  </div>
                  {member.status !== "left" ? (
                    <MemberRoleForm
                      membershipId={member.id}
                      memberName={member.name}
                      roles={sanitizeProductionRoles(member.roles)}
                      func={member.function}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

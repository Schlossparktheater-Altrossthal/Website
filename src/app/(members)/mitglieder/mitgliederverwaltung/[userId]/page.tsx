import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Mail, ShieldCheck, Sparkles } from "lucide-react";
import type { OnboardingFocus, PhotoConsentStatus } from "@prisma/client";

import { PageHeader } from "@/components/members/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { ROLE_BADGE_VARIANTS, ROLE_LABELS, sortRoles, type Role } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { getUserDisplayName } from "@/lib/names";

const dateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "long" });
const dateTimeFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });

const ONBOARDING_FOCUS_LABELS: Record<OnboardingFocus, string> = {
  acting: "Fokus Bühne & Schauspiel",
  tech: "Fokus Backstage & Technik",
  both: "Bühne & Backstage kombiniert",
};

const PHOTO_STATUS_LABELS: Record<PhotoConsentStatus, string> = {
  pending: "In Prüfung",
  approved: "Freigegeben",
  rejected: "Abgelehnt",
};

const PHOTO_STATUS_DESCRIPTIONS: Record<PhotoConsentStatus, string> = {
  pending: "Formular liegt vor und wartet auf finale Freigabe.",
  approved: "Die Freigabe wurde erteilt – Medien dürfen genutzt werden.",
  rejected: "Antrag wurde abgelehnt. Bitte Rücksprache mit der Administration halten.",
};

const PHOTO_STATUS_CLASSES: Record<PhotoConsentStatus, string> = {
  pending: "border-warning/50 bg-warning/10 text-warning",
  approved: "border-success/50 bg-success/10 text-success",
  rejected: "border-destructive/50 bg-destructive/10 text-destructive",
};

type PageProps = { params: { userId: string } };

type PhotoConsentInfo = {
  label: string;
  description: string;
  className: string;
  updatedAt: Date | null;
};

type PhotoConsentSelection = {
  status: PhotoConsentStatus;
  consentGiven: boolean;
  updatedAt: Date;
  approvedAt: Date | null;
};

function formatDate(value: Date | null | undefined) {
  if (!value) return "—";
  return dateFormatter.format(value);
}

function formatDateTime(value: Date | null | undefined) {
  if (!value) return null;
  return dateTimeFormatter.format(value);
}

function resolvePhotoConsent(consent: PhotoConsentSelection | null): PhotoConsentInfo {
  if (!consent) {
    return {
      label: "Noch nicht eingereicht",
      description: "Für dieses Mitglied liegt keine Fotoeinverständnis vor.",
      className: "border-border/70 bg-muted/40 text-muted-foreground",
      updatedAt: null,
    };
  }

  if (!consent.consentGiven) {
    return {
      label: "Keine Freigabe erteilt",
      description: "Die Veröffentlichung von Foto- und Videoaufnahmen ist untersagt.",
      className: "border-destructive/45 bg-destructive/10 text-destructive",
      updatedAt: consent.updatedAt ?? null,
    };
  }

  const status = consent.status;
  const label = PHOTO_STATUS_LABELS[status] ?? "Status unbekannt";
  const description = PHOTO_STATUS_DESCRIPTIONS[status] ?? "Status konnte nicht bestimmt werden.";
  const className = PHOTO_STATUS_CLASSES[status] ?? "border-border/70 bg-muted/40 text-muted-foreground";
  const updatedAt = consent.approvedAt ?? consent.updatedAt ?? null;

  return {
    label,
    description,
    className,
    updatedAt,
  };
}

export default async function MemberProfileAdminPage({ params }: PageProps) {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.rollenverwaltung");
  if (!allowed) {
    return <div className="text-sm text-red-600">Kein Zugriff auf die Mitgliederprofile.</div>;
  }

  const userIdParam = params.userId;
  const userId = Array.isArray(userIdParam) ? userIdParam[0] : userIdParam;
  const decodedId = decodeURIComponent(userId);

  const member = await prisma.user.findUnique({
    where: { id: decodedId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      name: true,
      email: true,
      role: true,
      roles: { select: { role: true } },
      appRoles: {
        select: {
          role: { select: { id: true, name: true, systemRole: true, isSystem: true } },
        },
      },
      avatarSource: true,
      avatarImageUpdatedAt: true,
      createdAt: true,
      dateOfBirth: true,
      onboardingProfile: {
        select: {
          memberSinceYear: true,
          focus: true,
          background: true,
          notes: true,
        },
      },
      interests: {
        select: {
          interest: { select: { id: true, name: true } },
        },
      },
      photoConsent: {
        select: {
          status: true,
          consentGiven: true,
          updatedAt: true,
          approvedAt: true,
        },
      },
    },
  });

  if (!member) {
    notFound();
  }

  const displayName = getUserDisplayName(
    {
      firstName: member.firstName,
      lastName: member.lastName,
      name: member.name,
      email: member.email,
    },
    "Unbekanntes Mitglied",
  );

  const systemRoles = sortRoles([
    member.role as Role,
    ...member.roles.map((entry) => entry.role as Role),
  ]);

  const customRoles = member.appRoles
    .map((entry) => entry.role)
    .filter(
      (role): role is { id: string; name: string; systemRole: Role | null; isSystem: boolean } => Boolean(role),
    )
    .filter((role) => !role.systemRole)
    .map((role) => ({ id: role.id, name: role.name }));

  const interestNames = Array.from(
    new Set(
      member.interests
        .map((entry) => entry.interest?.name?.trim())
        .filter((value): value is string => Boolean(value && value.length > 0)),
    ),
  );

  const photoConsentInfo = resolvePhotoConsent(member.photoConsent);
  const photoConsentUpdatedAt = formatDateTime(photoConsentInfo.updatedAt);

  const memberSinceLabel = member.onboardingProfile?.memberSinceYear
    ? `Seit ${member.onboardingProfile.memberSinceYear}`
    : `Seit ${formatDate(member.createdAt)}`;

  const onboardingFocus = member.onboardingProfile?.focus ?? null;
  const onboardingFocusLabel = onboardingFocus ? ONBOARDING_FOCUS_LABELS[onboardingFocus] : "Kein Schwerpunkt hinterlegt";

  const onboardingBackground = member.onboardingProfile?.background?.trim() ?? null;
  const onboardingNotes = member.onboardingProfile?.notes?.trim() ?? null;

  const email = member.email?.trim() ?? null;
  const dateOfBirthLabel = formatDate(member.dateOfBirth);
  const createdAtLabel = formatDateTime(member.createdAt);

  const pageTitle = `Profil von ${displayName}`;

  return (
    <div className="space-y-8">
      <PageHeader
        title={pageTitle}
        description="Einblick in Kontaktdaten, Rollen und Engagement des Mitglieds."
        actions={
          <Button
            asChild
            size="sm"
            variant="outline"
            className="gap-2 rounded-full border-border/70 bg-background/80 px-4 backdrop-blur transition hover:border-primary/50 hover:bg-primary/10"
          >
            <Link href="/mitglieder/mitgliederverwaltung">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Zurück zur Übersicht
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)] xl:items-start xl:gap-10 2xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)] 2xl:gap-12">
        <div className="space-y-6">
          <Card className="border border-border/70 bg-gradient-to-br from-background/85 via-background/70 to-background/80">
            <CardHeader className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <UserAvatar
                    userId={member.id}
                    firstName={member.firstName}
                    lastName={member.lastName}
                    name={displayName}
                    email={email}
                    avatarSource={member.avatarSource}
                    avatarUpdatedAt={member.avatarImageUpdatedAt?.toISOString() ?? null}
                    size={76}
                    className="h-[76px] w-[76px] border-border/80 text-xl shadow-sm"
                  />
                  <div className="space-y-1.5">
                    <CardTitle className="text-xl font-semibold leading-tight text-foreground">{displayName}</CardTitle>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarDays className="h-4 w-4" aria-hidden />
                      {memberSinceLabel}
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {systemRoles.length ? (
                  systemRoles.map((role) => (
                    <span
                      key={role}
                      className={cn(
                        "inline-flex items-center rounded-full border px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wide shadow-sm",
                        ROLE_BADGE_VARIANTS[role],
                      )}
                    >
                      {ROLE_LABELS[role] ?? role}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">Keine Systemrollen zugewiesen.</span>
                )}
              </div>

              {customRoles.length ? (
                <div className="flex flex-wrap gap-2">
                  {customRoles.map((role) => (
                    <Badge key={role.id} variant="secondary" className="border-primary/30 bg-primary/10 text-primary">
                      {role.name}
                    </Badge>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" aria-hidden />
                {email ? (
                  <a href={`mailto:${email}`} className="font-medium text-foreground transition hover:text-primary">
                    {email}
                  </a>
                ) : (
                  <span className="italic text-muted-foreground">Keine E-Mail hinterlegt</span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/70">
            <CardHeader className="space-y-1.5">
              <CardTitle className="text-lg">Team-Engagement</CardTitle>
              <p className="text-sm text-muted-foreground">
                Überblick über Onboarding-Schwerpunkt und Fotoeinverständnis des Mitglieds.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border/60 bg-background/70 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Sparkles className="h-4 w-4" aria-hidden />
                  Schwerpunkt im Onboarding
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{onboardingFocusLabel}</p>
                {onboardingBackground ? (
                  <p className="mt-2 text-xs text-muted-foreground">{onboardingBackground}</p>
                ) : null}
                {onboardingNotes ? (
                  <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{onboardingNotes}</p>
                ) : null}
              </div>

              <div className="rounded-lg border border-border/60 bg-background/70 p-4 shadow-sm">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                  Fotoeinverständnis
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      "gap-2 rounded-full px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wide",
                      photoConsentInfo.className,
                    )}
                  >
                    {photoConsentInfo.label}
                  </Badge>
                  {photoConsentUpdatedAt ? (
                    <span className="text-xs text-muted-foreground">Stand: {photoConsentUpdatedAt}</span>
                  ) : null}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{photoConsentInfo.description}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border border-border/70">
            <CardHeader className="space-y-2">
              <CardTitle>Stammdaten</CardTitle>
              <p className="text-sm text-muted-foreground">Zentrale Kontaktdaten und interne Kennungen des Mitglieds.</p>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vorname</dt>
                  <dd className="text-sm font-medium text-foreground">{member.firstName?.trim() || "—"}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nachname</dt>
                  <dd className="text-sm font-medium text-foreground">{member.lastName?.trim() || "—"}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Anzeigename</dt>
                  <dd className="text-sm font-medium text-foreground">{member.name?.trim() || "—"}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">E-Mail</dt>
                  <dd className="text-sm font-medium text-foreground">
                    {email ? (
                      <a href={`mailto:${email}`} className="transition hover:text-primary">
                        {email}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Geburtsdatum</dt>
                  <dd className="text-sm font-medium text-foreground">{dateOfBirthLabel}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Konto erstellt</dt>
                  <dd className="text-sm font-medium text-foreground">{createdAtLabel ?? "—"}</dd>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mitglieds-ID</dt>
                  <dd className="text-xs font-mono text-muted-foreground">{member.id}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card className="border border-border/70">
            <CardHeader className="space-y-2">
              <CardTitle>Rollen &amp; Berechtigungen</CardTitle>
              <p className="text-sm text-muted-foreground">
                Übersicht über zugewiesene Systemrollen und optionale Zusatzrollen.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Systemrollen</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {systemRoles.length ? (
                    systemRoles.map((role) => (
                      <span
                        key={role}
                        className={cn(
                          "inline-flex items-center rounded-full border px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wide shadow-sm",
                          ROLE_BADGE_VARIANTS[role],
                        )}
                      >
                        {ROLE_LABELS[role] ?? role}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">Keine Systemrollen vergeben.</span>
                  )}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Zusätzliche Rollen</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {customRoles.length ? (
                    customRoles.map((role) => (
                      <Badge key={role.id} variant="outline" className="border-primary/30 bg-primary/5 text-primary">
                        {role.name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">Keine zusätzlichen Rollen hinterlegt.</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/70">
            <CardHeader className="space-y-2">
              <CardTitle>Interessen &amp; Talente</CardTitle>
              <p className="text-sm text-muted-foreground">
                Schlagworte aus dem Mitgliederprofil unterstützen bei der Planung von Besetzungen und Aufgaben.
              </p>
            </CardHeader>
            <CardContent>
              {interestNames.length ? (
                <div className="flex flex-wrap gap-2">
                  {interestNames.map((interest) => (
                    <Badge
                      key={interest}
                      variant="outline"
                      className="border-primary/30 bg-primary/5 text-primary"
                    >
                      {interest}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Noch keine Interessen hinterlegt.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

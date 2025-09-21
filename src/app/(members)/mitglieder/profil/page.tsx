import { notFound } from "next/navigation";
import { PageHeader } from "@/components/members/page-header";
import { PhotoConsentCard } from "@/components/members/photo-consent-card";
import { ProfileForm } from "@/components/members/profile-form";
import { ProfileInterestsCard } from "@/components/members/profile-interests-card";
import { ProfileSummaryCard } from "@/components/members/profile-summary-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import {
  ROLE_BADGE_VARIANTS,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  sortRoles,
  type Role,
} from "@/lib/roles";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import {
  CheckCircle2,
  Crown,
  Gavel,
  PiggyBank,
  ShieldCheck,
  UsersRound,
  VenetianMask,
  Wrench,
} from "lucide-react";

const ROLE_ICON_MAP: Record<Role, LucideIcon> = {
  member: UsersRound,
  cast: VenetianMask,
  tech: Wrench,
  board: Gavel,
  finance: PiggyBank,
  owner: Crown,
  admin: ShieldCheck,
};

const ROLE_ICON_ACCENTS: Record<Role, string> = {
  member: "border-emerald-400/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-200",
  cast: "border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-200",
  tech: "border-sky-400/40 bg-sky-500/10 text-sky-600 dark:text-sky-200",
  board: "border-teal-400/40 bg-teal-500/10 text-teal-600 dark:text-teal-200",
  finance: "border-amber-400/40 bg-amber-500/10 text-amber-600 dark:text-amber-200",
  owner: "border-purple-400/40 bg-purple-500/10 text-purple-600 dark:text-purple-200",
  admin: "border-rose-400/40 bg-rose-500/10 text-rose-600 dark:text-rose-200",
};

const ROLE_STATUS_BADGE_CLASSES =
  "border-emerald-400/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";

export default async function ProfilePage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.profil");
  if (!allowed) {
    return <div className="text-sm text-destructive">Kein Zugriff auf den Profilbereich</div>;
  }
  const userId = session.user?.id;

  if (!userId) {
    notFound();
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      role: true,
      roles: { select: { role: true } },
      avatarSource: true,
      avatarImageUpdatedAt: true,
      dateOfBirth: true,
    },
  });

  if (!user) {
    notFound();
  }

  const roles = sortRoles([user.role as Role, ...user.roles.map((r) => r.role as Role)]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Mein Profil"
        description="Halte deine Stammdaten aktuell und behalte im Blick, welche Rollen dir Zugriff auf die Module geben."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.48fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <ProfileSummaryCard
            userId={userId}
            name={user.name}
            email={user.email}
            roles={roles}
            avatarSource={user.avatarSource}
            avatarUpdatedAt={user.avatarImageUpdatedAt?.toISOString() ?? null}
          />

          <PhotoConsentCard />

          <Card>
            <CardHeader className="space-y-2">
              <CardTitle>Rollen & Berechtigungen</CardTitle>
              <p className="text-sm text-muted-foreground">
                Deine Rollen steuern Sichtbarkeit und Handlungsrechte im Mitgliederportal. Wende dich bei fehlenden Rechten an
                die Administration.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              {roles.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {roles.map((role) => (
                      <Badge
                        key={role}
                        className={cn(
                          "px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wide shadow-sm",
                          ROLE_BADGE_VARIANTS[role],
                        )}
                      >
                        {ROLE_LABELS[role] ?? role}
                      </Badge>
                    ))}
                  </div>
                  <ul className="space-y-3">
                    {roles.map((role) => {
                      const Icon = ROLE_ICON_MAP[role];
                      const description = ROLE_DESCRIPTIONS[role] ?? "Diese Rolle ist aktuell aktiv.";
                      return (
                        <li
                          key={role}
                          className="flex gap-3 rounded-lg border border-border/60 bg-background/70 p-3 shadow-sm"
                        >
                          <div
                            className={cn(
                              "flex h-10 w-10 items-center justify-center rounded-full border text-sm",
                              ROLE_ICON_ACCENTS[role],
                            )}
                            aria-hidden
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-foreground">{ROLE_LABELS[role] ?? role}</span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide",
                                  ROLE_STATUS_BADGE_CLASSES,
                                )}
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                                Aktiv
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">{description}</p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <div className="rounded-md border border-dashed border-border/60 bg-background/60 p-4 text-sm text-muted-foreground">
                  Dir sind aktuell keine Rollen zugewiesen. Wende dich an die Produktionsleitung, wenn dir Inhalte fehlen.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader className="space-y-2">
              <CardTitle>Profildaten</CardTitle>
              <p className="text-sm text-muted-foreground">
                Name, Kontaktadresse und Passwort kannst du hier eigenständig anpassen. Änderungen werden sofort übernommen.
              </p>
            </CardHeader>
            <CardContent className="space-y-0">
              <ProfileForm
                userId={userId}
                initialName={user.name}
                initialEmail={user.email}
                initialAvatarSource={user.avatarSource}
                initialAvatarUpdatedAt={user.avatarImageUpdatedAt?.toISOString() ?? null}
                initialDateOfBirth={user.dateOfBirth?.toISOString() ?? null}
              />
            </CardContent>
          </Card>

          <ProfileInterestsCard />
        </div>
      </div>
    </div>
  );
}

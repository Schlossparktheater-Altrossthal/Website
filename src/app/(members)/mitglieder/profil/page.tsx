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
      firstName: true,
      lastName: true,
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
    <div className="relative space-y-10 sm:space-y-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-gradient-to-b from-primary/10 via-transparent to-transparent blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 left-1/2 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-secondary/15 blur-3xl dark:bg-secondary/20"
      />
      <section className="relative overflow-hidden rounded-3xl border border-border/50 bg-background/80 px-6 py-8 shadow-xl shadow-primary/10 backdrop-blur sm:px-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 top-0 h-44 w-44 rounded-full bg-primary/15 opacity-60 blur-3xl dark:bg-primary/25"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 bottom-0 h-36 w-36 rounded-full bg-amber-200/30 opacity-70 blur-3xl dark:bg-amber-500/15"
        />
        <PageHeader
          title="Mein Profil"
          description="Halte deine Stammdaten aktuell und behalte im Blick, welche Rollen dir Zugriff auf die Module geben."
        />
        <div className="mt-6 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
          <Badge
            variant="outline"
            size="sm"
            className="flex items-center gap-2 border-primary/30 bg-primary/10 text-primary/80"
          >
            <UsersRound className="h-3.5 w-3.5" aria-hidden />
            {roles.length === 1 ? "1 aktive Rolle" : `${roles.length} aktive Rollen`}
          </Badge>
          <Badge
            variant="outline"
            size="sm"
            className="flex items-center gap-2 border-muted-foreground/20 bg-muted/20 text-muted-foreground"
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Datenpflege in Eigenregie
          </Badge>
        </div>
      </section>

      <div className="grid gap-6 lg:gap-8 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)] xl:items-start xl:gap-10 2xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)] 2xl:gap-12">
        <div className="space-y-6 xl:space-y-8">
          <ProfileSummaryCard
            userId={userId}
            firstName={user.firstName}
            lastName={user.lastName}
            name={user.name}
            email={user.email}
            roles={roles}
            avatarSource={user.avatarSource}
            avatarUpdatedAt={user.avatarImageUpdatedAt?.toISOString() ?? null}
          />

          <PhotoConsentCard />

          <Card className="rounded-2xl border border-border/60 bg-background/80 p-0 shadow-lg shadow-primary/10">
            <CardHeader className="space-y-2 px-6 pb-4 pt-6 sm:px-7">
              <CardTitle>Rollen &amp; Berechtigungen</CardTitle>
              <p className="text-sm text-muted-foreground">
                Deine Rollen steuern Sichtbarkeit und Handlungsrechte im Mitgliederportal. Wende dich bei fehlenden Rechten an die Administration.
              </p>
            </CardHeader>
            <CardContent className="space-y-5 px-6 pb-6 sm:px-7">
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
                          className="flex gap-3 rounded-xl border border-border/60 bg-background/70 p-3 shadow-sm backdrop-blur"
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
        <div className="space-y-6 xl:space-y-8">
          <Card className="rounded-2xl border border-border/60 bg-background/80 p-0 shadow-lg shadow-primary/10">
            <CardHeader className="space-y-2 px-6 pb-4 pt-6 sm:px-7">
              <CardTitle>Profildaten</CardTitle>
              <p className="text-sm text-muted-foreground">
                Name, Kontaktadresse und Passwort kannst du hier eigenständig anpassen. Änderungen werden sofort übernommen.
              </p>
            </CardHeader>
            <CardContent className="space-y-0 px-6 pb-6 sm:px-7">
              <ProfileForm
                userId={userId}
                initialFirstName={user.firstName}
                initialLastName={user.lastName}
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

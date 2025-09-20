import { notFound } from "next/navigation";
import { PageHeader } from "@/components/members/page-header";
import { PhotoConsentCard } from "@/components/members/photo-consent-card";
import { ProfileForm } from "@/components/members/profile-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { ROLE_BADGE_VARIANTS, ROLE_LABELS, sortRoles, type Role } from "@/lib/roles";

export default async function ProfilePage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.profil");
  if (!allowed) {
    return <div className="text-sm text-red-600">Kein Zugriff auf den Profilbereich</div>;
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
    <div className="space-y-6">
      <PageHeader
        title="Mein Profil"
        description="Pflege deine Kontaktdaten und behalte den Überblick über deine Berechtigungsrollen."
      />

      <PhotoConsentCard />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.65fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Rollen & Berechtigungen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-foreground/80">
            <p>
              Deine Rollen bestimmen, welche Bereiche im Mitgliederportal sichtbar sind und welche Aktionen du ausführen
              darfst. Für weitere Rechte wende dich bitte an die Administration.
            </p>
            <div className="flex flex-wrap gap-2">
              {roles.length > 0 ? (
                roles.map((role) => (
                  <Badge key={role} className={ROLE_BADGE_VARIANTS[role]}>
                    {ROLE_LABELS[role] ?? role}
                  </Badge>
                ))
              ) : (
                <span className="text-foreground/70">Derzeit sind keine Rollen hinterlegt.</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profildaten</CardTitle>
          </CardHeader>
          <CardContent>
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
      </div>
    </div>
  );
}

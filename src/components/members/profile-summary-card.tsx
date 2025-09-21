"use client";

import { Mail, UserRoundCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserAvatar, type AvatarSource } from "@/components/user-avatar";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { getUserDisplayName } from "@/lib/names";

const dateFormatter = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" });

const AVATAR_SOURCE_LABELS: Record<AvatarSource, string> = {
  GRAVATAR: "Gravatar",
  INITIALS: "Initialen",
  UPLOAD: "Eigenes Bild",
};

function normalizeAvatarSource(value?: AvatarSource | string | null): AvatarSource | null {
  if (!value) return null;
  const normalized = value.toString().trim().toUpperCase();
  if (normalized === "GRAVATAR" || normalized === "UPLOAD" || normalized === "INITIALS") {
    return normalized as AvatarSource;
  }
  return null;
}

function formatUpdatedAt(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return null;
  return `Aktualisiert am ${dateFormatter.format(parsed)}`;
}

export interface ProfileSummaryCardProps {
  userId: string;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  email: string | null;
  roles: Role[];
  avatarSource: AvatarSource | string | null;
  avatarUpdatedAt: string | null;
}

export function ProfileSummaryCard({
  userId,
  firstName,
  lastName,
  name,
  email,
  roles,
  avatarSource,
  avatarUpdatedAt,
}: ProfileSummaryCardProps) {
  const displayName = getUserDisplayName({ firstName, lastName, name, email }, "") || "Unbenanntes Profil";
  const normalizedEmail = email?.trim() ?? "";
  const hasEmail = Boolean(normalizedEmail);
  const normalizedSource = normalizeAvatarSource(avatarSource);
  const avatarSourceLabel = normalizedSource ? AVATAR_SOURCE_LABELS[normalizedSource] : "Automatisch";
  const avatarInfo = formatUpdatedAt(avatarUpdatedAt);
  const rolesSummary = roles.length
    ? `Aktive Rollen: ${roles.map((role) => ROLE_LABELS[role] ?? role).join(", ")}`
    : "Noch keine Rollen zugewiesen.";

  return (
    <Card className="relative overflow-hidden border border-border/70 bg-gradient-to-br from-background/85 via-background/70 to-background/80">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
          <UserAvatar
            userId={userId}
            firstName={firstName}
            lastName={lastName}
            name={displayName}
            email={email}
            avatarSource={avatarSource}
            avatarUpdatedAt={avatarUpdatedAt}
            size={76}
            className="h-[76px] w-[76px] border-border/80 text-xl shadow-sm"
          />
            <div className="space-y-1.5">
              <CardTitle className="text-xl font-semibold leading-tight text-foreground">{displayName}</CardTitle>
              <p className="text-sm text-muted-foreground">{rolesSummary}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border/60 bg-background/80 p-3 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Primäre Adresse</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "px-3 py-1 text-xs font-medium",
                  hasEmail
                    ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
                    : "border-amber-400/40 bg-amber-500/10 text-amber-700 dark:text-amber-200"
                )}
              >
                <Mail className="h-3.5 w-3.5" aria-hidden />
                {hasEmail ? normalizedEmail : "keine Adresse"}
              </Badge>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {hasEmail
                ? "Wir verwenden diese Adresse für Login und Benachrichtigungen."
                : "Ohne Adresse können wir dich nicht erreichen – ergänze sie im Formular."}
            </p>
          </div>

          <div className="rounded-lg border border-border/60 bg-background/80 p-3 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Profilbild</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="px-3 py-1 text-xs font-medium border-primary/40 bg-primary/10 text-primary/80 dark:text-primary/60"
              >
                <UserRoundCheck className="h-3.5 w-3.5" aria-hidden />
                {avatarSourceLabel}
              </Badge>
              {avatarInfo ? <span className="text-xs text-muted-foreground">{avatarInfo}</span> : null}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Passe Quelle oder Bild direkt im Formular an – Änderungen erscheinen sofort im Portal.
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="text-xs text-muted-foreground">
        Aktualisiere deine Stammdaten regelmäßig, damit Teamlisten, Einladungen und Rollenbadges auf dem neuesten Stand bleiben.
      </CardContent>
    </Card>
  );
}

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
    <Card className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/5 via-background/80 to-background/95 p-0 shadow-lg shadow-primary/10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-20 h-48 w-48 rounded-full bg-primary/15 opacity-60 blur-3xl dark:bg-primary/25"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 bottom-0 h-40 w-40 rounded-full bg-emerald-200/30 opacity-70 blur-3xl dark:bg-emerald-500/15"
      />
      <CardHeader className="space-y-5 px-6 pb-6 pt-6 sm:px-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:gap-5 sm:text-left">
            <UserAvatar
              userId={userId}
              firstName={firstName}
              lastName={lastName}
              name={displayName}
              email={email}
              avatarSource={avatarSource}
              avatarUpdatedAt={avatarUpdatedAt}
              size={80}
              className="h-20 w-20 border border-border/70 bg-background/80 text-xl shadow-md ring-2 ring-primary/20"
            />
            <div className="space-y-1.5">
              <CardTitle className="text-xl font-semibold leading-tight text-foreground">{displayName}</CardTitle>
              <p className="text-sm text-muted-foreground">{rolesSummary}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border/60 bg-background/85 p-4 shadow-sm backdrop-blur">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Primäre Adresse</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                size="sm"
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

          <div className="rounded-xl border border-border/60 bg-background/85 p-4 shadow-sm backdrop-blur">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Profilbild</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                size="sm"
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

      <CardContent className="border-t border-border/60 px-6 pb-6 pt-5 text-xs text-muted-foreground sm:px-7">
        Aktualisiere deine Stammdaten regelmäßig, damit Teamlisten, Einladungen und Rollenbadges auf dem neuesten Stand bleiben.
      </CardContent>
    </Card>
  );
}

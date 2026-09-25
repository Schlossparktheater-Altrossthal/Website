"use client";

import { Badge } from "@/components/ui/badge";
import { ProgressRing } from "@/components/ui/progress-ring";
import { UserAvatar } from "@/components/user-avatar";
import type { ProfileCompletionSummary } from "@/lib/profile-completion";
import { ROLE_LABELS, sortRoles } from "@/lib/roles";

import type { ProfileUser } from "./profile-shared";

type ProfileHeaderProps = {
  user: ProfileUser;
  displayName: string;
  summary: ProfileCompletionSummary;
};

/** Kopf der Profilseite: Bild, Name, Rollen und Vollständigkeit auf einen Blick. */
export function ProfileHeader({ user, displayName, summary }: ProfileHeaderProps) {
  const roles = sortRoles([...new Set(user.roles)]);
  const openCount = summary.total - summary.completed;

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border/60 bg-card p-4 shadow-sm">
      <UserAvatar
        userId={user.id}
        email={user.email}
        firstName={user.firstName}
        lastName={user.lastName}
        name={displayName}
        size={64}
        className="h-14 w-14 shrink-0 text-lg sm:h-16 sm:w-16"
        avatarSource={user.avatarSource}
        avatarUpdatedAt={user.avatarUpdatedAt}
      />
      <div className="min-w-0 flex-1 space-y-1">
        <h2 className="truncate text-lg font-semibold leading-tight text-foreground">
          {displayName}
        </h2>
        {user.email ? <p className="truncate text-sm text-muted-foreground">{user.email}</p> : null}
        <div className="flex flex-wrap gap-1 pt-0.5">
          {roles.map((role) => (
            <Badge key={role} variant="muted" size="sm">
              {ROLE_LABELS[role] ?? role}
            </Badge>
          ))}
          {user.customRoles.map((role) => (
            <Badge key={role.id} variant="muted" size="sm">
              {role.name}
            </Badge>
          ))}
        </div>
      </div>
      {summary.total ? (
        <div className="flex shrink-0 flex-col items-center gap-1 text-center">
          <ProgressRing value={summary.completed} max={summary.total} size={48} />
          <span className="text-[0.7rem] leading-tight text-muted-foreground">
            {openCount ? `${openCount} offen` : "Vollständig"}
          </span>
        </div>
      ) : null}
    </div>
  );
}

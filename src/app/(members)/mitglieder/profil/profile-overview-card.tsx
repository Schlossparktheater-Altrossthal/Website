"use client";

import { CalendarDaysIcon, CheckIcon, MailIcon, UsersIcon } from "@/components/ui/action-icons";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";
import {
  type ProfileChecklistTarget,
  type ProfileCompletionSummary,
} from "@/lib/profile-completion";
import { cn } from "@/lib/utils";
import { type Role } from "@prisma/client";
import { ProfileClientProps, ProfileUser, HighlightTileConfig } from "./profile-shared";

type ProfileOverviewCardProps = {
  user: ProfileUser;
  displayName: string;
  sortedRoles: Role[];
  summary: ProfileCompletionSummary;
  onboarding: ProfileClientProps["onboarding"];
  createdAtLabel: string | null;
  memberSinceLabel: string | null;
  percentComplete: number;
  highlights: HighlightTileConfig[];
  activeChecklistTarget?: ProfileChecklistTarget;
  onChecklistNavigate?: (target: ProfileChecklistTarget) => void;
};

export function ProfileOverviewCard({
  user,
  displayName,
  sortedRoles,
  summary,
  onboarding,
  createdAtLabel,
  memberSinceLabel,
  percentComplete,
  highlights,
  activeChecklistTarget,
  onChecklistNavigate,
}: ProfileOverviewCardProps) {
  const email = user.email?.trim() ?? "";
  const show = onboarding?.show ?? null;
  const showTitle = show?.title && show.title.trim().length ? show.title.trim() : null;
  const showYear = typeof show?.year === "number" ? show.year : null;
  const showLabel = show
    ? showTitle
      ? showYear
        ? `${showTitle} (${showYear})`
        : showTitle
      : showYear
        ? `Produktion ${showYear}`
        : "Produktion"
    : null;
  const checklistBadgeLabel = summary.complete ? "Profil vollständig" : null;
  const checklistCountLabel = summary.total ? `${summary.completed}/${summary.total}` : null;
  const pendingChecklistItems = summary.items.filter((item) => !item.complete);
  const hasChecklistItems = pendingChecklistItems.length > 0;
  const hasHighlights = highlights.length > 0;

  return (
    <Card className="border border-border/60 bg-card shadow-sm">
      <CardHeader className="space-y-4 pb-2">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
            <UserAvatar
              userId={user.id}
              email={user.email}
              firstName={user.firstName}
              lastName={user.lastName}
              name={displayName}
              size={80}
              className="h-20 w-20 shrink-0 border border-border/60 text-xl shadow-sm sm:h-20 sm:w-20"
              avatarSource={user.avatarSource}
              avatarUpdatedAt={user.avatarUpdatedAt}
            />
            <div className="space-y-2 text-center sm:text-left">
              <div className="flex flex-col items-center gap-2 sm:flex-row sm:flex-wrap">
                <CardTitle className="text-lg font-semibold leading-tight text-foreground sm:text-xl">
                  {displayName}
                </CardTitle>
                {checklistBadgeLabel ? (
                  <Badge
                    variant={summary.complete ? "secondary" : "outline"}
                    className={cn(
                      "gap-2 rounded-full px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wide",
                      summary.complete
                        ? "border-success/60 bg-success/10 text-success"
                        : "border-primary/50 bg-primary/10 text-primary",
                    )}
                  >
                    {checklistBadgeLabel}
                  </Badge>
                ) : null}
              </div>
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                {email ? (
                  <a
                    href={`mailto:${email}`}
                    className="flex items-center justify-center gap-2 font-medium text-foreground transition hover:text-primary sm:justify-start"
                  >
                    <MailIcon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="truncate">{email}</span>
                  </a>
                ) : (
                  <span className="flex items-center justify-center gap-2 text-muted-foreground/80 sm:justify-start">
                    <MailIcon className="h-4 w-4 shrink-0" aria-hidden />
                    Keine E-Mail hinterlegt
                  </span>
                )}
                {memberSinceLabel || createdAtLabel ? (
                  <div className="flex items-center justify-center gap-2 text-sm font-medium text-foreground sm:justify-start">
                    <CalendarDaysIcon className="h-4 w-4 shrink-0" aria-hidden />
                    <span>
                      {memberSinceLabel ?? (createdAtLabel ? `Profil seit ${createdAtLabel}` : "")}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-2">
        <div className="flex flex-wrap gap-2">
          {sortedRoles.map((role) => (
            <Badge
              key={role}
              variant="outline"
              className="rounded-full border-border/60 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wide"
            >
              {role}
            </Badge>
          ))}
          {user.customRoles.map((role) => (
            <Badge
              key={role.id}
              variant="secondary"
              className="rounded-full px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wide"
            >
              {role.name}
            </Badge>
          ))}
        </div>
        {summary.total && !summary.complete ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Profilstatus</span>
              <span>{checklistCountLabel}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full border border-border/60 bg-muted/40">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  summary.complete ? "bg-success" : "bg-primary",
                )}
                style={{ width: `${Math.min(100, Math.max(0, percentComplete))}%` }}
              />
            </div>
          </div>
        ) : null}
        {hasChecklistItems || hasHighlights ? (
          <div
            className={cn(
              "grid gap-4",
              hasChecklistItems && hasHighlights
                ? "lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"
                : "",
            )}
          >
            {hasChecklistItems ? (
              <div className="rounded-xl border border-border/60 bg-background/80 p-4 shadow-inner shadow-primary/5">
                <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Checkliste
                </div>
                <ul className="mt-3 space-y-2">
                  {pendingChecklistItems.map((item) => {
                    const target = item.targetSection ?? null;
                    const isActive = target ? activeChecklistTarget === target : false;
                    const isComplete = item.complete;

                    const content = (
                      <div className="flex w-full items-start gap-3">
                        <span
                          className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-full border text-[0.65rem] transition",
                            isComplete
                              ? "border-success/60 bg-success/10 text-success"
                              : "border-border/60 bg-background text-muted-foreground/40",
                            isActive ? "ring-2 ring-primary/30" : "",
                          )}
                          aria-hidden
                        >
                          {isComplete ? <CheckIcon className="h-3 w-3" aria-hidden /> : null}
                        </span>
                        <span
                          className={cn(
                            "flex-1 text-left text-xs leading-snug",
                            isComplete
                              ? "text-muted-foreground/80 line-through"
                              : "text-foreground",
                          )}
                        >
                          {item.label}
                        </span>
                      </div>
                    );

                    if (target) {
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => onChecklistNavigate?.(target)}
                            className={cn(
                              "flex w-full items-center rounded-lg border border-transparent bg-background/40 px-3 py-2 text-left transition",
                              isActive
                                ? "border-primary/50 bg-primary/10 text-foreground shadow-sm"
                                : "hover:border-border/60 hover:bg-muted/40 text-foreground/90",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                            )}
                          >
                            {content}
                          </button>
                        </li>
                      );
                    }

                    return (
                      <li
                        key={item.id}
                        className={cn(
                          "flex items-center rounded-lg border px-3 py-2",
                          isComplete
                            ? "border-success/40 bg-success/10"
                            : "border-border/50 bg-muted/30",
                        )}
                      >
                        {content}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {hasHighlights ? (
              <div className="flex flex-col gap-3">
                {highlights.map((tile) => (
                  <ProfileHighlightTile key={tile.id} {...tile} />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {show ? (
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/70 p-3 text-xs text-muted-foreground">
            <UsersIcon className="h-4 w-4 text-muted-foreground/80" aria-hidden />
            <span>
              Produktion: {showLabel}
              {show?.periodLabel ? ` · ${show.periodLabel}` : ""}
            </span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

type ProfileHighlightTileProps = Omit<HighlightTileConfig, "id">;

function ProfileHighlightTile({
  icon,
  title,
  description,
  hint,
  tone = "default",
  action,
}: ProfileHighlightTileProps) {
  const toneClasses: Record<NonNullable<ProfileHighlightTileProps["tone"]>, string> = {
    default:
      "border-border/60 bg-gradient-to-br from-background via-background/95 to-background shadow-lg shadow-primary/5 backdrop-blur",
    info: "border-primary/50 bg-gradient-to-br from-primary/18 via-primary/10 to-background shadow-xl shadow-primary/10 text-primary",
    success:
      "border-success/50 bg-gradient-to-br from-success/18 via-success/10 to-background shadow-xl text-success",
    warning:
      "border-warning/50 bg-gradient-to-br from-warning/18 via-warning/10 to-background shadow-xl text-warning",
  };

  const iconClasses: Record<NonNullable<ProfileHighlightTileProps["tone"]>, string> = {
    default: "border-border/50 bg-background/80 text-muted-foreground",
    info: "border-primary/40 bg-primary/15 text-primary",
    success: "border-success/45 bg-success/15 text-success",
    warning: "border-warning/45 bg-warning/15 text-warning",
  };

  return (
    <div className={cn("flex h-full flex-col gap-3 rounded-2xl border p-5", toneClasses[tone])}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/90">
            {title}
          </p>
          <p className="text-sm font-semibold leading-5 text-foreground">{description}</p>
        </div>
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl border text-sm",
            iconClasses[tone],
          )}
        >
          {icon}
        </div>
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {action ? <div className="mt-auto pt-2">{action}</div> : null}
    </div>
  );
}

import Link from "next/link";
import type { CSSProperties } from "react";
import { CalendarDays, Clock } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  ROLE_BADGE_VARIANTS,
  ROLE_LABELS,
  TASK_STATUS_BADGES,
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER,
  type DepartmentMembershipWithDepartment,
  countBlockedDays,
  findMeetingSuggestions,
  formatUserName,
  getDueMeta,
  hexToRgba,
} from "./utils";

type DepartmentCardProps = {
  membership: DepartmentMembershipWithDepartment;
  userId: string;
  planningStart: Date;
  planningEnd: Date;
  blockedByUser: Map<string, Set<string>>;
  freezeUntilLabel: string;
  planningWindowLabel: string;
  now: Date;
  teamLinkHref?: string;
  teamLinkLabel?: string;
};

export function DepartmentCard({
  membership,
  userId,
  planningStart,
  planningEnd,
  blockedByUser,
  freezeUntilLabel,
  planningWindowLabel,
  now,
  teamLinkHref,
  teamLinkLabel = "Team öffnen",
}: DepartmentCardProps) {
  const { department } = membership;

  const sortedMembers = [...department.memberships].sort((a, b) =>
    formatUserName(a.user).localeCompare(formatUserName(b.user), "de", { sensitivity: "base" }),
  );

  const sortedTasks = [...department.tasks].sort((a, b) => {
    const statusDiff = TASK_STATUS_ORDER[a.status] - TASK_STATUS_ORDER[b.status];
    if (statusDiff !== 0) return statusDiff;
    const dueA = a.dueAt ? a.dueAt.getTime() : Number.MAX_SAFE_INTEGER;
    const dueB = b.dueAt ? b.dueAt.getTime() : Number.MAX_SAFE_INTEGER;
    if (dueA !== dueB) return dueA - dueB;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const activeTasks = sortedTasks.filter((task) => task.status !== "done");
  const completedTasks = sortedTasks.filter((task) => task.status === "done");

  const memberIdsForDepartment = department.memberships.map((entry) => entry.userId);
  const meetingSuggestions = findMeetingSuggestions(
    memberIdsForDepartment,
    planningStart,
    planningEnd,
    blockedByUser,
  );
  const blockedDatesCount = countBlockedDays(memberIdsForDepartment, blockedByUser);

  const accentStyle = {
    "--card-accent": department.color ?? "#6366f1",
    "--card-accent-overlay": hexToRgba(department.color, 0.2),
  } as CSSProperties;

  return (
    <Card
      className="relative overflow-hidden rounded-3xl border border-border/60 bg-background/80 shadow-[0_30px_120px_-60px_rgba(99,102,241,0.65)]"
      style={accentStyle}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--card-accent-overlay),_transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-10 top-0 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${hexToRgba(department.color, 0.5)}, transparent)`,
        }}
      />

      <CardHeader className="relative z-[1] space-y-6 pb-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-border/60 bg-background/90 shadow-inner">
              <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: department.color ?? "#94a3b8" }} />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-xl font-semibold text-foreground">{department.name}</CardTitle>
              {department.description ? (
                <p className="text-sm text-muted-foreground">{department.description}</p>
              ) : null}
            </div>
          </div>
          {teamLinkHref ? (
            <Button
              asChild
              size="sm"
              variant="outline"
              className="rounded-full border-border/60 bg-background/80 px-4 backdrop-blur hover:border-primary/40"
            >
              <Link href={teamLinkHref}>{teamLinkLabel}</Link>
            </Button>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant={ROLE_BADGE_VARIANTS[membership.role]} size="sm">
            {ROLE_LABELS[membership.role]}
          </Badge>
          {membership.title ? (
            <Badge variant="outline" size="sm" className="border-border/60">
              {membership.title}
            </Badge>
          ) : null}
          {membership.note ? (
            <span className="rounded-full border border-border/50 bg-background/80 px-3 py-1 text-[11px]">
              Notiz: {membership.note}
            </span>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="relative z-[1] space-y-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-inner">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">Teamübersicht</h3>
              <Badge variant="muted" size="sm">
                {sortedMembers.length} Personen
              </Badge>
            </div>
            <ul className="mt-4 space-y-3">
              {sortedMembers.map((member) => {
                const isCurrentUser = member.userId === userId;
                return (
                  <li
                    key={member.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/90 px-3 py-3 transition hover:border-primary/40"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">{formatUserName(member.user)}</p>
                      {member.title ? (
                        <p className="text-xs text-muted-foreground">{member.title}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={ROLE_BADGE_VARIANTS[member.role]} size="sm">
                        {ROLE_LABELS[member.role]}
                      </Badge>
                      {isCurrentUser ? (
                        <Badge variant="outline" size="sm" className="border-primary/40 text-primary">
                          Du
                        </Badge>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="space-y-4 rounded-2xl border border-border/60 bg-background/80 p-4 shadow-inner">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">Terminvorschläge</h3>
              <Badge variant="muted" size="sm">
                {blockedDatesCount} blockierte Tage
              </Badge>
            </div>
            {meetingSuggestions.length ? (
              <ul className="grid gap-3 sm:grid-cols-2">
                {meetingSuggestions.map((suggestion) => (
                  <li
                    key={suggestion.key}
                    className="group flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-background/90 p-3 transition hover:border-primary/50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <CalendarDays aria-hidden className="h-5 w-5" />
                      </span>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">{suggestion.label}</p>
                        <p className="text-xs text-muted-foreground">Frei für alle Mitglieder</p>
                      </div>
                    </div>
                    <Badge variant="outline" size="sm" className="rounded-full border-primary/40 text-primary">
                      {suggestion.shortLabel}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aktuell gibt es keinen Termin ohne Sperrlisten-Konflikte. Prüfe deine Sperrtage und die deines Teams.
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                Fenster: {freezeUntilLabel} – {planningWindowLabel}
              </span>
              <Link
                href="/mitglieder/sperrliste"
                className="inline-flex items-center gap-1 font-semibold text-primary transition hover:text-primary/80"
              >
                <CalendarDays aria-hidden className="h-4 w-4" />
                Sperrliste öffnen
              </Link>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-inner">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">Meine Aufgaben</h3>
            <Badge variant="muted" size="sm">
              {sortedTasks.length} Aufgaben
            </Badge>
          </div>
          {activeTasks.length ? (
            <ul className="mt-4 grid gap-3 md:grid-cols-2">
              {activeTasks.map((task) => {
                const dueMeta = task.dueAt ? getDueMeta(task.dueAt, now) : null;
                return (
                  <li
                    key={task.id}
                    className="group rounded-2xl border border-border/60 bg-background/90 p-4 transition hover:border-primary/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <p className="text-sm font-medium leading-6 text-foreground">{task.title}</p>
                        {task.description ? (
                          <p className="text-sm text-muted-foreground">{task.description}</p>
                        ) : null}
                        {dueMeta ? (
                          <p
                            className={cn(
                              "flex items-center gap-2 text-xs transition",
                              dueMeta.isOverdue ? "text-destructive" : "text-muted-foreground",
                            )}
                          >
                            <Clock aria-hidden className="h-4 w-4" />
                            Fällig {dueMeta.relative} ({dueMeta.absolute})
                          </p>
                        ) : null}
                      </div>
                      <Badge variant={TASK_STATUS_BADGES[task.status]} size="sm" className="rounded-full">
                        {TASK_STATUS_LABELS[task.status]}
                      </Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              Keine offenen Aufgaben in diesem Gewerk – du bist auf dem aktuellen Stand.
            </p>
          )}

          {completedTasks.length ? (
            <details className="group mt-4 rounded-2xl border border-border/50 bg-background/80 p-4 shadow-inner transition open:border-primary/40">
              <summary className="flex cursor-pointer items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground">
                <span>Abgeschlossene Aufgaben</span>
                <span className="text-[11px] text-muted-foreground group-open:hidden">Öffnen</span>
                <span className="hidden text-[11px] text-muted-foreground group-open:inline">Schließen</span>
              </summary>
              <ul className="mt-4 space-y-3 text-sm">
                {completedTasks.map((task) => {
                  const dueMeta = task.dueAt ? getDueMeta(task.dueAt, now) : null;
                  return (
                    <li key={task.id} className="rounded-xl border border-border/60 bg-background/90 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">{task.title}</p>
                          {dueMeta ? (
                            <p className="text-xs text-muted-foreground">Fällig war {dueMeta.absolute}</p>
                          ) : null}
                        </div>
                        <Badge variant={TASK_STATUS_BADGES[task.status]} size="sm" className="rounded-full">
                          {TASK_STATUS_LABELS[task.status]}
                        </Badge>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </details>
          ) : null}
        </section>
      </CardContent>
    </Card>
  );
}

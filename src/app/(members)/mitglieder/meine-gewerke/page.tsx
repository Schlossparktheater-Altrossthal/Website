import Link from "next/link";

import { PageHeader } from "@/components/members/page-header";
import { ChevronRightIcon } from "@/components/ui/action-icons";
import { resolveTeamsViewer } from "@/lib/departments/access";
import { loadMyTeams, type TeamCard } from "@/lib/departments/portal";
import { CASTING_TYPE_LABELS, loadMyRoles, type RoleCard } from "@/lib/departments/roles";

import { CalendarIcon, ListTodoIcon } from "@/components/ui/action-icons";

import { formatShortDate, TEAM_ROLE_LABELS, tint } from "./team-ui";

export default async function MeineTeamsPage() {
  const { userId, isManager, production } = await resolveTeamsViewer();

  if (!userId || !production) {
    return (
      <div className="space-y-6">
        <PageHeader title="Meine Teams" />
        <div className="py-12 text-center">
          <p className="text-muted-foreground">Wähle zuerst eine aktive Produktion aus.</p>
        </div>
      </div>
    );
  }

  const [teams, roles] = await Promise.all([
    loadMyTeams(userId, production.id, isManager),
    loadMyRoles(userId, production.id, isManager),
  ]);
  const myRoles = roles.filter((role) => role.myCasting);
  const otherRoles = roles.filter((role) => !role.myCasting);
  const mine = teams.filter((team) => team.role);
  const others = teams.filter((team) => !team.role);
  const leadsSomething = mine.some((team) => team.role === "lead");

  return (
    <div className="space-y-6">
      <PageHeader title="Meine Teams" />

      {myRoles.length ? (
        <section className="space-y-3" aria-labelledby="my-roles">
          <h2 id="my-roles" className="text-sm font-medium text-muted-foreground">
            {myRoles.length === 1 ? "Meine Rolle" : "Meine Rollen"}
          </h2>
          <RoleGrid roles={myRoles} />
        </section>
      ) : null}

      {mine.length === 0 && (isManager || myRoles.length) ? null : mine.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">
            Du bist noch keinem Gewerk zugewiesen. Die Regie teilt die Gewerke anhand deiner Wünsche
            aus dem Onboarding zu.
          </p>
        </div>
      ) : (
        <section className="space-y-3" aria-labelledby="my-teams">
          {myRoles.length ? (
            <h2 id="my-teams" className="text-sm font-medium text-muted-foreground">
              {mine.length === 1 ? "Mein Gewerk" : "Meine Gewerke"}
            </h2>
          ) : null}
          <TeamGrid teams={mine} />
        </section>
      )}

      {leadsSomething || isManager ? (
        <Link
          href="/mitglieder/produktionen/zuweisung"
          className="flex min-h-11 items-center justify-between rounded-xl border border-border bg-card px-3 text-sm font-medium hover:bg-muted/40"
        >
          Anfragen und Wünsche bearbeiten
          <ChevronRightIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
        </Link>
      ) : null}

      {others.length ? (
        <section className="space-y-3" aria-labelledby="other-teams">
          <h2 id="other-teams" className="text-sm font-medium text-muted-foreground">
            {mine.length ? "Weitere Gewerke der Produktion" : "Alle Gewerke der Produktion"}
          </h2>
          <TeamGrid teams={others} />
        </section>
      ) : null}

      {otherRoles.length ? (
        <section className="space-y-3" aria-labelledby="other-roles">
          <h2 id="other-roles" className="text-sm font-medium text-muted-foreground">
            Rollen der Produktion
          </h2>
          <RoleGrid roles={otherRoles} />
        </section>
      ) : null}
    </div>
  );
}

function TeamGrid({ teams }: { teams: TeamCard[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      {teams.map((team) => (
        <li key={team.id}>
          <Link
            href={`/mitglieder/meine-gewerke/${encodeURIComponent(team.slug)}`}
            className="relative flex h-full min-h-32 flex-col gap-2 overflow-hidden rounded-2xl border border-border bg-card p-3 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
            style={{
              backgroundImage: `linear-gradient(160deg, ${tint(team.color, 28)}, transparent 70%)`,
            }}
          >
            <span className="flex items-start justify-between gap-2">
              <span
                aria-hidden
                className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-foreground"
                style={{ backgroundColor: tint(team.color, 45) }}
              >
                {team.name.slice(0, 1)}
              </span>
              {team.requestCount && team.role === "lead" ? (
                <span className="rounded-full bg-warning px-1.5 py-0.5 text-[11px] font-semibold text-warning-foreground">
                  {team.requestCount} neu
                </span>
              ) : null}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold leading-tight">
                {team.name}
              </span>
              <span className="block text-xs text-muted-foreground">
                {team.role ? TEAM_ROLE_LABELS[team.role] : "Einblick"} · {team.memberCount}{" "}
                {team.memberCount === 1 ? "Person" : "Personen"}
              </span>
            </span>
            <span className="mt-auto space-y-0.5 text-xs">
              <span className="flex items-center gap-1.5 text-foreground/90">
                <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">
                  {team.nextEvent
                    ? `${formatShortDate(team.nextEvent.start)} ${team.nextEvent.title}`
                    : "Kein Termin"}
                </span>
              </span>
              <span className="flex items-center gap-1.5 text-foreground/90">
                <ListTodoIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">
                  {team.myOpenTasks
                    ? `${team.myOpenTasks} für dich · ${team.openTasks} offen`
                    : `${team.openTasks} offen`}
                </span>
              </span>
              <span className="block truncate text-muted-foreground">
                {team.leads.length ? `Leitung: ${team.leads.join(", ")}` : "Leitung offen"}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function RoleGrid({ roles }: { roles: RoleCard[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      {roles.map((role) => {
        const partner = role.cast.filter((entry) => entry.type !== role.myCasting);
        return (
          <li key={role.id}>
            <Link
              href={`/mitglieder/meine-gewerke/rolle/${encodeURIComponent(role.id)}`}
              className="relative flex h-full min-h-28 flex-col gap-2 overflow-hidden rounded-2xl border border-border bg-card p-3 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
              style={{
                backgroundImage: `linear-gradient(160deg, ${tint(role.color, 28)}, transparent 70%)`,
              }}
            >
              <span
                aria-hidden
                className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-foreground"
                style={{ backgroundColor: tint(role.color, 45) }}
              >
                {role.name.slice(0, 1)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold leading-tight">
                  {role.name}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {role.myCasting ? CASTING_TYPE_LABELS[role.myCasting] : "Rolle"} ·{" "}
                  {role.sceneCount} {role.sceneCount === 1 ? "Szene" : "Szenen"}
                </span>
              </span>
              <span className="mt-auto block truncate text-xs text-muted-foreground">
                {role.myCasting
                  ? partner.length
                    ? `Mit: ${partner.map((entry) => entry.name).join(", ")}`
                    : "Keine Zweitbesetzung"
                  : role.cast.length
                    ? role.cast.map((entry) => entry.name).join(", ")
                    : "Noch nicht besetzt"}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

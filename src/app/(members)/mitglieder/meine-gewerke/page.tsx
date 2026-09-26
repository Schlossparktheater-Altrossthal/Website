import Link from "next/link";

import { PageHeader } from "@/components/members/page-header";
import { ChevronRightIcon } from "@/components/ui/action-icons";
import { resolveTeamsViewer } from "@/lib/departments/access";
import { loadMyTeams, type TeamCard } from "@/lib/departments/portal";

import { ColorDot, formatEventDate, TEAM_ROLE_LABELS } from "./team-ui";

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

  const teams = await loadMyTeams(userId, production.id, isManager);
  const mine = teams.filter((team) => team.role);
  const others = teams.filter((team) => !team.role);
  const leadsSomething = mine.some((team) => team.role === "lead");

  return (
    <div className="space-y-6">
      <PageHeader title="Meine Teams" />

      {mine.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">
            Du bist noch keinem Gewerk zugewiesen. Die Regie teilt die Gewerke anhand deiner Wünsche
            aus dem Onboarding zu.
          </p>
        </div>
      ) : (
        <TeamGrid teams={mine} />
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
            Weitere Gewerke der Produktion
          </h2>
          <TeamGrid teams={others} />
        </section>
      ) : null}
    </div>
  );
}

function TeamGrid({ teams }: { teams: TeamCard[] }) {
  return (
    <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card lg:grid lg:grid-cols-2 lg:divide-y-0 lg:gap-px lg:bg-border/60">
      {teams.map((team) => {
        const meta = [
          team.myOpenTasks
            ? `${team.myOpenTasks} ${team.myOpenTasks === 1 ? "Aufgabe" : "Aufgaben"} für dich`
            : `${team.openTasks} offen`,
          team.nextEvent ? formatEventDate(team.nextEvent.start) : null,
        ].filter(Boolean);
        return (
          <li key={team.id} className="bg-card">
            <Link
              href={`/mitglieder/meine-gewerke/${encodeURIComponent(team.slug)}`}
              className="flex min-h-14 items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <ColorDot color={team.color} className="h-3 w-3" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">{team.name}</span>
                  {team.role ? (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {TEAM_ROLE_LABELS[team.role]}
                    </span>
                  ) : null}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {meta.join(" · ")}
                </span>
              </span>
              {team.requestCount && team.role === "lead" ? (
                <span className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
                  {team.requestCount} neu
                </span>
              ) : null}
              <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

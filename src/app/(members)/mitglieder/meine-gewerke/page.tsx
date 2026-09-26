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
      <PageHeader
        title="Meine Teams"
        description={`Deine Gewerke in ${production.title ?? production.year}.`}
      />

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
          className="flex min-h-12 items-center justify-between rounded-xl border border-border bg-card px-4 text-sm font-medium hover:bg-muted/40"
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
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {teams.map((team) => (
        <li key={team.id}>
          <Link
            href={`/mitglieder/meine-gewerke/${encodeURIComponent(team.slug)}`}
            className="flex h-full flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex items-center gap-2">
              <ColorDot color={team.color} className="h-3 w-3" />
              <span className="min-w-0 flex-1 truncate text-base font-semibold">{team.name}</span>
              {team.role ? (
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {TEAM_ROLE_LABELS[team.role]}
                </span>
              ) : null}
            </span>
            <span className="grid grid-cols-3 gap-2 text-center">
              <Stat
                value={team.memberCount}
                label={team.memberCount === 1 ? "Person" : "Personen"}
              />
              <Stat value={team.myOpenTasks} label="Für mich" />
              <Stat value={team.openTasks} label="Offen" />
            </span>
            <span className="space-y-1 text-sm text-muted-foreground">
              <span className="block truncate">
                {team.nextEvent
                  ? `Nächster Termin: ${formatEventDate(team.nextEvent.start)} · ${team.nextEvent.title}`
                  : "Kein Termin geplant"}
              </span>
              <span className="block truncate">
                Leitung: {team.leads.length ? team.leads.join(", ") : "noch offen"}
              </span>
              {team.requestCount && team.role === "lead" ? (
                <span className="block text-warning">
                  {team.requestCount} {team.requestCount === 1 ? "Anfrage" : "Anfragen"}
                </span>
              ) : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <span className="rounded-lg bg-muted/60 py-2">
      <span className="block text-lg font-semibold text-foreground">{value}</span>
      <span className="block text-xs text-muted-foreground">{label}</span>
    </span>
  );
}

import {
  DirectionChips,
  DirectionEmpty,
  DirectionGroupHeading,
  DirectionViewHeader,
} from "@/components/regie/direction-ui";
import { StatTile } from "@/components/ui/stat-tile";
import {
  formatDay,
  loadDirectionCasting,
  loadDirectionScenes,
  loadDirectionSceneStats,
} from "@/lib/regie/data";
import {
  directionHref,
  firstParam,
  resolveDirectionPage,
  type DirectionSearchParams,
} from "@/lib/regie/page";
import { cn } from "@/lib/utils";

import { redirectWithoutShow } from "../no-show";

export const metadata = { title: "Szenen · Regie" };

const FILTERS = {
  alle: "Alle",
  nie: "Noch nie geprobt",
  geplant: "Demnächst dran",
  offen: "Rolle unbesetzt",
} as const;
type Filter = keyof typeof FILTERS;

/** Je Szene: Probenstand (wie oft, zuletzt, nächstes Mal) und wer spielt. */
export default async function DirectionScenesPage({
  searchParams,
}: {
  searchParams: DirectionSearchParams;
}) {
  const params = await searchParams;
  const { show } = await resolveDirectionPage(searchParams);
  if (!show) redirectWithoutShow();
  const [scenes, roles, stats] = await Promise.all([
    loadDirectionScenes(show.id),
    loadDirectionCasting(show.id),
    loadDirectionSceneStats(show.id),
  ]);
  const roleById = new Map(roles.map((role) => [role.id, role]));
  const filterParam = firstParam(params.filter);
  const filter: Filter = filterParam && filterParam in FILTERS ? (filterParam as Filter) : "alle";

  const rows = scenes.map((scene) => {
    const stat = stats.get(scene.id) ?? { rehearsed: 0, last: null, next: null };
    const sceneRoles = scene.characterIds
      .map((id) => roleById.get(id))
      .filter((role): role is NonNullable<typeof role> => Boolean(role));
    return {
      ...scene,
      stat,
      roles: sceneRoles,
      uncast: sceneRoles.filter((role) => !role.castings.length).length,
    };
  });
  const matches: Record<Filter, (row: (typeof rows)[number]) => boolean> = {
    alle: () => true,
    nie: (row) => row.stat.rehearsed === 0,
    geplant: (row) => Boolean(row.stat.next),
    offen: (row) => row.uncast > 0,
  };
  const shown = rows.filter(matches[filter]);
  const acts = [...new Set(shown.map((row) => row.act))];
  const link = (value: Filter) => `${directionHref("szenen", show.id)}&filter=${value}`;

  return (
    <div className="space-y-4">
      <DirectionViewHeader
        title="Szenen"
        description="Probenstand und Besetzung je Szene"
        showId={show.id}
        pdfKind="szenen"
      />
      {scenes.length ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <StatTile label="Szenen" value={rows.length} />
            <StatTile label="schon geprobt" value={rows.filter((r) => r.stat.rehearsed).length} />
            <StatTile
              label="noch nie"
              value={rows.filter((r) => !r.stat.rehearsed).length}
              tone={rows.some((r) => !r.stat.rehearsed) ? "warning" : "neutral"}
            />
          </div>
          <DirectionChips
            items={(Object.keys(FILTERS) as Filter[]).map((value) => ({
              href: link(value),
              label: FILTERS[value],
              active: filter === value,
              count: rows.filter(matches[value]).length,
            }))}
          />
          {shown.length ? (
            acts.map((act) => (
              <section key={act} className="space-y-2">
                {acts.length > 1 || act ? (
                  <DirectionGroupHeading>{act}. Akt</DirectionGroupHeading>
                ) : null}
                <ul className="space-y-2">
                  {shown
                    .filter((row) => row.act === act)
                    .map((row) => (
                      <li key={row.id} className="rounded-xl border border-border/70 bg-card p-3">
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-medium">{row.label}</p>
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
                              row.stat.rehearsed
                                ? "bg-success/15 text-success"
                                : "bg-warning/15 text-warning",
                            )}
                          >
                            {row.stat.rehearsed ? `${row.stat.rehearsed}× geprobt` : "nie geprobt"}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {[
                            row.stat.last ? `zuletzt ${formatDay(row.stat.last)}` : null,
                            row.stat.next
                              ? `nächste Probe ${formatDay(row.stat.next)}`
                              : "keine Probe geplant",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        {row.roles.length ? (
                          <ul className="mt-2 flex flex-wrap gap-1.5 text-xs">
                            {row.roles.map((role) => {
                              const cast = role.castings
                                .map((c) => c.name.split(" ")[0])
                                .join(" / ");
                              return (
                                <li
                                  key={role.id}
                                  className={cn(
                                    "rounded-md border px-1.5 py-0.5",
                                    cast
                                      ? "border-border bg-muted/50"
                                      : "border-warning/50 text-warning",
                                  )}
                                >
                                  {role.name}
                                  <span className={cast ? "text-muted-foreground" : ""}>
                                    {" "}
                                    · {cast || "unbesetzt"}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Noch keine Rollen zugeordnet.
                          </p>
                        )}
                      </li>
                    ))}
                </ul>
              </section>
            ))
          ) : (
            <DirectionEmpty>Keine Szene passt zu diesem Filter.</DirectionEmpty>
          )}
        </>
      ) : (
        <DirectionEmpty>Noch keine Szenen angelegt.</DirectionEmpty>
      )}
    </div>
  );
}

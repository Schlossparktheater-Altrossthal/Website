import {
  DirectionChips,
  DirectionEmpty,
  DirectionViewHeader,
} from "@/components/regie/direction-ui";
import { StatTile } from "@/components/ui/stat-tile";
import { loadDirectionCasting, loadDirectionScenes } from "@/lib/regie/data";
import {
  directionHref,
  firstParam,
  resolveDirectionPage,
  type DirectionSearchParams,
} from "@/lib/regie/page";
import { CASTING_LABELS } from "@/lib/regie/pdf";
import { cn } from "@/lib/utils";

import { redirectWithoutShow } from "../no-show";

export const metadata = { title: "Besetzung · Regie" };

const FILTERS = { alle: "Alle", offen: "Unbesetzt", doppelt: "Doppelt besetzt" } as const;
type Filter = keyof typeof FILTERS;
const SORTS = { stueck: "Reihenfolge", umfang: "Nach Szenenzahl" } as const;
type Sort = keyof typeof SORTS;

/** Rollen mit Besetzung, Zweitbesetzung und in wie vielen Szenen sie vorkommen. */
export default async function DirectionCastingPage({
  searchParams,
}: {
  searchParams: DirectionSearchParams;
}) {
  const params = await searchParams;
  const { show } = await resolveDirectionPage(searchParams);
  if (!show) redirectWithoutShow();
  const [roles, scenes] = await Promise.all([
    loadDirectionCasting(show.id),
    loadDirectionScenes(show.id),
  ]);
  const filterParam = firstParam(params.filter);
  const filter: Filter = filterParam && filterParam in FILTERS ? (filterParam as Filter) : "alle";
  const sort: Sort = firstParam(params.sort) === "umfang" ? "umfang" : "stueck";

  const rows = roles.map((role) => ({
    ...role,
    scenes: scenes.filter((scene) => scene.characterIds.includes(role.id)),
  }));
  const matches: Record<Filter, (row: (typeof rows)[number]) => boolean> = {
    alle: () => true,
    offen: (row) => !row.castings.length,
    doppelt: (row) => row.castings.length > 1,
  };
  const shown = rows.filter(matches[filter]);
  if (sort === "umfang") shown.sort((a, b) => b.scenes.length - a.scenes.length);
  const link = (next: { filter?: Filter; sort?: Sort }) =>
    `${directionHref("besetzung", show.id)}&filter=${next.filter ?? filter}&sort=${next.sort ?? sort}`;
  const people = new Set(rows.flatMap((row) => row.castings.map((c) => c.userId))).size;

  return (
    <div className="space-y-4">
      <DirectionViewHeader
        title="Besetzung"
        description="Rollen, wer sie spielt und wie groß sie sind"
        showId={show.id}
        pdfKind="besetzung"
      />
      {roles.length ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <StatTile label="Rollen" value={rows.length} />
            <StatTile label="Darsteller" value={people} />
            <StatTile
              label="unbesetzt"
              value={rows.filter(matches.offen).length}
              tone={rows.some(matches.offen) ? "warning" : "success"}
            />
          </div>
          <div className="space-y-2">
            <DirectionChips
              items={(Object.keys(FILTERS) as Filter[]).map((value) => ({
                href: link({ filter: value }),
                label: FILTERS[value],
                active: filter === value,
                count: rows.filter(matches[value]).length,
              }))}
            />
            <DirectionChips
              items={(Object.keys(SORTS) as Sort[]).map((value) => ({
                href: link({ sort: value }),
                label: SORTS[value],
                active: sort === value,
              }))}
            />
          </div>
          {shown.length ? (
            <ul className="space-y-2">
              {shown.map((role) => (
                <li
                  key={role.id}
                  className="rounded-xl border border-border/70 bg-card p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="flex items-center gap-2 font-medium">
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-full bg-muted-foreground/40"
                        style={role.color ? { backgroundColor: role.color } : undefined}
                      />
                      {role.name}
                    </p>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {role.scenes.length} {role.scenes.length === 1 ? "Szene" : "Szenen"}
                    </span>
                  </div>
                  {role.castings.length ? (
                    <ul className="mt-1.5 space-y-0.5 pl-[1.125rem]">
                      {role.castings.map((casting) => (
                        <li key={`${casting.userId}-${casting.type}`}>
                          {casting.name}
                          {casting.type !== "primary" ? (
                            <span className="text-xs text-muted-foreground">
                              {" "}
                              · {CASTING_LABELS[casting.type]}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1.5 pl-[1.125rem] font-medium text-warning">noch unbesetzt</p>
                  )}
                  {role.scenes.length ? (
                    <details className="mt-1.5 pl-[1.125rem]">
                      <summary className="cursor-pointer text-xs text-primary">
                        Szenen zeigen
                      </summary>
                      <ul className="mt-1 flex flex-wrap gap-1 text-xs">
                        {role.scenes.map((scene) => (
                          <li key={scene.id} className={cn("rounded-md bg-muted px-1.5 py-0.5")}>
                            {scene.label}
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <DirectionEmpty>Keine Rolle passt zu diesem Filter.</DirectionEmpty>
          )}
        </>
      ) : (
        <DirectionEmpty>Noch keine Rollen angelegt.</DirectionEmpty>
      )}
    </div>
  );
}

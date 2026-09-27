import { ChevronDownIcon } from "@/components/ui/action-icons";
import { Card } from "@/components/ui/card";
import { loadSceneStats } from "@/lib/calendar/scene-schedule-server";
import { prisma } from "@/lib/prisma";

const SHORT_DATE = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Europe/Berlin",
});

/** Probenstand pro Szene: selten Geprobtes steht oben. */
export async function SceneOverview({ showId }: { showId: string }) {
  const [scenes, stats] = await Promise.all([
    prisma.scene.findMany({
      where: { showId },
      orderBy: [{ act: "asc" }, { sequence: "asc" }],
      select: { id: true, identifier: true, sequence: true, title: true },
    }),
    loadSceneStats(showId),
  ]);
  if (!scenes.length) return null;

  const rows = scenes
    .map((scene) => ({
      ...scene,
      label: `Sz. ${scene.identifier || scene.sequence}${scene.title ? ` ${scene.title}` : ""}`,
      ...(stats[scene.id] ?? { rehearsed: 0, lastRehearsedAt: null, planned: 0 }),
    }))
    .sort((a, b) => a.rehearsed + a.planned - (b.rehearsed + b.planned) || a.sequence - b.sequence);

  const neverRehearsed = rows.filter((row) => row.rehearsed + row.planned === 0).length;

  return (
    <Card variant="plain" size="flush" className="border-border">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0">
            <span className="block text-base font-semibold leading-tight">Szenen-Stand</span>
            <span className="block text-xs text-muted-foreground">
              {neverRehearsed
                ? `${neverRehearsed} von ${rows.length} Szenen noch nie geprobt oder angesetzt`
                : `Alle ${rows.length} Szenen sind geprobt oder angesetzt`}
            </span>
          </span>
          <ChevronDownIcon
            aria-hidden
            className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          />
        </summary>
        <ul className="divide-y divide-border border-t border-border">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
              <span className="min-w-0 truncate font-medium">{row.label}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {row.rehearsed}× geprobt
                {row.lastRehearsedAt
                  ? ` · ${SHORT_DATE.format(new Date(row.lastRehearsedAt))}`
                  : ""}
                {row.planned ? ` · ${row.planned}× geplant` : ""}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}

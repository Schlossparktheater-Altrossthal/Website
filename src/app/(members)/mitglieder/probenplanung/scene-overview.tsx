import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Szenen-Stand</CardTitle>
        <p className="text-sm text-muted-foreground">
          Wie oft jede Szene geprobt wurde und noch angesetzt ist – selten Geprobtes zuerst.
        </p>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-1 p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="font-medium">{row.label}</span>
              <span className="text-xs text-muted-foreground">
                {row.rehearsed}× geprobt
                {row.lastRehearsedAt
                  ? ` · zuletzt ${SHORT_DATE.format(new Date(row.lastRehearsedAt))}`
                  : ""}
                {` · ${row.planned}× angesetzt`}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

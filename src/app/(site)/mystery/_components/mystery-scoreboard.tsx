import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Text } from "@/components/ui/typography";

const DATE_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

const NUMBER_FORMATTER = new Intl.NumberFormat("de-DE");

type ScoreboardEntry = {
  playerName: string;
  totalScore: number;
  correctCount: number;
  lastUpdated: string | null;
};

export function MysteryScoreboard({ entries }: { entries: ScoreboardEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Community-Scoreboard</CardTitle>
        <Text variant="small" tone="muted">
          Punkte gibt es für richtige Tipps pro Rätsel. Wer sammelt die meisten Treffer?
        </Text>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <Text variant="small" tone="muted">Noch keine Punkte vergeben – reiche deinen Tipp ein und sichere dir den ersten Platz!</Text>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-left text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Spielername
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Punkte
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Richtige Tipps
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Zuletzt aktualisiert
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {entries.map((entry) => (
                  <tr key={entry.playerName} className="bg-background/60">
                    <td className="px-3 py-2 font-medium text-foreground">{entry.playerName}</td>
                    <td className="px-3 py-2 font-semibold text-foreground">
                      {NUMBER_FORMATTER.format(entry.totalScore)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{entry.correctCount}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {entry.lastUpdated ? DATE_FORMATTER.format(new Date(entry.lastUpdated)) : "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { Trophy } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

const NUMBER_FORMATTER = new Intl.NumberFormat("de-DE");

type ScoreboardEntry = {
  playerName: string;
  totalScore: number;
  correctCount: number;
  lastUpdated: string | null;
};

function initialsFor(name: string) {
  const cleaned = name.trim();
  if (!cleaned) return "--";
  return cleaned.slice(0, 2).toUpperCase();
}

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
                  <th className="px-3 py-2 font-semibold">Rang</th>
                  <th className="px-3 py-2 font-semibold">Spieler</th>
                  <th className="px-3 py-2 font-semibold">Punkte</th>
                  <th className="px-3 py-2 font-semibold">Rätsel-Treffer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {entries.map((entry, index) => {
                  const rank = index + 1;
                  const isTopThree = rank <= 3;
                  return (
                    <tr key={entry.playerName} className={cn("bg-background/60", isTopThree && "bg-primary/10")}>
                      <td className="px-3 py-2 font-semibold text-foreground">
                        <span className="inline-flex items-center gap-1">
                          {rank <= 3 ? <Trophy className="h-4 w-4 text-primary" aria-hidden /> : null}
                          {rank}.
                        </span>
                      </td>
                      <td className="px-3 py-2 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                            {initialsFor(entry.playerName)}
                          </span>
                          {entry.playerName}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-semibold text-foreground">{NUMBER_FORMATTER.format(entry.totalScore)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{entry.correctCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

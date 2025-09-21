"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Text } from "@/components/ui/typography";

const TIMESTAMP_FORMATTER = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

const SCOREBOARD_FORMATTER = new Intl.NumberFormat("de-DE");

function sortScoreboard(entries: MysteryTipManagerProps["scoreboard"]) {
  return [...entries].sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
    if (b.totalSubmissions !== a.totalSubmissions) return b.totalSubmissions - a.totalSubmissions;
    return a.playerName.localeCompare(b.playerName, "de-DE", { sensitivity: "base" });
  });
}

type ClueOption = {
  id: string;
  label: string;
  index: number;
  points: number;
  releaseAt: string | null;
  published: boolean;
};

type SubmissionEntry = {
  id: string;
  playerName: string;
  tipText: string;
  normalizedText: string;
  isCorrect: boolean;
  score: number;
  tipCount: number;
  cluePoints: number | null;
  createdAt: string;
  updatedAt: string;
};

type ScoreboardEntry = {
  playerName: string;
  totalScore: number;
  correctCount: number;
  totalSubmissions: number;
  lastUpdated: string | null;
};

type MysteryTipManagerProps = {
  clues: ClueOption[];
  selectedClueId: string | null;
  submissions: SubmissionEntry[];
  scoreboard: ScoreboardEntry[];
};

export function MysteryTipManager({ clues, selectedClueId, submissions, scoreboard }: MysteryTipManagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [items, setItems] = useState(submissions);
  const [board, setBoard] = useState(() => sortScoreboard(scoreboard));
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const activeClue = useMemo(() => clues.find((clue) => clue.id === selectedClueId) ?? null, [clues, selectedClueId]);

  function handleSelectClue(nextId: string) {
    const params = new URLSearchParams(searchParams ? searchParams.toString() : "");
    if (nextId) {
      params.set("clue", nextId);
    } else {
      params.delete("clue");
    }
    const nextUrl = params.toString() ? `${pathname}?${params}` : pathname;
    router.push(nextUrl);
  }

  function applyScoreboardUpdate(playerName: string, entry: ScoreboardEntry | null) {
    setBoard((previous) => {
      const filtered = previous.filter((item) => item.playerName !== playerName);
      if (!entry) {
        return filtered;
      }
      filtered.push(entry);
      return sortScoreboard(filtered);
    });
  }

  async function handleToggle(submissionId: string, nextState: boolean) {
    setPendingId(submissionId);
    setError(null);
    try {
      const response = await fetch(`/api/mystery/submissions/${submissionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCorrect: nextState }),
      });
      const payload = await response.json();
      if (!response.ok) {
        const message = typeof payload?.error === "string" ? payload.error : "Der Tipp konnte nicht aktualisiert werden.";
        throw new Error(message);
      }

      let playerName = "";
      setItems((previous) =>
        previous.map((entry) => {
          if (entry.id === submissionId) {
            playerName = entry.playerName;
            return {
              ...entry,
              isCorrect: payload.submission.isCorrect as boolean,
              score: payload.submission.score as number,
              tipCount: payload.submission.tipCount as number,
              cluePoints: payload.submission.cluePoints as number | null,
              updatedAt: payload.submission.updatedAt as string,
            };
          }
          return entry;
        }),
      );

      const scoreboardEntry = payload.scoreboardEntry
        ? {
            playerName: payload.scoreboardEntry.playerName as string,
            totalScore: payload.scoreboardEntry.totalScore as number,
            correctCount: payload.scoreboardEntry.correctCount as number,
            totalSubmissions: payload.scoreboardEntry.totalSubmissions as number,
            lastUpdated: payload.scoreboardEntry.lastUpdated as string | null,
          }
        : null;

      const targetPlayer = scoreboardEntry?.playerName ?? playerName;
      if (targetPlayer) {
        applyScoreboardUpdate(targetPlayer, scoreboardEntry);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler beim Aktualisieren.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Punktestand</CardTitle>
          <Text variant="small" tone="muted">
            Punkte werden automatisch anhand der Rätsel-Punkte vergeben, sobald ein Tipp als richtig markiert wird.
          </Text>
        </CardHeader>
        <CardContent>
          {board.length === 0 ? (
            <Text variant="small" tone="muted">Noch keine Punkte vergeben.</Text>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Spielername</th>
                    <th className="px-3 py-2 text-left">Punkte</th>
                    <th className="px-3 py-2 text-left">Richtige Tipps</th>
                    <th className="px-3 py-2 text-left">Letztes Update</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {board.map((entry) => (
                    <tr key={entry.playerName} className="bg-background/60">
                      <td className="px-3 py-2 font-medium">{entry.playerName}</td>
                      <td className="px-3 py-2 font-semibold">{SCOREBOARD_FORMATTER.format(entry.totalScore)}</td>
                      <td className="px-3 py-2">{entry.correctCount}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {entry.lastUpdated ? TIMESTAMP_FORMATTER.format(new Date(entry.lastUpdated)) : "–"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tipps nach Rätsel</CardTitle>
          <Text variant="small" tone="muted">
            Wähle ein Rätsel, um die abgegebenen Tipps zu prüfen und bei korrekter Lösung Punkte zu vergeben.
          </Text>
        </CardHeader>
        <CardContent className="space-y-4">
          {clues.length > 0 ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <Text variant="small" tone="muted">Rätsel auswählen</Text>
                <Select value={selectedClueId ?? clues[0]?.id ?? ""} onValueChange={handleSelectClue}>
                  <SelectTrigger className="w-72">
                    <SelectValue placeholder="Rätsel wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {clues.map((clue) => (
                      <SelectItem key={clue.id} value={clue.id}>
                        {clue.label} · {clue.points} Punkte
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {activeClue && (
                <Badge variant="outline">
                  {activeClue.points} Punkte · {activeClue.published ? "Veröffentlicht" : "Entwurf"}
                </Badge>
              )}
            </div>
          ) : (
            <Text variant="small" tone="muted">Noch keine Rätsel angelegt.</Text>
          )}

          {error && <Text tone="destructive">{error}</Text>}

          {items.length === 0 ? (
            <Text variant="small" tone="muted">Keine Tipps für dieses Rätsel vorhanden.</Text>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Spielername</th>
                    <th className="px-3 py-2 text-left">Tipp</th>
                    <th className="px-3 py-2 text-left">Stimmen</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Aktion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {items.map((item) => {
                    const isActive = pendingId === item.id;
                    return (
                      <tr key={item.id} className="bg-background/60 align-top">
                        <td className="px-3 py-2 font-medium">{item.playerName}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          <div className="whitespace-pre-wrap break-words">{item.tipText}</div>
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="secondary">×{item.tipCount}</Badge>
                        </td>
                        <td className="px-3 py-2">
                          {item.isCorrect ? (
                            <span className="inline-flex items-center gap-2 text-foreground">
                              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
                              Richtig · {item.score} Punkte
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-2 text-muted-foreground">
                              <span className="h-2 w-2 rounded-full bg-muted-foreground/40" aria-hidden />
                              Offen
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Button
                            variant={item.isCorrect ? "outline" : "default"}
                            size="sm"
                            disabled={isActive}
                            onClick={() => handleToggle(item.id, !item.isCorrect)}
                          >
                            {isActive
                              ? "Aktualisiere…"
                              : item.isCorrect
                              ? "Als falsch markieren"
                              : "Als richtig markieren"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

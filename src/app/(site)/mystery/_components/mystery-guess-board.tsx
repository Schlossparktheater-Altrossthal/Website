"use client";

import { type FocusEvent, type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Heading, Text } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

const MAX_TIP_LENGTH = 280;

export type MysteryTip = {
  id: string;
  text: string;
  count: number;
  createdAt: string | Date;
  updatedAt: string | Date;
};

function sortTips(tips: MysteryTip[]) {
  return [...tips].sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }

    const updatedA = new Date(a.updatedAt).getTime();
    const updatedB = new Date(b.updatedAt).getTime();
    if (updatedB !== updatedA) {
      return updatedB - updatedA;
    }

    return a.text.localeCompare(b.text, "de-DE", { sensitivity: "base" });
  });
}

type ClueOption = {
  id: string;
  label: string;
  points: number;
};

type MysteryGuessBoardProps = {
  initialTips?: MysteryTip[];
  clueOptions: ClueOption[];
  defaultClueId?: string | null;
};

export function MysteryGuessBoard({ initialTips = [], clueOptions, defaultClueId }: MysteryGuessBoardProps) {
  const [tips, setTips] = useState<MysteryTip[]>(() => sortTips(initialTips));
  const [tipText, setTipText] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [selectedClueId, setSelectedClueId] = useState(() => defaultClueId ?? clueOptions[0]?.id ?? "");
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(initialTips.length === 0);
  const [didSubmit, setDidSubmit] = useState(false);
  const [touchedFields, setTouchedFields] = useState<{ playerName: boolean; clueId: boolean }>({
    playerName: false,
    clueId: false,
  });

  const hasMinimumLength = useMemo(() => tipText.trim().length >= 3, [tipText]);
  const hasValidName = useMemo(() => playerName.trim().length >= 2, [playerName]);
  const hasSelectedClue = Boolean(selectedClueId);
  const showPlayerNameError = (didSubmit || touchedFields.playerName) && !hasValidName;
  const showClueError = (didSubmit || touchedFields.clueId) && !hasSelectedClue;

  const refreshTips = useCallback(async () => {
    setIsLoading(true);
    setListError(null);
    try {
      const response = await fetch("/api/mystery/submissions", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        const message = typeof payload?.error === "string" ? payload.error : "Die Tipps konnten nicht geladen werden.";
        throw new Error(message);
      }
      setTips(sortTips(payload.tips ?? []));
    } catch (err) {
      console.error("Failed to refresh mystery tips", err);
      setListError(err instanceof Error ? err.message : "Unbekannter Fehler beim Laden.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setTips(sortTips(initialTips));
    setListError(null);
    if (initialTips.length === 0) {
      refreshTips();
    } else {
      setIsLoading(false);
    }
  }, [initialTips, refreshTips]);

  useEffect(() => {
    if (!clueOptions.length) {
      setSelectedClueId("");
      return;
    }
    if (!clueOptions.some((clue) => clue.id === selectedClueId)) {
      setSelectedClueId(clueOptions[0]?.id ?? "");
    }
  }, [clueOptions, selectedClueId]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setDidSubmit(true);
      const trimmed = tipText.trim();
      if (trimmed.length < 3) {
        setSubmissionError("Dein Tipp sollte mindestens 3 Zeichen lang sein.");
        return;
      }

      setIsSubmitting(true);
      setSubmissionError(null);

      try {
        const response = await fetch("/api/mystery/submissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tip: trimmed, playerName: playerName.trim(), clueId: selectedClueId }),
        });
        const payload = await response.json();
        if (!response.ok) {
          const message = typeof payload?.error === "string" ? payload.error : "Dein Tipp konnte nicht gespeichert werden.";
          throw new Error(message);
        }

        setTips((previous) => {
          const next = [...previous];
          const index = next.findIndex((item) => item.id === payload.tip.id);
          if (index !== -1) {
            next[index] = {
              ...next[index],
              count: payload.tip.count,
              updatedAt: payload.tip.updatedAt,
            };
          } else {
            next.push(payload.tip);
          }
          return sortTips(next);
        });
        setTipText("");
        setPlayerName("");
        setDidSubmit(false);
        setTouchedFields({ playerName: false, clueId: false });
      } catch (err) {
        console.error("Failed to submit mystery tip", err);
        setSubmissionError(err instanceof Error ? err.message : "Unbekannter Fehler beim Speichern.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [playerName, selectedClueId, tipText]
  );

  const remainingCharacters = MAX_TIP_LENGTH - tipText.length;
  const canSubmit = hasMinimumLength && hasValidName && hasSelectedClue && !isSubmitting;

  return (
    <section className="space-y-6">
      <Heading level="h2">Rätsel mit und gib uns deinen Tipp!</Heading>
      <div className="split-responsive">
        <Card>
          <CardHeader>
            <CardTitle>Dein Tipp</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mystery-player-name">Spielername</Label>
                <Input
                  id="mystery-player-name"
                  value={playerName}
                  onChange={(event) => setPlayerName(event.target.value)}
                  maxLength={50}
                  placeholder="Wie dürfen wir dich im Scoreboard nennen?"
                  disabled={isSubmitting}
                  aria-invalid={showPlayerNameError ? true : undefined}
                  onBlur={(event: FocusEvent<HTMLInputElement>) => {
                    if (!touchedFields.playerName) {
                      setTouchedFields((current) => ({ ...current, playerName: true }));
                    }
                    setPlayerName(event.target.value);
                  }}
                />
                <Text variant="small" tone={showPlayerNameError ? "destructive" : "muted"}>
                  Mindestens 2 Zeichen. Dieser Name erscheint im öffentlichen Scoreboard.
                </Text>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mystery-clue">Rätsel auswählen</Label>
                <Select value={selectedClueId} onValueChange={(value) => {
                  setSelectedClueId(value);
                  if (!touchedFields.clueId) {
                    setTouchedFields((current) => ({ ...current, clueId: true }));
                  }
                }} disabled={clueOptions.length === 0 || isSubmitting}>
                  <SelectTrigger
                    id="mystery-clue"
                    className="w-full"
                    aria-invalid={showClueError ? true : undefined}
                    onBlur={() => {
                      if (!touchedFields.clueId) {
                        setTouchedFields((current) => ({ ...current, clueId: true }));
                      }
                    }}
                  >
                    <SelectValue placeholder="Rätsel wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {clueOptions.map((clue) => (
                      <SelectItem key={clue.id} value={clue.id}>
                        {clue.label} · {clue.points} Punkte
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Text variant="small" tone={showClueError ? "destructive" : "muted"}>
                  Ordne deinen Tipp einem konkreten Rätsel zu, um Punkte zu sammeln.
                </Text>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mystery-tip">Was glaubst du, welches Stück wir spielen?</Label>
                <Textarea
                  id="mystery-tip"
                  value={tipText}
                  onChange={(event) => setTipText(event.target.value)}
                  maxLength={MAX_TIP_LENGTH}
                  rows={5}
                  placeholder="Teile deinen Tipp mit der Theater-Community"
                  aria-invalid={submissionError ? true : undefined}
                  disabled={isSubmitting}
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{hasMinimumLength ? "Bereit zum Absenden" : "Mindestens 3 Zeichen"}</span>
                  <span>{remainingCharacters} Zeichen übrig</span>
                </div>
              </div>
              {submissionError && (
                <Text tone="destructive" variant="small">
                  {submissionError}
                </Text>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" disabled={!canSubmit}>
                  {isSubmitting ? "Wird gesendet…" : "Tipp abschicken"}
                </Button>
                <Button type="button" variant="ghost" onClick={refreshTips} disabled={isLoading} className="gap-2">
                  <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} aria-hidden />
                  Aktualisieren
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tipps der Community</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {listError && (
              <Text tone="destructive" variant="small">
                {listError}
              </Text>
            )}
            {isLoading ? (
              <Text tone="muted">Die Tipps werden geladen…</Text>
            ) : tips.length === 0 ? (
              <Text tone="muted">Noch keine Tipps vorhanden – sei die erste Person und teile deinen Verdacht!</Text>
            ) : (
              <ul className="space-y-3">
                {tips.map((tip) => (
                  <li key={tip.id} className="rounded-lg border border-border/60 bg-muted/10 px-4 py-3">
                    <div className="stack-responsive stack-responsive--between">
                      <Text className="text-left">{tip.text}</Text>
                      <Badge variant="secondary">×{tip.count}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Heading, Text } from "@/components/ui/typography";

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

type MysteryTipsBoardProps = {
  initialTips?: MysteryTip[];
};

export function MysteryTipsBoard({ initialTips = [] }: MysteryTipsBoardProps) {
  const [tips, setTips] = useState<MysteryTip[]>(() => sortTips(initialTips));
  const [tipText, setTipText] = useState("");
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(initialTips.length === 0);

  const hasMinimumLength = useMemo(() => tipText.trim().length >= 3, [tipText]);

  const refreshTips = useCallback(async () => {
    setIsLoading(true);
    setListError(null);
    try {
      const response = await fetch("/api/mystery/tips", { cache: "no-store" });
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

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = tipText.trim();
      if (trimmed.length < 3) {
        setSubmissionError("Dein Tipp sollte mindestens 3 Zeichen lang sein.");
        return;
      }

      setIsSubmitting(true);
      setSubmissionError(null);

      try {
        const response = await fetch("/api/mystery/tips", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tip: trimmed }),
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
      } catch (err) {
        console.error("Failed to submit mystery tip", err);
        setSubmissionError(err instanceof Error ? err.message : "Unbekannter Fehler beim Speichern.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [tipText]
  );

  const remainingCharacters = MAX_TIP_LENGTH - tipText.length;

  return (
    <section className="space-y-6">
      <Heading level="h2">Rätsel mit und gib uns deinen Tipp!</Heading>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Dein Tipp</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
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
                <Button type="submit" disabled={isSubmitting || !hasMinimumLength}>
                  {isSubmitting ? "Wird gesendet…" : "Tipp abschicken"}
                </Button>
                <Button type="button" variant="ghost" onClick={refreshTips} disabled={isLoading}>
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
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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

"use client";

import { useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MAX_INTERESTS_PER_USER } from "@/data/profile";
const MIN_INTEREST_LENGTH = 2;

function normalizeInterest(value: string) {
  return value.trim();
}

function sortNormalized(values: string[]) {
  return values
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0)
    .sort();
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

export function ProfileInterestsCard() {
  const [interests, setInterests] = useState<string[]>([]);
  const [baseline, setBaseline] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadInterests = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/profile/interests", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to load interests");
        }
        const data = (await response.json()) as unknown;
        const list = toStringArray((data as { interests?: unknown })?.interests);
        if (!cancelled) {
          setInterests(list);
          setBaseline(list);
        }
      } catch (err) {
        console.error("[profile.interests] load", err);
        if (!cancelled) {
          setError("Interessen konnten nicht geladen werden.");
          setInterests([]);
          setBaseline([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void loadInterests();
    return () => {
      cancelled = true;
    };
  }, []);

  const normalizedBaseline = useMemo(() => sortNormalized(baseline), [baseline]);
  const normalizedCurrent = useMemo(() => sortNormalized(interests), [interests]);
  const hasChanges = useMemo(() => {
    if (normalizedBaseline.length !== normalizedCurrent.length) return true;
    return normalizedBaseline.some((value, index) => value !== normalizedCurrent[index]);
  }, [normalizedBaseline, normalizedCurrent]);

  const handleAddInterest = () => {
    const normalized = normalizeInterest(inputValue);
    if (normalized.length < MIN_INTEREST_LENGTH) {
      setError("Bitte gib mindestens zwei Zeichen ein.");
      return;
    }
    if (interests.some((entry) => entry.trim().toLowerCase() === normalized.toLowerCase())) {
      setError("Dieses Interesse hast du bereits hinzugefügt.");
      return;
    }
    if (interests.length >= MAX_INTERESTS_PER_USER) {
      setError(`Maximal ${MAX_INTERESTS_PER_USER} Interessen möglich.`);
      return;
    }
    setInterests((prev) => [...prev, normalized]);
    setInputValue("");
    setError(null);
  };

  const handleRemoveInterest = (value: string) => {
    setInterests((prev) => prev.filter((entry) => entry !== value));
    setError(null);
  };

  const handleSubmit = async () => {
    if (!hasChanges) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/profile/interests", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ interests }),
      });
      const data = (await response.json().catch(() => null)) as unknown;
      if (!response.ok) {
        const message = typeof (data as { error?: unknown })?.error === "string"
          ? String((data as { error?: unknown }).error)
          : "Speichern fehlgeschlagen.";
        setError(message);
        return;
      }
      const saved = toStringArray((data as { interests?: unknown })?.interests);
      setBaseline(saved);
      setInterests(saved);
      setInputValue("");
      toast.success("Interessen aktualisiert.");
    } catch (err) {
      console.error("[profile.interests] save", err);
      setError("Netzwerkfehler – bitte später erneut versuchen.");
    } finally {
      setSaving(false);
    }
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAddInterest();
    }
  };

  return (
    <Card className="rounded-2xl border border-border/60 bg-background/80 p-0 shadow-lg shadow-secondary/10">
      <CardHeader className="space-y-3 px-6 pb-4 pt-6 sm:px-7">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary">
          <Sparkles className="h-4 w-4" />
          Interessen &amp; Talente
        </div>
        <CardTitle className="text-xl">Halte deine Interessen aktuell</CardTitle>
        <p className="text-sm text-muted-foreground">
          Diese Schlagworte helfen dem Team, dich passenden Projekten zuzuordnen. Du kannst sie hier jederzeit anpassen.
        </p>
      </CardHeader>
      <CardContent className="space-y-5 px-6 pb-6 sm:px-7">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Interessen werden geladen …
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 rounded-xl border border-dashed border-border/50 bg-background/70 p-3">
              {interests.length ? (
                interests.map((interest) => (
                  <Badge
                    key={interest}
                    variant="outline"
                    className="flex items-center gap-2 border-primary/30 bg-primary/5 text-primary"
                  >
                    <span>{interest}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveInterest(interest)}
                      className={cn(
                        "rounded-full p-0.5 transition",
                        saving ? "cursor-not-allowed text-primary/30" : "hover:bg-primary/10"
                      )}
                      disabled={saving}
                      aria-label={`${interest} entfernen`}
                    >
                      ×
                    </button>
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">
                  Noch keine Interessen hinterlegt – ergänze deine ersten Schlagworte.
                </span>
              )}
            </div>

            <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background/75 p-4 sm:flex-row sm:items-center sm:gap-4">
              <Input
                value={inputValue}
                onChange={(event) => {
                  setInputValue(event.target.value);
                  setError(null);
                }}
                onKeyDown={handleInputKeyDown}
                placeholder="z.B. Impro, Tanz, Social Media …"
                disabled={saving}
              />
              <Button type="button" onClick={handleAddInterest} disabled={saving}>
                Hinzufügen
              </Button>
            </div>
          </>
        )}
        <p className="text-xs text-muted-foreground">Maximal {MAX_INTERESTS_PER_USER} Interessen möglich.</p>
        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex justify-end border-t border-border/60 pt-4">
          <Button type="button" onClick={handleSubmit} disabled={saving || loading || !hasChanges}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Speichern …
              </>
            ) : (
              "Speichern"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

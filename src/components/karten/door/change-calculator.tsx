"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/karten/constants";
import { cn } from "@/lib/utils";

const NOTES = [500, 1000, 2000, 5000];

function parseEuro(value: string): number | null {
  const normalized = value.replace(/\s|€/g, "").replace(",", ".");
  if (!normalized) return null;
  const amount = Number.parseFloat(normalized);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}

/**
 * Wechselgeld an der Abendkasse (optional): erhaltenen Betrag antippen oder eingeben, Rückgeld
 * steht groß darunter. Nur Rechenhilfe – gespeichert wird nichts.
 */
export function ChangeCalculator({ dueCents }: { dueCents: number }) {
  const [open, setOpen] = useState(false);
  const [given, setGiven] = useState("");
  if (dueCents <= 0) return null;

  if (!open) {
    return (
      <Button type="button" size="xs" variant="ghost" onClick={() => setOpen(true)}>
        Wechselgeld berechnen
      </Button>
    );
  }

  const givenCents = parseEuro(given);
  const change = givenCents === null ? null : givenCents - dueCents;
  const notes = NOTES.filter((note) => note >= dueCents).slice(0, 3);

  return (
    <div className="space-y-2 rounded-md bg-muted/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Erhalten</span>
        {notes.map((note) => (
          <Button
            key={note}
            type="button"
            size="xs"
            variant={givenCents === note ? "default" : "outline"}
            onClick={() => setGiven(String(note / 100))}
          >
            {formatPrice(note)}
          </Button>
        ))}
        <Input
          inputMode="decimal"
          placeholder="Betrag"
          aria-label="Erhaltener Betrag in Euro"
          className="h-8 w-24"
          value={given}
          onChange={(event) => setGiven(event.target.value)}
        />
      </div>
      {change !== null ? (
        <p
          className={cn(
            "text-lg font-semibold tabular-nums",
            change < 0 ? "text-destructive" : "text-success",
          )}
          aria-live="polite"
        >
          {change < 0 ? `Es fehlen ${formatPrice(-change)}` : `Rückgeld ${formatPrice(change)}`}
        </p>
      ) : null}
    </div>
  );
}

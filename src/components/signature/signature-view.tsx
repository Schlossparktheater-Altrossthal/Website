"use client";

import { useMemo, useState } from "react";

import { SignatureVisualizer } from "@/components/signature/signature-visualizer";
import { Button } from "@/components/ui/button";
import { DEFAULT_TIME_ZONE } from "@/lib/date-time";
import { signatureToSvgGeometry } from "@/lib/signature-svg";
import { cn } from "@/lib/utils";
import type { SignaturePayload } from "@/types/signature";

const dateTimeFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: DEFAULT_TIME_ZONE,
});

/**
 * Zeigt eine vektoriell gespeicherte Unterschrift als SVG (scharf in jeder Größe, folgt dem
 * Farbschema). „Abspielen“ zeigt den Schreibverlauf, „Tempo“ die Geschwindigkeit je Abschnitt.
 */
export function SignatureView({
  payload,
  className,
}: {
  payload: SignaturePayload;
  className?: string;
}) {
  const [mode, setMode] = useState<"still" | "replay" | "velocity">("still");
  const geometry = useMemo(() => signatureToSvgGeometry(payload), [payload]);
  const capturedAt = new Date(payload.endedAt);
  const seconds = Math.max(0.1, payload.duration / 1000);

  return (
    <figure className={cn("space-y-2", className)}>
      <div className="flex h-36 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted p-2">
        {mode === "still" ? (
          <svg
            viewBox={geometry.viewBox}
            className="h-full w-full text-foreground"
            role="img"
            aria-label="Digitale Unterschrift"
          >
            {geometry.paths.map((d, index) => (
              <path
                key={index}
                d={d}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
        ) : (
          <SignatureVisualizer payload={payload} mode={mode} className="h-full w-full" />
        )}
      </div>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Unterschrieben{" "}
          {Number.isNaN(capturedAt.valueOf()) ? "" : `am ${dateTimeFormatter.format(capturedAt)} `}·{" "}
          {seconds.toLocaleString("de-DE", { maximumFractionDigits: 1 })} s ·{" "}
          {payload.strokes.length} {payload.strokes.length === 1 ? "Strich" : "Striche"}
        </span>
        <span className="flex gap-1">
          <Button
            type="button"
            size="xs"
            variant={mode === "replay" ? "outline" : "ghost"}
            onClick={() => setMode((current) => (current === "replay" ? "still" : "replay"))}
          >
            {mode === "replay" ? "Stopp" : "Abspielen"}
          </Button>
          <Button
            type="button"
            size="xs"
            variant={mode === "velocity" ? "outline" : "ghost"}
            onClick={() => setMode((current) => (current === "velocity" ? "still" : "velocity"))}
          >
            Tempo
          </Button>
        </span>
      </figcaption>
    </figure>
  );
}

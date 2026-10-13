"use client";

import * as React from "react";

import { EyeIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import type { TokenizedBlock } from "@/lib/skript/learn/chunks";
import type { StoredCard } from "@/lib/skript/learn/plan";
import {
  RATING_LABEL,
  autoRating,
  autoStage,
  capRating,
  type LearnRating,
  type Stage,
} from "@/lib/skript/learn/schedule";
import type { ScriptPart } from "@/lib/skript/types";
import { cn } from "@/lib/utils";

import {
  chunkWordIndices,
  emptyProgress,
  maskedIndices,
  nextTypingTarget,
  typeLetter,
  type ChunkProgress,
} from "./masked";
import { unitCard, type LearnSettings, type ReviewMeta, type Unit } from "./model";

/** Gemeinsame Abfrage-Logik von Szenenfluss und Abfrage (docs/Plan/lernmodus-plan.md). */

export function unitStage(
  unit: Unit,
  cards: ReadonlyMap<string, StoredCard>,
  setting: LearnSettings["stage"],
): { stage: Stage; seed: number; changed: boolean } {
  const { card, changed } = unitCard(unit, cards);
  return {
    stage: setting === "auto" ? autoStage(card, changed) : setting,
    seed: card?.reps ?? 0,
    changed,
  };
}

export function usePractice(
  unit: Unit | null,
  tokenized: TokenizedBlock | undefined,
  stage: Stage,
  seed: number,
) {
  const [progress, setProgress] = React.useState<ChunkProgress>(emptyProgress);
  React.useEffect(() => setProgress(emptyProgress()), [unit?.id]);

  const masked = React.useMemo(
    () =>
      unit && tokenized
        ? maskedIndices(tokenized, unit.chunk, stage, seed + unit.chunk)
        : new Set<number>(),
    [unit, tokenized, stage, seed],
  );
  const words = React.useMemo(() => {
    const map = new Map<number, string>();
    for (const token of tokenized?.tokens ?? []) {
      if (token.kind === "word") map.set(token.index, token.text);
    }
    return map;
  }, [tokenized]);
  const target = progress.whole ? null : nextTypingTarget(masked, progress);
  const total = unit && tokenized ? chunkWordIndices(tokenized, unit.chunk).length : 0;

  const revealWord = React.useCallback(
    (index: number) =>
      setProgress((current) => ({ ...current, revealed: new Set(current.revealed).add(index) })),
    [],
  );
  const revealAll = React.useCallback(
    () => setProgress((current) => ({ ...current, whole: true })),
    [],
  );
  /** Nächstes noch verdecktes Wort aufdecken (Knopf „Wort“, Pfeil nach unten). */
  const revealNext = React.useCallback(() => {
    if (target !== null) revealWord(target);
  }, [target, revealWord]);
  const typeKey = React.useCallback(
    (key: string) => {
      if (target === null) return false;
      setProgress((current) => typeLetter(key, target, words, current));
      return true;
    },
    [target, words],
  );

  const solved = masked.size > 0 && target === null;
  const result = React.useCallback((): { rating: LearnRating; revealed: number } => {
    const revealed = progress.whole
      ? total
      : [...progress.revealed].filter((index) => masked.has(index)).length;
    // Bezug ist die Zahl der verdeckten Wörter (bei Lücken nur ein Teil des Abschnitts).
    const base = masked.size || total;
    return {
      rating: capRating(autoRating(revealed, base, progress.whole), stage),
      revealed: base ? Math.min(1, revealed / base) : 0,
    };
  }, [progress, masked, total, stage]);

  return {
    progress,
    masked,
    target,
    solved,
    revealWord,
    revealNext,
    revealAll,
    typeKey,
    result,
  };
}

export const RATING_STYLE: Record<LearnRating, string> = {
  1: "text-destructive",
  2: "text-warning",
  3: "text-success",
  4: "text-info",
};

/** Kurze Leiste nach dem Weiterblättern: vorgeschlagene Bewertung, antippen ändert sie. */
export function CorrectionBar({
  last,
  onChange,
}: {
  last: { rating: LearnRating; meta: ReviewMeta } | null;
  onChange: (rating: LearnRating) => void;
}) {
  if (!last) return null;
  return (
    <div
      className="flex items-center justify-center gap-1 text-xs"
      role="group"
      aria-label="Bewertung der letzten Stelle ändern"
      data-testid="lernen-korrektur"
    >
      <span className="mr-1 text-muted-foreground">Eben:</span>
      {([1, 2, 3, 4] as const)
        .filter((rating) => capRating(rating, last.meta.stage) === rating)
        .map((rating) => (
          <button
            key={rating}
            type="button"
            aria-pressed={last.rating === rating}
            onClick={() => onChange(rating)}
            className={cn(
              "flex min-h-9 items-center gap-1 rounded-full border px-2.5",
              last.rating === rating
                ? cn("border-current bg-muted font-semibold", RATING_STYLE[rating])
                : "border-transparent text-muted-foreground hover:bg-muted",
            )}
          >
            {RATING_LABEL[rating]}
          </button>
        ))}
    </div>
  );
}

/** Text einer Replik ohne Hinweise (Kontext, Stichwort). */
export function plainText(parts: readonly ScriptPart[]) {
  return parts
    .filter((part) => part.kind !== "cue")
    .map((part) =>
      part.kind === "direction" ? `(${part.text.replace(/^\(|\)$/g, "")})` : part.text,
    )
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function spokenText(parts: readonly ScriptPart[]) {
  return parts
    .filter((part) => part.kind === "text")
    .map((part) => part.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Vorlesen fremder Repliken (Web Speech API, ohne Server). */
export function useSpeech(enabled: boolean) {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [speaking, setSpeaking] = React.useState(false);
  const voices = React.useRef<SpeechSynthesisVoice[]>([]);
  React.useEffect(() => {
    if (!supported) return;
    const load = () => {
      voices.current = window.speechSynthesis
        .getVoices()
        .filter((voice) => voice.lang.toLowerCase().startsWith("de"));
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
      window.speechSynthesis.cancel();
    };
  }, [supported]);

  const stop = React.useCallback(() => {
    if (supported) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  /** Liest die Texte nacheinander; jede Rolle bekommt eine eigene Stimmlage. */
  const speak = React.useCallback(
    (lines: { text: string; speaker: string | null }[]) =>
      new Promise<void>((resolve) => {
        if (!enabled || !supported || !lines.length) return resolve();
        window.speechSynthesis.cancel();
        setSpeaking(true);
        let remaining = lines.length;
        const done = () => {
          remaining -= 1;
          if (remaining <= 0) {
            setSpeaking(false);
            resolve();
          }
        };
        for (const line of lines) {
          const utterance = new SpeechSynthesisUtterance(line.text);
          utterance.lang = "de-DE";
          const hash = [...(line.speaker ?? "")].reduce((sum, char) => sum + char.charCodeAt(0), 0);
          if (voices.current.length) utterance.voice = voices.current[hash % voices.current.length];
          utterance.pitch = 0.8 + (hash % 5) * 0.1;
          utterance.rate = 1.05;
          utterance.onend = done;
          utterance.onerror = done;
          window.speechSynthesis.speak(utterance);
        }
      }),
    [enabled, supported],
  );

  return { supported, speaking, speak, stop };
}

/** Tastatur: Buchstaben für den Tippmodus, Leertaste/Enter/→ weiter, ↓ nächstes Wort, ↑ alles. */
export function useLearnKeys(handlers: {
  onLetter?: (key: string) => boolean;
  onNext?: () => void;
  onRevealAll?: () => void;
  onRevealNext?: () => void;
  onRate?: (rating: LearnRating) => void;
  enabled: boolean;
}) {
  const ref = React.useRef(handlers);
  ref.current = handlers;
  React.useEffect(() => {
    if (!handlers.enabled) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable=true], [role=dialog]")) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const current = ref.current;
      if (event.key === " " || event.key === "Enter" || event.key === "ArrowRight") {
        if (event.key === " " || event.key === "ArrowRight") event.preventDefault();
        if (event.key === "Enter" && target?.closest("button")) return;
        current.onNext?.();
        return;
      }
      if (event.key === "ArrowDown" && current.onRevealNext) {
        event.preventDefault();
        current.onRevealNext();
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        current.onRevealAll?.();
        return;
      }
      if (current.onRate && /^[1-4]$/.test(event.key) && !current.onLetter) {
        current.onRate(Number(event.key) as LearnRating);
        return;
      }
      if (event.key.length === 1 && /[\p{L}\p{N}]/u.test(event.key) && current.onLetter) {
        if (current.onLetter(event.key)) event.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlers.enabled]);
}

export function BigButton(props: React.ComponentProps<typeof Button>) {
  return (
    <Button size="lg" {...props} className={cn("h-12 min-w-0 flex-1 text-base", props.className)} />
  );
}

/** Bildschirm bleibt an, solange geübt wird (Screen Wake Lock API). */
export function useWakeLock(enabled: boolean) {
  React.useEffect(() => {
    if (!enabled || !("wakeLock" in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    const acquire = () => {
      if (document.visibilityState !== "visible") return;
      navigator.wakeLock
        .request("screen")
        .then((lock) => {
          sentinel = lock;
        })
        .catch((error: unknown) => console.warn("Wake Lock abgelehnt", error));
    };
    acquire();
    document.addEventListener("visibilitychange", acquire);
    return () => {
      document.removeEventListener("visibilitychange", acquire);
      void sentinel?.release();
    };
  }, [enabled]);
}

/** Wischen nach links (Finger) → `onSwipe`. */
export function useSwipeLeft(onSwipe: () => void) {
  const start = React.useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart: (event: React.TouchEvent) => {
      const touch = event.touches[0];
      start.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
    },
    onTouchEnd: (event: React.TouchEvent) => {
      const touch = event.changedTouches[0];
      const from = start.current;
      start.current = null;
      if (!touch || !from) return;
      const dx = touch.clientX - from.x;
      const dy = touch.clientY - from.y;
      if (dx < -70 && Math.abs(dy) < Math.abs(dx) * 0.6) onSwipe();
    },
  };
}

/** Aufdeck-Knöpfe: nächstes Wort (Hinweis) und ganze Stelle. */
export function RevealButtons({
  onNext,
  onAll,
  disabled,
}: {
  onNext: () => void;
  onAll: () => void;
  disabled?: boolean;
}) {
  return (
    <>
      <Button
        variant="outline"
        size="lg"
        className="h-12 shrink-0 px-3"
        onClick={onNext}
        disabled={disabled}
        title="Nächstes Wort aufdecken (Pfeil nach unten)"
      >
        <EyeIcon aria-hidden /> Wort
      </Button>
      <Button
        variant="outline"
        size="lg"
        className="h-12 shrink-0 px-3"
        onClick={onAll}
        disabled={disabled}
        title="Ganze Stelle aufdecken (Pfeil nach oben oder Text halten)"
      >
        Alles
      </Button>
    </>
  );
}

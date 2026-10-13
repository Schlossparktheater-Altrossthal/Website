"use client";

import * as React from "react";

import {
  clozeWords,
  firstLetter,
  normalizeWord,
  type LearnToken,
  type TokenizedBlock,
} from "@/lib/skript/learn/chunks";
import type { Stage } from "@/lib/skript/learn/schedule";
import { cn } from "@/lib/utils";

/** Verdeckter Text im Lernmodus: Tippen = Wort, Halten = Abschnitt, Tippmodus (Rechner). */

export const HOLD_MS = 450;

export type ChunkProgress = {
  revealed: Set<number>;
  typed: Set<number>;
  wrong: Set<number>;
  whole: boolean;
};

export function emptyProgress(): ChunkProgress {
  return { revealed: new Set(), typed: new Set(), wrong: new Set(), whole: false };
}

/** Wortindizes (blockweit) eines Abschnitts. */
export function chunkWordIndices(tokenized: TokenizedBlock, chunk: number) {
  return tokenized.tokens
    .filter((token): token is Extract<LearnToken, { kind: "word" }> => token.kind === "word")
    .filter((token) => token.chunk === chunk)
    .map((token) => token.index);
}

/** Auf dieser Stufe verdeckte Wörter (blockweit). */
export function maskedIndices(
  tokenized: TokenizedBlock,
  chunk: number,
  stage: Stage,
  seed: number,
) {
  const indices = chunkWordIndices(tokenized, chunk);
  if (stage === "full") return new Set<number>();
  if (stage !== "cloze") return new Set(indices);
  const words = tokenized.chunks[chunk]?.words ?? [];
  const local = clozeWords(words, seed);
  return new Set(indices.filter((_, position) => local.has(position)));
}

/** Nächstes noch nicht gelöstes verdecktes Wort (Tippmodus). */
export function nextTypingTarget(masked: ReadonlySet<number>, progress: ChunkProgress) {
  let best: number | null = null;
  for (const index of masked) {
    if (progress.revealed.has(index) || progress.typed.has(index)) continue;
    if (best === null || index < best) best = index;
  }
  return best;
}

/** Tippmodus: ein Zeichen gegen den Anfangsbuchstaben des Zielworts prüfen. */
export function typeLetter(
  key: string,
  target: number,
  words: ReadonlyMap<number, string>,
  progress: ChunkProgress,
): ChunkProgress {
  const expected = normalizeWord(firstLetter(words.get(target) ?? ""));
  const typed = normalizeWord(key);
  if (!expected || !typed) return progress;
  if (expected === typed) return { ...progress, typed: new Set(progress.typed).add(target) };
  return {
    ...progress,
    revealed: new Set(progress.revealed).add(target),
    wrong: new Set(progress.wrong).add(target),
  };
}

function wordWidth(word: string) {
  return `${Math.max(1.2, word.replace(/[^\p{L}\p{N}]/gu, "").length * 0.55)}em`;
}

function MaskedWord({
  word,
  stage,
  active,
  current,
  onReveal,
}: {
  word: string;
  stage: Exclude<Stage, "full">;
  active: boolean;
  current: boolean;
  onReveal?: () => void;
}) {
  const lead = word.match(/^[^\p{L}\p{N}]*/u)?.[0] ?? "";
  const trail = word.match(/[^\p{L}\p{N}]*$/u)?.[0] ?? "";
  const core = word.slice(lead.length, word.length - trail.length);
  const content =
    stage === "initials" ? (
      <>
        {core.charAt(0)}
        <span
          className="inline-block border-b-2 border-current opacity-40"
          style={{ width: `${Math.max(0.4, (core.length - 1) * 0.5)}em` }}
        />
      </>
    ) : (
      <span
        className={cn(
          "inline-block h-[0.95em] translate-y-[0.15em] rounded-sm",
          active ? "bg-foreground/15" : "bg-foreground/10",
        )}
        style={{ width: wordWidth(core) }}
      />
    );
  return (
    <>
      {lead}
      <span
        role={active ? "button" : undefined}
        tabIndex={-1}
        aria-label={active ? "Wort aufdecken" : undefined}
        data-masked-word
        onClick={
          active
            ? (event) => {
                event.stopPropagation();
                onReveal?.();
              }
            : undefined
        }
        className={cn(
          "whitespace-nowrap",
          active && "cursor-pointer",
          current && "rounded-sm outline outline-2 outline-offset-1 outline-primary/60",
        )}
      >
        {content}
      </span>
      {trail}
    </>
  );
}

/**
 * Text einer Replik im Lernmodus. `active` = Abschnitt, der gerade abgefragt wird; Abschnitte davor
 * sind aufgedeckt, danach verdeckt. `done` = alle Abschnitte aufgedeckt.
 */
export function MaskedBlockText({
  tokenized,
  active,
  done,
  stage,
  seed,
  progress,
  typingTarget,
  onRevealWord,
  range = "all",
}: {
  tokenized: TokenizedBlock;
  /** Ausschnitt: alles, nur der aktive Abschnitt (Abfrage) oder nur die Abschnitte davor. */
  range?: "all" | "active" | "earlier";
  active: number | null;
  done: boolean;
  stage: Stage;
  seed: number;
  progress: ChunkProgress | null;
  typingTarget: number | null;
  onRevealWord?: (index: number) => void;
}) {
  const masked = React.useMemo(() => {
    if (done || stage === "full" || range === "earlier") return new Set<number>();
    const result = new Set<number>();
    for (const chunk of tokenized.chunks) {
      if (active !== null && chunk.index < active) continue;
      for (const index of maskedIndices(tokenized, chunk.index, stage, seed + chunk.index)) {
        result.add(index);
      }
    }
    return result;
  }, [tokenized, active, done, stage, seed, range]);

  const [from, to] = React.useMemo(() => {
    const all = tokenized.tokens.length;
    if (range === "all" || active === null) return [0, all];
    const firstOf = (test: (chunk: number) => boolean) =>
      tokenized.tokens.findIndex((token) => token.kind === "word" && test(token.chunk));
    const start = firstOf((chunk) => chunk >= active);
    const end = firstOf((chunk) => chunk > active);
    if (range === "earlier") return [0, start < 0 ? all : start];
    return [start < 0 ? all : start, end < 0 ? all : end];
  }, [range, active, tokenized]);

  return (
    <>
      {tokenized.tokens.slice(from, to).map((token, offset) => {
        const position = from + offset;
        if (token.kind === "space")
          return <React.Fragment key={position}>{token.text}</React.Fragment>;
        if (token.kind === "cue") return null;
        if (token.kind === "direction") {
          return (
            <span key={position} className="italic text-muted-foreground">
              {" "}
              {token.text}{" "}
            </span>
          );
        }
        const isActive = token.chunk === active && !done;
        const later = active !== null && token.chunk > active && !done;
        if (isActive && progress) {
          if (progress.typed.has(token.index)) {
            return (
              <span key={position} className="text-success">
                {token.text}
              </span>
            );
          }
          if (progress.revealed.has(token.index) || progress.whole) {
            return (
              <span
                key={position}
                className={cn(
                  "rounded-sm",
                  progress.wrong.has(token.index)
                    ? "bg-destructive/15 text-destructive"
                    : "bg-warning/20",
                )}
              >
                {token.text}
              </span>
            );
          }
        }
        if (masked.has(token.index)) {
          return (
            <span key={position} className={cn(later && "opacity-50")}>
              <MaskedWord
                word={token.text}
                stage={stage === "full" ? "hidden" : stage}
                active={isActive}
                current={isActive && typingTarget === token.index}
                onReveal={() => onRevealWord?.(token.index)}
              />
            </span>
          );
        }
        return (
          <span key={position} className={cn(later && "opacity-50")}>
            {token.text}
          </span>
        );
      })}
    </>
  );
}

/** Halten (Maus oder Finger) ohne Bewegung löst `onHold` aus. */
export function useHold(onHold: () => void, enabled = true) {
  const timer = React.useRef<number | null>(null);
  const start = React.useRef<{ x: number; y: number } | null>(null);
  const fired = React.useRef(false);
  const cancel = React.useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  }, []);
  React.useEffect(() => cancel, [cancel]);
  return {
    fired,
    handlers: enabled
      ? {
          onPointerDown: (event: React.PointerEvent) => {
            fired.current = false;
            start.current = { x: event.clientX, y: event.clientY };
            timer.current = window.setTimeout(() => {
              fired.current = true;
              timer.current = null;
              navigator.vibrate?.(15);
              onHold();
            }, HOLD_MS);
          },
          onPointerMove: (event: React.PointerEvent) => {
            if (!start.current) return;
            if (
              Math.abs(event.clientX - start.current.x) > 10 ||
              Math.abs(event.clientY - start.current.y) > 10
            ) {
              cancel();
            }
          },
          onPointerUp: cancel,
          onPointerCancel: cancel,
          onPointerLeave: cancel,
          onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
        }
      : {},
  };
}

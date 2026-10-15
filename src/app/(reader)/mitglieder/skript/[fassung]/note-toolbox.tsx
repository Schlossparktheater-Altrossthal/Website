"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  EditIcon,
  InfoIcon,
  TrashIcon,
  Undo2Icon,
} from "@/components/ui/action-icons";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import {
  isPointSign,
  MOOD_SUGGESTIONS,
  SCRIPT_SIGNS,
  type ReaderAnnotation,
  type ScriptSign,
} from "@/lib/skript/annotation-types";
import { gapAfter } from "@/lib/skript/note-logic";
import { cn } from "@/lib/utils";

import { ColorButtons, highlightsAt, toggleColor, type NoteTarget } from "./annotations";
import { readStored, writeStored } from "../shared";
import type { AnnotationStore } from "./use-annotations";

/**
 * Werkzeugleiste im Notizmodus (docs/Plan/skript-notizen-plan.md, Schritt 3): Stellen-Zeichen
 * (Pause, Atmer …) antippen oder in den Text ziehen, Bereichs-Zeichen (Betonung, lauter …) auf
 * die Auswahl anwenden. Gleiches Zeichen nochmal = entfernen.
 */

const POINT_SIGNS: ScriptSign[] = ["pause", "pause_lang", "atem", "zaesur"];
const RANGE_SIGNS: ScriptSign[] = [
  "betonung",
  "bogen",
  "lauter",
  "leiser",
  "schneller",
  "langsamer",
  "stimmung",
];

/** Wo ein gezogenes Zeichen landet: vor oder hinter einem Wort. */
export type DropGap = { blockId: string; partIndex: number; offset: number; before: boolean };

/** Name eines Eintrags für Leisten und Listen. */
export function annotationLabel(annotation: ReaderAnnotation) {
  if (annotation.kind === "sign" && annotation.sign) {
    const sign = SCRIPT_SIGNS[annotation.sign];
    if (annotation.sign === "stimmung") return `Stimmung: ${annotation.body ?? ""}`;
    return sign.point ? `${sign.label} ${sign.glyph}` : sign.label;
  }
  if (annotation.kind === "highlight") return "Markierung";
  if (annotation.kind === "note") return "Notiz";
  return "Zeichnung";
}

/** Zeichen dieser Art, die die Stelle berühren (Bereich überlappt bzw. gleiche Stelle). */
export function signsAt(
  annotations: ReaderAnnotation[],
  blockId: string,
  partIndex: number,
  start: number,
  end: number,
  signs: ScriptSign[],
) {
  return annotations.filter(
    (annotation) =>
      annotation.kind === "sign" &&
      annotation.sign &&
      signs.includes(annotation.sign) &&
      annotation.blockId === blockId &&
      annotation.partIndex === partIndex &&
      annotation.start !== null &&
      annotation.end !== null &&
      (start === end
        ? annotation.start === start
        : annotation.start < end && start < annotation.end),
  );
}

/**
 * Zeichen anwenden oder wieder entfernen. Betonung schaltet weiter: einfach → stark → aus.
 * `at` ist bei Stellen-Zeichen die Stelle im Teil.
 */
export async function toggleSign(
  store: AnnotationStore,
  target: { blockId: string; partIndex: number; start: number; end: number; quote: string },
  sign: ScriptSign,
  body?: string,
) {
  const point = isPointSign(sign);
  const family: ScriptSign[] =
    sign === "betonung" || sign === "betonung_stark" ? ["betonung", "betonung_stark"] : [sign];
  const existing = signsAt(
    store.list,
    target.blockId,
    target.partIndex,
    target.start,
    point ? target.start : target.end,
    family,
  );
  for (const annotation of existing) await store.remove(annotation);
  const next: ScriptSign | null =
    sign === "betonung"
      ? existing.some((annotation) => annotation.sign === "betonung_stark")
        ? null
        : existing.length
          ? "betonung_stark"
          : "betonung"
      : existing.length && sign !== "stimmung"
        ? null
        : sign;
  if (!next) return;
  await store.create({
    blockId: target.blockId,
    kind: "sign",
    sign: next,
    body: next === "stimmung" ? (body ?? null) : null,
    range: {
      partIndex: target.partIndex,
      start: target.start,
      end: point ? target.start : target.end,
      quote: target.quote,
    },
  });
}

function SignButton({
  sign,
  disabled,
  onClick,
  onPointerDown,
}: {
  sign: ScriptSign;
  disabled?: boolean;
  onClick: () => void;
  onPointerDown?: (event: React.PointerEvent<HTMLButtonElement>) => void;
}) {
  const { glyph, short, point } = SCRIPT_SIGNS[sign];
  const word = glyph === short;
  return (
    <button
      type="button"
      data-sign-button={sign}
      aria-label={SCRIPT_SIGNS[sign].label}
      aria-disabled={disabled || undefined}
      onClick={onClick}
      onPointerDown={onPointerDown}
      className={cn(
        "flex h-11 min-w-0 flex-col items-center justify-center rounded-md border border-border bg-card px-1 leading-tight transition-colors hover:bg-muted",
        // Stellen-Zeichen lassen sich ziehen – die Berührung gehört dann dem Knopf.
        point && "touch-none",
        disabled && "opacity-45",
      )}
    >
      {word ? (
        <span className="text-xs font-medium italic text-primary">{short}</span>
      ) : (
        <>
          <span
            className={cn(
              "text-base font-bold leading-none text-primary",
              sign === "betonung" && "underline decoration-2 underline-offset-2",
            )}
          >
            {sign === "betonung" ? "Ab" : glyph}
          </span>
          <span className="mt-0.5 truncate text-[0.68rem] text-muted-foreground">{short}</span>
        </>
      )}
    </button>
  );
}

/** Zeichen aus der Leiste in den Text ziehen: Lücke unter dem Finger finden, Vorschau zeigen. */
function usePointDrag(onDrop: (sign: ScriptSign, gap: DropGap) => void) {
  const [drag, setDrag] = React.useState<{
    sign: ScriptSign;
    x: number;
    y: number;
    caret: { x: number; y: number; height: number } | null;
  } | null>(null);
  const state = React.useRef<{
    sign: ScriptSign;
    startX: number;
    startY: number;
    active: boolean;
    gap: DropGap | null;
  } | null>(null);
  const moved = React.useRef(false);

  React.useEffect(() => {
    /** Der Finger verdeckt die Stelle: gesucht wird ein Stück darüber. */
    const LIFT = 44;
    const onMove = (event: PointerEvent) => {
      const current = state.current;
      if (!current) return;
      if (!current.active) {
        if (Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < 8) return;
        current.active = true;
        moved.current = true;
      }
      const x = event.clientX;
      const y = event.clientY - LIFT;
      const word = document.elementFromPoint(x, y)?.closest("[data-w]");
      const part = word?.closest("[data-part]");
      const block = word?.closest("[data-block]");
      let caret = null;
      current.gap = null;
      if (word && part && block) {
        const rect = word.getBoundingClientRect();
        const before = x < rect.left + rect.width / 2;
        current.gap = {
          blockId: block.getAttribute("data-block") ?? "",
          partIndex: Number(part.getAttribute("data-part")),
          offset:
            Number(word.getAttribute("data-w")) + (before ? 0 : (word.textContent?.length ?? 0)),
          before,
        };
        caret = { x: before ? rect.left - 2 : rect.right + 1, y: rect.top, height: rect.height };
      }
      setDrag({ sign: current.sign, x, y, caret });
    };
    const onUp = () => {
      const current = state.current;
      state.current = null;
      setDrag(null);
      if (current?.active && current.gap) onDrop(current.sign, current.gap);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [onDrop]);

  const start = (sign: ScriptSign, event: React.PointerEvent<HTMLButtonElement>) => {
    moved.current = false;
    // Zeiger nicht am Knopf festhalten, sonst meldet elementFromPoint nur den Knopf.
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    state.current = {
      sign,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
      gap: null,
    };
  };
  /** Nach einem Ziehen den Klick am Knopf ignorieren. */
  const consumeMoved = () => {
    const was = moved.current;
    moved.current = false;
    return was;
  };

  const overlay =
    drag && typeof document !== "undefined"
      ? createPortal(
          <>
            <span
              className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-md bg-primary px-2 py-0.5 text-sm font-bold text-primary-foreground shadow-md"
              style={{ left: drag.x, top: drag.y - 6 }}
            >
              {SCRIPT_SIGNS[drag.sign].glyph}
            </span>
            {drag.caret ? (
              <span
                className="pointer-events-none fixed z-50 w-0.5 rounded-full bg-primary"
                style={{ left: drag.caret.x, top: drag.caret.y, height: drag.caret.height }}
              />
            ) : null}
          </>,
          document.body,
        )
      : null;

  return { start, consumeMoved, overlay };
}

const MOOD_KEY = "skript-stimmungen";

/** Stimmung wählen: Vorschläge und eigene Begriffe, zuletzt benutzte vorne. */
function MoodSheet({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (mood: string) => void;
}) {
  const [recent, setRecent] = React.useState<string[]>([]);
  const [custom, setCustom] = React.useState("");
  React.useEffect(() => {
    if (!open) return;
    const stored = readStored<string[]>(MOOD_KEY);
    setRecent(
      Array.isArray(stored)
        ? stored.filter((entry): entry is string => typeof entry === "string")
        : [],
    );
  }, [open]);
  const pick = (mood: string) => {
    const value = mood.trim();
    if (!value) return;
    writeStored(MOOD_KEY, [value, ...recent.filter((entry) => entry !== value)].slice(0, 12));
    setCustom("");
    onPick(value);
  };
  const moods = [...recent, ...MOOD_SUGGESTIONS.filter((entry) => !recent.includes(entry))];
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Stimmung"
      description="Gilt für die ausgewählten Wörter"
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {moods.map((mood) => (
            <Button key={mood} variant="outline" size="sm" onClick={() => pick(mood)}>
              {mood}
            </Button>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            pick(custom);
          }}
        >
          <input
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
            maxLength={40}
            placeholder="Eigene Stimmung …"
            className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-base"
          />
          <Button type="submit" disabled={!custom.trim()}>
            Setzen
          </Button>
        </form>
      </div>
    </BottomSheet>
  );
}

/** Zeichenerklärung. */
function LegendSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Zeichen"
      description="So setzt du Zeichen im Notizmodus"
    >
      <ul className="space-y-2 text-sm">
        <li>
          <b>Wort antippen</b> wählt es aus, ein zweites Wort erweitert bis dorthin. Ziehen geht
          auch – mit dem Finger über die Griffe an der Auswahl.
        </li>
        <li>
          <b>Pause, Lang, Atmer, Zäsur</b>: antippen setzt das Zeichen hinter das gewählte Wort. Du
          kannst sie auch aus der Leiste direkt in den Text ziehen.
        </li>
        <li>
          <b>Betonung</b>: einmal unterstrichen, nochmal = stark (doppelt), nochmal = weg.
        </li>
        <li>
          <b>Bogen</b>: ohne Absetzen durchsprechen.
        </li>
        <li>
          <b>lauter, leiser, schneller, langsamer, Stimmung</b>: gelten für die Auswahl, das Wort
          steht klein am Anfang.
        </li>
        <li>Gleiches Zeichen nochmal antippen entfernt es. Zeichen im Text antippen: entfernen.</li>
      </ul>
    </BottomSheet>
  );
}

export function NoteToolbox({
  store,
  target,
  partText,
  onNudge,
  onSentence,
  onBlock,
  onNote,
  onClear,
  onDone,
  onDropPoint,
  onSketch,
}: {
  store: AnnotationStore;
  target: NoteTarget | null;
  /** Text des Teils, in dem die Auswahl liegt. */
  partText: string | null;
  onNudge: (direction: -1 | 1) => void;
  onSentence: () => void;
  onBlock: () => void;
  onNote: () => void;
  onClear: () => void;
  onDone: () => void;
  onDropPoint: (sign: ScriptSign, gap: DropGap) => void;
  /** Notizzettel an der Auswahl (bzw. am Absatz) anlegen. */
  onSketch: () => void;
}) {
  const [moodOpen, setMoodOpen] = React.useState(false);
  const [legendOpen, setLegendOpen] = React.useState(false);
  const drag = usePointDrag(onDropPoint);
  const range = target?.range ?? null;
  const highlights = target ? highlightsAt(store.list, target) : [];

  const apply = (sign: ScriptSign, body?: string) => {
    if (!range || partText === null) {
      toast.info(
        isPointSign(sign)
          ? "Erst ein Wort antippen – oder das Zeichen in den Text ziehen."
          : "Erst Text auswählen: Wort antippen, für mehrere Wörter dann aufs letzte.",
      );
      return;
    }
    const point = isPointSign(sign);
    const at = point ? gapAfter(partText, range.end) : range.start;
    void toggleSign(
      store,
      {
        blockId: range.blockId,
        partIndex: range.partIndex,
        start: at,
        end: point ? at : range.end,
        quote: range.quote,
      },
      sign,
      body,
    );
    // Stellen-Zeichen: Auswahl bleibt, damit gleich noch eins dazu kann.
    if (!point) onClear();
  };

  return (
    <div className="space-y-2 px-3 py-2 sm:px-4" data-note-bar>
      <div className="flex min-h-9 items-center gap-1">
        <span className={cn("min-w-0 flex-1 text-sm", target && "truncate")}>
          {!target ? (
            <span className="text-muted-foreground">
              Wort antippen, dann Zeichen wählen – oder Pause &amp; Co. in den Text ziehen.
            </span>
          ) : range ? (
            `„${range.quote}“`
          ) : (
            "Ganzer Absatz"
          )}
        </span>
        {range ? (
          <>
            <Button
              variant="outline"
              size="icon"
              aria-label="Ein Wort weniger"
              onClick={() => onNudge(-1)}
            >
              <ChevronLeftIcon aria-hidden />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Ein Wort mehr"
              onClick={() => onNudge(1)}
            >
              <ChevronRightIcon aria-hidden />
            </Button>
            <Button variant="outline" onClick={onSentence}>
              Satz
            </Button>
          </>
        ) : null}
        {target ? (
          <>
            <Button variant="outline" onClick={onBlock} className="hidden sm:inline-flex">
              Absatz
            </Button>
            <Button variant="ghost" size="icon" aria-label="Auswahl aufheben" onClick={onClear}>
              <CloseIcon aria-hidden />
            </Button>
          </>
        ) : null}
      </div>
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
        {POINT_SIGNS.map((sign) => (
          <SignButton
            key={sign}
            sign={sign}
            onPointerDown={(event) => drag.start(sign, event)}
            onClick={() => {
              if (!drag.consumeMoved()) apply(sign);
            }}
          />
        ))}
        {RANGE_SIGNS.map((sign) => (
          <SignButton
            key={sign}
            sign={sign}
            disabled={!range}
            onClick={() => (sign === "stimmung" && range ? setMoodOpen(true) : apply(sign))}
          />
        ))}
        <button
          type="button"
          onClick={onNote}
          disabled={!target}
          className="flex h-11 flex-col items-center justify-center rounded-md border border-border bg-card leading-tight hover:bg-muted disabled:opacity-45"
        >
          <EditIcon aria-hidden />
          <span className="mt-0.5 text-[0.68rem] text-muted-foreground">Notiz</span>
        </button>
        <button
          type="button"
          onClick={onSketch}
          disabled={!target}
          className="flex h-11 flex-col items-center justify-center rounded-md border border-border bg-card leading-tight hover:bg-muted disabled:opacity-45"
        >
          <span aria-hidden className="text-base font-bold leading-none text-primary">
            ✎
          </span>
          <span className="mt-0.5 text-[0.68rem] text-muted-foreground">Zettel</span>
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {target ? (
          <ColorButtons
            value={highlights.length === 1 ? highlights[0].color : null}
            onPick={(color) => {
              void toggleColor(store, target, highlights, color);
              onClear();
            }}
          />
        ) : null}
        {highlights.length ? (
          <Button
            variant="outline"
            size="icon"
            aria-label="Markierung entfernen"
            onClick={() => {
              for (const annotation of highlights) void store.removeWithUndo(annotation);
              onClear();
            }}
          >
            <TrashIcon aria-hidden />
          </Button>
        ) : null}
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Zeichen erklären"
            onClick={() => setLegendOpen(true)}
          >
            <InfoIcon aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Rückgängig"
            disabled={!store.canUndo}
            onClick={() => void store.undo()}
          >
            <Undo2Icon aria-hidden />
          </Button>
          <Button onClick={onDone}>Fertig</Button>
        </div>
      </div>
      {drag.overlay}
      <MoodSheet
        open={moodOpen}
        onOpenChange={setMoodOpen}
        onPick={(mood) => {
          setMoodOpen(false);
          apply("stimmung", mood);
        }}
      />
      <LegendSheet open={legendOpen} onOpenChange={setLegendOpen} />
    </div>
  );
}

/** Angetippte Einträge (ein oder mehrere an derselben Stelle): einzeln entfernen. */
export function TappedBar({
  store,
  annotations,
  onEdit,
  onDone,
}: {
  store: AnnotationStore;
  annotations: ReaderAnnotation[];
  onEdit: (annotation: ReaderAnnotation) => void;
  onDone: () => void;
}) {
  return (
    <div className="space-y-1 px-3 py-2 sm:px-4">
      {annotations.map((annotation) => (
        <div key={annotation.id} className="flex min-h-11 items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm">
            {annotationLabel(annotation)}
            {annotation.quote && !isPointSign(annotation.sign) ? (
              <span className="text-muted-foreground"> · „{annotation.quote}“</span>
            ) : null}
          </span>
          {annotation.kind === "highlight" ? (
            <ColorButtons
              value={annotation.color}
              onPick={(color) => {
                if (color !== annotation.color) void store.update(annotation, { color });
              }}
            />
          ) : null}
          {annotation.kind === "note" || annotation.sign === "stimmung" ? (
            <Button
              variant="outline"
              size="icon"
              aria-label="Bearbeiten"
              onClick={() => onEdit(annotation)}
            >
              <EditIcon aria-hidden />
            </Button>
          ) : null}
          <Button
            variant="outline"
            onClick={() => {
              void store.removeWithUndo(annotation);
              if (annotations.length === 1) onDone();
            }}
          >
            <TrashIcon aria-hidden /> Entfernen
          </Button>
        </div>
      ))}
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onDone}>
          Schließen
        </Button>
      </div>
    </div>
  );
}

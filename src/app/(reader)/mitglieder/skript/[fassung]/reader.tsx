"use client";

import * as React from "react";
import Link from "next/link";

import { CloudOffIcon } from "lucide-react";
import {
  ArrowLeftIcon,
  BookOpenTextIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CloseIcon,
  DownloadIcon,
  HighlighterIcon,
  PrinterIcon,
  SearchIcon,
  SettingsIcon,
  SparklesIcon,
  UsersIcon,
} from "@/components/ui/action-icons";
import { Badge } from "@/components/ui/badge";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { SCRIPT_MARKER_STYLES } from "@/config/category-colors";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  isPointSign,
  SCRIPT_SIGNS,
  type ReaderAnnotation,
  type ScriptSign,
} from "@/lib/skript/annotation-types";
import type { ReaderBlock, ScriptReaderData } from "@/lib/skript/reader";
import {
  cueLineIndices,
  cueSegments,
  type PartSlice,
  cueParts,
  findNextTarget,
  firstVisibleIndex,
  isRoleBlock,
  splitTail,
} from "@/lib/skript/reader-logic";
import {
  extendTo,
  gapAfter,
  nudge,
  sentenceAround,
  wordAt,
  type Span,
} from "@/lib/skript/note-logic";
import type { CueCategory } from "@/lib/skript/types";
import { cn } from "@/lib/utils";

import {
  CUE_STYLE,
  CueMark,
  CueMarker,
  CueRow,
  FONT_SIZES,
  SceneList,
  SKRIPT_PATH,
  SPEAKER_MAX_CHARS,
  type Settings,
  type Visibility,
  readStored,
  useSettings,
  writeStored,
} from "../shared";
import {
  AnnotationBar,
  AnnotationEditor,
  AnnotationReview,
  HighlightBar,
  InlineNoteEditor,
  PickBar,
  useTextSelection,
  type EditorState,
  type NoteTarget,
} from "./annotations";
import { SketchCard, SketchEditor, SketchMark, type SketchTarget } from "./sketch";
import { BlockEditor, type BlockEditorState } from "./block-editor";
import { useAnnotations } from "./use-annotations";
import { NoteToolbox, TappedBar, toggleSign, type DropGap } from "./note-toolbox";
import { SelectionHandles } from "./selection-handles";
import { useWordDrag, type WordRef } from "./use-word-drag";

/** Bildschirm bleibt an, solange der Leser offen ist (Screen Wake Lock API). */
function useWakeLock(enabled: boolean) {
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

function blockText(block: ReaderBlock) {
  return block.parts.map((part) => part.text).join(" ");
}

function Highlighted({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const lower = text.toLowerCase();
  const needle = query.toLowerCase();
  const pieces: React.ReactNode[] = [];
  let start = 0;
  let found = lower.indexOf(needle);
  while (found >= 0) {
    pieces.push(text.slice(start, found));
    pieces.push(
      <mark key={found} className="rounded-sm bg-warning/40 text-foreground">
        {text.slice(found, found + needle.length)}
      </mark>,
    );
    start = found + needle.length;
    found = lower.indexOf(needle, start);
  }
  pieces.push(text.slice(start));
  return <>{pieces}</>;
}

/** Markierter Bereich; ohne `annotation` die aktuelle Auswahl im Notizmodus. */
type Range = { start: number; end: number; annotation: ReaderAnnotation | null };

/** Notizmodus: jedes Wort als antippbares Element mit Startposition im Teil (`data-w`). */
function Words({ text, start }: { text: string; start: number }) {
  const tokens: { token: string; from: number }[] = [];
  for (let at = 0; at < text.length;) {
    const token = /^\s+/.exec(text.slice(at))?.[0] ?? /^\S+/.exec(text.slice(at))![0];
    tokens.push({ token, from: start + at });
    at += token.length;
  }
  return (
    <>
      {tokens.map(({ token, from }) =>
        /^\s/.test(token) ? (
          token
        ) : (
          <span key={from} data-w={from}>
            {token}
          </span>
        ),
      )}
    </>
  );
}

/** Text eines Absatz-Teils mit Suchtreffern, Markern und Notiz-Stellen. */
/** Zeichen mit Wort-Etikett am Anfang (lauter, leiser … Stimmung) und gestrichelter Linie. */
const LABELLED_SIGNS = new Set<ScriptSign>([
  "lauter",
  "leiser",
  "schneller",
  "langsamer",
  "stimmung",
]);

/** Klassen eines Textstücks aus allen Markierungen und Zeichen, die es abdecken. */
function segmentClasses(covering: Range[]) {
  const annotations = covering.flatMap((range) => (range.annotation ? [range.annotation] : []));
  const highlight = annotations.find((annotation) => annotation.kind === "highlight");
  const signs = new Set(
    annotations.flatMap((annotation) => (annotation.sign ? [annotation.sign] : [])),
  );
  const stressed = signs.has("betonung") || signs.has("betonung_stark");
  return cn(
    "text-inherit",
    highlight ? SCRIPT_MARKER_STYLES[highlight.color ?? "gelb"] : "bg-transparent",
    covering.some((range) => !range.annotation) && "bg-primary/25",
    stressed && "underline decoration-foreground decoration-2 underline-offset-[0.22em]",
    signs.has("betonung_stark") && "decoration-double",
    !stressed &&
      annotations.some((annotation) => annotation.kind === "note") &&
      "underline decoration-warning decoration-dotted decoration-2 underline-offset-4",
    signs.has("bogen") &&
      "rounded-t-[1em] border-t-2 border-primary/70 pt-[0.1em] box-decoration-clone",
    [...signs].some((sign) => LABELLED_SIGNS.has(sign)) &&
      "border-b border-dashed border-primary/80 box-decoration-clone",
  );
}

/** Stellen-Zeichen (Pause, Atmer …) zwischen den Wörtern. */
function PointSign({ annotation }: { annotation: ReaderAnnotation }) {
  if (annotation.kind === "ink") return <SketchMark annotation={annotation} />;
  return (
    <span
      data-annotation={annotation.id}
      data-sign-point
      aria-label={annotation.sign ? SCRIPT_SIGNS[annotation.sign].label : undefined}
      className="mx-[0.12em] cursor-pointer font-bold not-italic text-primary"
    >
      {annotation.sign ? SCRIPT_SIGNS[annotation.sign].glyph : ""}
    </span>
  );
}

function TextRun({
  text,
  offset,
  ranges,
  query,
  words,
  includeEnd,
}: {
  text: string;
  /** Position von `text` innerhalb des Teils (für Marker-Bereiche). */
  offset: number;
  ranges: Range[];
  query: string;
  words: boolean;
  /** Stellen-Zeichen genau am Ende mit ausgeben (nur beim letzten Stück eines Teils). */
  includeEnd: boolean;
}) {
  const end = offset + text.length;
  // Stellen: Pause & Co. sowie Notizzettel (Symbol im Text).
  const isPoint = (range: Range) =>
    isPointSign(range.annotation?.sign) || range.annotation?.kind === "ink";
  const spans = ranges.filter((range) => !isPoint(range));
  const points = ranges.filter(
    (range) =>
      isPoint(range) &&
      range.start >= offset &&
      (range.start < end || (includeEnd && range.start === end)),
  );
  const cuts = new Set([offset, end]);
  for (const range of spans) {
    if (range.end <= offset || range.start >= end) continue;
    cuts.add(Math.max(offset, range.start));
    cuts.add(Math.min(end, range.end));
  }
  for (const range of points) cuts.add(range.start);
  const sorted = [...cuts].sort((a, b) => a - b);
  const pointsAt = (at: number) =>
    points
      .filter((range) => range.start === at)
      .map(
        (range) =>
          range.annotation && <PointSign key={range.annotation.id} annotation={range.annotation} />,
      );
  return (
    <>
      {sorted.slice(0, -1).map((from, index) => {
        const to = sorted[index + 1];
        const slice = text.slice(from - offset, to - offset);
        const piece = words ? (
          <Words text={slice} start={from} />
        ) : (
          <Highlighted text={slice} query={query} />
        );
        const covering = spans.filter((entry) => entry.start <= from && entry.end >= to);
        // Etiketten (lauter, Stimmung …) stehen am Anfang ihres Bereichs.
        const labels = covering.flatMap((range) =>
          range.annotation?.sign &&
          LABELLED_SIGNS.has(range.annotation.sign) &&
          range.start === from
            ? [range.annotation]
            : [],
        );
        const ids = covering.flatMap((range) => (range.annotation ? [range.annotation.id] : []));
        return (
          <React.Fragment key={from}>
            {pointsAt(from)}
            {labels.map((annotation) => (
              <span
                key={annotation.id}
                data-annotation={annotation.id}
                className="mr-[0.2em] cursor-pointer align-[0.45em] text-[0.62em] font-medium not-italic text-primary"
              >
                {annotation.sign === "stimmung"
                  ? annotation.body
                  : SCRIPT_SIGNS[annotation.sign!].glyph}
              </span>
            ))}
            {covering.length ? (
              <mark
                data-annotation={ids[0]}
                data-annotations={ids.join(" ") || undefined}
                data-note-selection={covering.some((range) => !range.annotation) || undefined}
                className={cn(segmentClasses(covering), ids.length && "cursor-pointer")}
              >
                {piece}
              </mark>
            ) : (
              piece
            )}
          </React.Fragment>
        );
      })}
      {includeEnd ? pointsAt(end) : null}
    </>
  );
}

function NoteCards({
  notes,
  sketches,
  className,
}: {
  notes: ReaderAnnotation[];
  sketches: ReaderAnnotation[];
  className?: string;
}) {
  if (!notes.length && !sketches.length) return null;
  return (
    <div className={cn("space-y-1 not-italic", className)}>
      {notes.map((note) => (
        <button
          key={note.id}
          type="button"
          data-annotation={note.id}
          className="block w-full border-l-2 border-warning bg-warning/10 px-2 py-1 text-left text-[0.8em] leading-snug text-foreground hover:bg-warning/20"
        >
          {note.state === "changed" ? (
            <span className="mb-0.5 block text-[0.85em] font-semibold text-warning-foreground">
              Text geändert – bitte prüfen
            </span>
          ) : null}
          {note.quote ? (
            <span className="block truncate text-muted-foreground">„{note.quote}“</span>
          ) : null}
          <span className="block whitespace-pre-wrap break-words">{note.body}</span>
        </button>
      ))}
      {sketches.map((sketch) => (
        <SketchCard key={sketch.id} annotation={sketch} />
      ))}
    </div>
  );
}

/**
 * Ab Tablet-Breite stehen Hinweise im rechten Rand auf Höhe ihrer Zeile (wie Randnotizen im
 * Regiebuch): Absatz reserviert rechts Platz, die Hinweiszeile schwebt per float hinein.
 */
const CUE_MARGIN_SPACE =
  "md:group-data-[cue-margin]/reader:flow-root md:group-data-[cue-margin]/reader:pr-[10.5rem]";
const CUE_MARGIN_ROW =
  "md:group-data-[cue-margin]/reader:clear-right md:group-data-[cue-margin]/reader:float-right md:group-data-[cue-margin]/reader:-mr-[10.5rem] md:group-data-[cue-margin]/reader:w-[10rem] md:group-data-[cue-margin]/reader:flex-col md:group-data-[cue-margin]/reader:pl-3";
/** Im Rand steht die Zeile am Satzanfang (auf Höhe des Satzes), schmal darunter am Satzende. */
const CUE_ROW_MARGIN_ONLY = cn(CUE_MARGIN_ROW, "hidden md:group-data-[cue-margin]/reader:flex");
const CUE_ROW_BELOW_ONLY = "md:group-data-[cue-margin]/reader:hidden";

type BlockViewProps = {
  block: ReaderBlock;
  settings: Settings;
  mine: boolean;
  cueLine: boolean;
  /** Name zu lang für die Sprecher-Spalte: eigene Zeile über dem Text (Desktop). */
  stacked: boolean;
  /** Seitenzahl nur am ersten Absatz einer neuen Seite zeigen. */
  showPage: boolean;
  query: string;
  activeMatch: boolean;
  /** Eigene Markierungen und Notizen an diesem Absatz (bereits nach Einstellung gefiltert). */
  annotations: ReaderAnnotation[];
  /** Absatz ist angetippt (Aktionsleiste offen) oder Ziel beim Neu-Zuordnen. */
  selected: boolean;
  /** Notizmodus: Wörter antippbar machen. */
  words: boolean;
  /** Auswahl im Notizmodus in diesem Absatz. */
  noteRange: { partIndex: number; start: number; end: number } | null;
  /** Randnotiz wird an diesem Absatz gerade geschrieben/geändert. */
  noteEditor: React.ReactNode;
  /** Diese Notiz steckt im Editor und wird nicht doppelt gezeigt. */
  editingId: string | null;
};

const BlockView = React.memo(
  React.forwardRef<HTMLDivElement, BlockViewProps>(function BlockView(
    {
      block,
      settings,
      mine,
      cueLine,
      stacked,
      showPage,
      query,
      activeMatch,
      annotations,
      selected,
      words,
      noteRange,
      noteEditor,
      editingId,
    },
    ref,
  ) {
    const hiddenCues = new Set(settings.hiddenCues);
    // Ursprüngliche Indizes behalten – Markierungen verweisen auf sie.
    const parts = block.parts
      .map((part, index) => ({ part, index }))
      .filter(({ part }) => {
        if (part.kind === "cue") return !hiddenCues.has(part.category);
        if (part.kind === "direction") return settings.directions !== "hide";
        return true;
      });
    const lastText = cueLine
      ? (parts.findLast(({ part }) => part.kind === "text")?.index ?? -1)
      : -1;
    const rangesOf = (index: number): Range[] => [
      // Auswahl zuerst: sie liegt sichtbar über vorhandenen Markierungen.
      ...(noteRange?.partIndex === index
        ? [{ start: noteRange.start, end: noteRange.end, annotation: null }]
        : []),
      ...annotations.flatMap((annotation) =>
        annotation.partIndex === index && annotation.start !== null && annotation.end !== null
          ? [{ start: annotation.start, end: annotation.end, annotation }]
          : [],
      ),
    ];
    const blockMark = annotations.find(
      (annotation) => annotation.kind === "highlight" && annotation.partIndex === null,
    );
    const notes = annotations.filter(
      (annotation) => annotation.kind === "note" && annotation.id !== editingId,
    );
    const sketches = annotations.filter((annotation) => annotation.kind === "ink");

    /** Ein Teil oder – wenn ein Hinweis den Satz trennt – ein Ausschnitt davon. */
    const renderPart = ({
      entry: { part, index },
      from,
      to,
    }: PartSlice<(typeof parts)[number]>) => {
      if (part.kind === "cue") return <CueMark key={index} part={part} />;
      const ranges = rangesOf(index);
      const text = part.text.slice(from, to);
      const whole = to === part.text.length;
      const content =
        index === lastText && whole ? (
          (() => {
            const [head, tail] = splitTail(text);
            return (
              <>
                <TextRun
                  text={head}
                  offset={from}
                  ranges={ranges}
                  query={query}
                  words={words}
                  includeEnd={false}
                />
                <span className="font-semibold underline decoration-primary decoration-2 underline-offset-4">
                  <TextRun
                    text={tail}
                    offset={from + head.length}
                    ranges={ranges}
                    query={query}
                    words={words}
                    includeEnd
                  />
                </span>
              </>
            );
          })()
        ) : (
          <TextRun
            text={text}
            offset={from}
            ranges={ranges}
            query={query}
            words={words}
            includeEnd={whole}
          />
        );
      return (
        <span
          key={`${index}:${from}`}
          data-part={index}
          data-part-offset={from || undefined}
          className={cn(
            part.kind === "direction" &&
              block.kind === "speech" &&
              "italic text-muted-foreground/80",
            part.kind === "direction" && settings.directions === "dim" && "opacity-50",
          )}
        >
          {content}
          {whole ? " " : null}
        </span>
      );
    };

    // Hinweise stehen als eigene Zeile unter dem Satz, im Text bleibt nur eine Marke.
    const followed = new Set(settings.followedCues);
    const cueRow = (
      entries: { entry: (typeof parts)[number]; number: number | null }[],
      className = CUE_MARGIN_ROW,
    ) => (
      <CueRow
        className={className}
        followed={followed}
        cues={entries.flatMap(({ entry, number }) =>
          entry.part.kind === "cue" ? [{ part: entry.part, number }] : [],
        )}
      />
    );
    const renderParts = () =>
      settings.cueLayout === "inline"
        ? parts.map((entry) => renderPart({ entry, from: 0, to: entry.part.text.length }))
        : cueSegments(parts).map((segment, segmentIndex) => (
            <React.Fragment key={segmentIndex}>
              {cueRow(segment.before.map((entry) => ({ entry, number: null })))}
              {cueRow(segment.after, CUE_ROW_MARGIN_ONLY)}
              {segment.items.map((item) =>
                item.type === "part" ? (
                  renderPart(item.slice)
                ) : item.entry.part.kind === "cue" ? (
                  <CueMarker
                    key={item.entry.index}
                    category={item.entry.part.category}
                    number={item.number}
                  />
                ) : null,
              )}
              {cueRow(segment.after, CUE_ROW_BELOW_ONLY)}
            </React.Fragment>
          ));

    if (block.kind === "direction") {
      const visible =
        parts.length > 0 &&
        (settings.directions !== "hide" || parts.some(({ part }) => part.kind === "cue"));
      return (
        <div
          ref={ref}
          data-block={block.id}
          className={cn(
            "relative scroll-mt-14 py-0.5 pl-4 text-[0.92em] italic leading-snug text-muted-foreground/80 md:pl-[calc(var(--speaker-col)/0.92+1.25rem+3px)]",
            // Regieblöcke haben keine Seitenzahl-Spalte: gleich weit einrücken wie Repliken.
            CUE_MARGIN_SPACE,
            "md:group-data-[cue-margin]/reader:pr-[13.5rem]",
            !visible && !notes.length && !sketches.length && !noteEditor && "hidden",
            settings.directions === "dim" && "opacity-50",
            blockMark && SCRIPT_MARKER_STYLES[blockMark.color ?? "gelb"],
            activeMatch && "ring-2 ring-inset ring-ring",
            selected && "outline outline-2 -outline-offset-2 outline-primary",
          )}
        >
          {renderParts()}
          <NoteCards notes={notes} sketches={sketches} className="mt-1 xl:mr-[17rem]" />
          {noteEditor}
        </div>
      );
    }

    const dimmed = settings.dimOthers && settings.roleIds.length > 0 && !mine;
    return (
      <div
        ref={ref}
        data-block={block.id}
        className={cn(
          "relative -mx-3 scroll-mt-14 border-l-[3px] border-transparent px-3 py-1 md:mx-0 md:grid md:grid-cols-[var(--speaker-col)_minmax(0,1fr)_2.25rem] md:gap-x-3 md:px-2 xl:grid-cols-[var(--speaker-col)_minmax(0,1fr)_2.25rem_16rem]",
          mine && "border-primary bg-primary/10",
          blockMark && SCRIPT_MARKER_STYLES[blockMark.color ?? "gelb"],
          dimmed && "opacity-45",
          activeMatch && "ring-2 ring-inset ring-ring",
          selected && "outline outline-2 -outline-offset-2 outline-primary",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "hidden pt-[0.2em] text-[0.8em] font-bold uppercase tracking-wide md:block md:break-words",
            stacked && "md:col-span-3",
            mine && "text-primary",
          )}
        >
          {block.speaker ?? "?"}
        </span>
        <p className={cn("relative break-words", CUE_MARGIN_SPACE, stacked && "md:col-start-2")}>
          <span
            className={cn(
              "mr-1.5 text-[0.72em] font-bold uppercase tracking-wide md:sr-only",
              mine ? "text-primary" : "text-muted-foreground",
            )}
          >
            {block.speaker ?? "?"}
          </span>
          <span>{renderParts()}</span>
        </p>
        <span className="hidden pt-[0.25em] text-right text-[0.72em] tabular-nums text-muted-foreground md:block">
          {showPage ? (block.page ?? "") : ""}
        </span>
        <NoteCards
          notes={notes}
          sketches={sketches}
          className="mt-1 md:col-span-2 md:col-start-2 xl:col-span-1 xl:col-start-4 xl:row-span-2 xl:row-start-1 xl:mt-0"
        />
        {noteEditor ? <div className="md:col-span-2 md:col-start-2">{noteEditor}</div> : null}
      </div>
    );
  }),
);

type Position = { first: number; last: number };

export function ScriptReader({
  data,
  canManage,
  previous,
  annotations: initialAnnotations,
}: {
  data: ScriptReaderData;
  canManage: boolean;
  /** Vorfassung für den Vergleich, falls vorhanden. */
  previous: { id: string; label: string } | null;
  /** Eigene Markierungen und Notizen mit Status für diese Fassung. */
  annotations: ReaderAnnotation[];
}) {
  const { version, scenes, blocks, roles } = data;
  const [settings, update] = useSettings(version.showId, data.ownRoleIds);
  // Tablet hochkant: Szenen als Seitenleiste von links statt von unten.
  const sidePanel = useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
  const setRehearsal = (on: boolean) => {
    if (on) {
      const { fontSize, keepAwake, dimOthers } = settings;
      update({
        rehearsalBackup: { fontSize, keepAwake, dimOthers },
        fontSize: Math.max(fontSize, 2),
        keepAwake: true,
        dimOthers: true,
      });
    } else {
      update({ ...settings.rehearsalBackup, rehearsalBackup: null });
    }
  };
  useWakeLock(settings.keepAwake);

  const [panel, setPanel] = React.useState<"scenes" | "roles" | "settings" | null>(null);
  // „Was ist neu“: Hinweis, wenn zuletzt eine andere Fassung dieses Stücks gelesen wurde.
  const [newVersionHint, setNewVersionHint] = React.useState(false);
  React.useEffect(() => {
    const key = `skript-gesehen:${version.showId}`;
    const seen = readStored<{ versionId: string }>(key)?.versionId;
    if (previous && seen && seen !== version.id) setNewVersionHint(true);
    writeStored(key, { versionId: version.id });
  }, [previous, version.id, version.showId]);
  const compareHref = `/mitglieder/skript/${version.id}/vergleich`;
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [matchIndex, setMatchIndex] = React.useState(0);
  const [position, setPosition] = React.useState<Position>({ first: 0, last: 0 });
  // Leiste oben blendet sich beim Weiterlesen aus und beim Zurückscrollen wieder ein.
  const [chromeHidden, setChromeHidden] = React.useState(false);
  const refs = React.useRef<(HTMLDivElement | null)[]>([]);
  const articleRef = React.useRef<HTMLElement>(null);

  // Markierungen und Notizen (Phase 8; sofort sichtbar: docs/Plan/skript-notizen-plan.md)
  const store = useAnnotations(version.id, initialAnnotations);
  const annotations = store.list;
  const [selection, clearSelection] = useTextSelection(articleRef, blocks);
  // Notizmodus: Wörter antippen statt System-Textauswahl (kein „In Google suchen“ o. Ä.).
  const [noteMode, setNoteMode] = React.useState(false);
  const [noteTarget, setNoteTarget] = React.useState<NoteTarget | null>(null);
  /** Angetippte Einträge (Markierung, Zeichen …) – mehrere, wenn sie übereinander liegen. */
  const [tapped, setTapped] = React.useState<string[]>([]);
  const [selectedBlock, setSelectedBlock] = React.useState<string | null>(null);
  const [blockEdit, setBlockEdit] = React.useState<BlockEditorState | null>(null);
  const [editor, setEditor] = React.useState<EditorState | null>(null);
  // Notizen schreibt man direkt am Absatz; das Blatt bleibt für Markierungen und Stimmungen.
  const [inlineNote, setInlineNote] = React.useState<EditorState | null>(null);
  // Notizzettel (Schritt 6): feste Zeichenfläche an einer Stelle im Text.
  const [sketch, setSketch] = React.useState<SketchTarget | null>(null);
  const openSketch = (annotation: ReaderAnnotation) => {
    if (!annotation.blockId) return;
    setSketch({
      existing: annotation,
      blockId: annotation.blockId,
      partIndex: annotation.partIndex,
      at: annotation.start,
      label: annotation.body ?? "Zettel",
    });
  };
  const openEditor = (state: EditorState) => {
    if (state.mode === "create" || state.annotation.kind === "note") {
      setEditor(null);
      setInlineNote(state);
    } else {
      setEditor(state);
    }
  };
  const inlineBlockId =
    inlineNote?.mode === "create" ? inlineNote.blockId : (inlineNote?.annotation.blockId ?? null);
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [pick, setPick] = React.useState<{ annotationId: string; blockId: string | null } | null>(
    null,
  );
  const annotationById = React.useMemo(
    () => new Map(annotations.map((annotation) => [annotation.id, annotation])),
    [annotations],
  );
  const annotationsByBlock = React.useMemo(() => {
    const map = new Map<string, ReaderAnnotation[]>();
    for (const annotation of annotations) {
      if (!annotation.blockId || annotation.state === "orphaned") continue;
      map.set(annotation.blockId, [...(map.get(annotation.blockId) ?? []), annotation]);
    }
    return map;
  }, [annotations]);
  const toReview = annotations.filter((annotation) => annotation.state !== "ok");
  const blockById = React.useMemo(() => new Map(blocks.map((b) => [b.id, b])), [blocks]);
  const noAnnotations: ReaderAnnotation[] = React.useMemo(() => [], []);

  /** Antippen im Text: Notiz öffnen, Absatz wählen oder beim Neu-Zuordnen das Ziel setzen. */
  const onArticleClick = (event: React.MouseEvent) => {
    if (noteMode && consumeDragClick()) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (!noteMode && window.getSelection()?.isCollapsed === false) return;
    if (target.closest("a,button:not([data-annotation])")) return;
    const blockId = target.closest("[data-block]")?.getAttribute("data-block") ?? null;
    if (pick) {
      setPick({ ...pick, blockId });
      return;
    }
    const hit = target.closest("[data-annotation]");
    const annotationId = hit?.getAttribute("data-annotation");
    const annotation = annotationId ? annotationById.get(annotationId) : undefined;
    if (annotation?.kind === "ink") {
      openSketch(annotation);
      return;
    }
    const hitIds = (hit?.getAttribute("data-annotations") ?? annotationId ?? "")
      .split(" ")
      .filter((id) => annotationById.has(id));
    // Zeichen zwischen den Wörtern bzw. Etiketten (lauter …) antippen: entfernen anbieten.
    const signTag = hit && hit.tagName !== "MARK" && annotation?.kind === "sign";
    // Im Notizmodus wählt Antippen im Text immer das Wort; Notizen öffnet man über ihre Karte.
    const noteCard = annotation?.kind === "note" && hit?.tagName !== "MARK";
    if (noteMode && !signTag && !noteCard) {
      setTapped([]);
      onNoteTap(target, blockId);
      return;
    }
    setTapped([]);
    if (annotation && (annotation.kind !== "note" || hitIds.length > 1)) {
      setSelectedBlock(null);
      setTapped(hitIds);
      return;
    }
    if (annotation) {
      setSelectedBlock(null);
      openEditor({ mode: "edit", annotation });
      return;
    }
    // Ganzer Absatz markiert: Antippen öffnet die Markierung (umfärben, entfernen).
    const blockMark = blockId
      ? annotationsByBlock
          .get(blockId)
          ?.find((entry) => entry.kind === "highlight" && entry.partIndex === null)
      : undefined;
    if (blockMark && settings.showNotes) {
      setSelectedBlock(null);
      setTapped([blockMark.id]);
      return;
    }
    setSelectedBlock((current) => (current === blockId ? null : blockId));
  };

  /** Notizmodus: Wort wählen; zweites Wort im selben Satzteil erweitert bis dorthin. */
  const onNoteTap = (target: Element, blockId: string | null) => {
    const block = blockId ? blockById.get(blockId) : undefined;
    if (!block) return;
    const word = target.closest("[data-w]");
    const partIndex = Number(target.closest("[data-part]")?.getAttribute("data-part"));
    const text = block.parts[partIndex]?.text;
    if (!word || text === undefined) {
      // Rollenname oder Rand angetippt: ganzer Absatz.
      setNoteTarget((current) =>
        current?.blockId === block.id && !current.range ? null : { blockId: block.id, range: null },
      );
      return;
    }
    const tapped = wordAt(text, Number(word.getAttribute("data-w")));
    if (!tapped) return;
    setNoteTarget((current) => {
      const range = current?.range;
      if (range && current.blockId === block.id && range.partIndex === partIndex) {
        const single = wordAt(text, range.start);
        const isSingle = single?.start === range.start && single.end === range.end;
        if (isSingle && tapped.start === range.start) return null;
        if (isSingle) return noteTargetOf(block, partIndex, extendTo(range, tapped));
      }
      return noteTargetOf(block, partIndex, tapped);
    });
  };
  const noteTargetOf = (block: ReaderBlock, partIndex: number, span: Span): NoteTarget => ({
    blockId: block.id,
    range: {
      blockId: block.id,
      partIndex,
      start: span.start,
      end: span.end,
      quote: block.parts[partIndex].text.slice(span.start, span.end),
    },
  });
  // Ziehen: Auswahl vom Start- bis zum aktuellen Wort (nur innerhalb desselben Satzteils).
  const consumeDragClick = useWordDrag(articleRef, noteMode, (from, to) => {
    // Anderer Absatz oder Teil (z. B. Regieanweisung dazwischen): Auswahl nicht ändern.
    if (to.blockId !== from.blockId || to.partIndex !== from.partIndex) return;
    const block = blockById.get(from.blockId);
    const text = block?.parts[from.partIndex]?.text;
    if (!block || text === undefined) return;
    const start = wordAt(text, from.offset);
    const end = wordAt(text, to.offset);
    if (start && end) setNoteTarget(noteTargetOf(block, from.partIndex, extendTo(start, end)));
  });
  /** Anfasser gezogen: dieses Ende der Auswahl auf das Wort setzen (das andere bleibt). */
  const moveNoteEdge = (edge: "start" | "end", word: WordRef) => {
    const range = noteTarget?.range;
    if (!range || word.blockId !== noteTarget.blockId || word.partIndex !== range.partIndex) return;
    const block = blockById.get(word.blockId);
    const text = block?.parts[range.partIndex]?.text;
    const tapped = text === undefined ? null : wordAt(text, word.offset);
    if (!block || text === undefined || !tapped) return;
    const fixed = edge === "start" ? wordAt(text, range.end - 1) : wordAt(text, range.start);
    if (fixed) setNoteTarget(noteTargetOf(block, range.partIndex, extendTo(fixed, tapped)));
  };
  const changeNoteRange = (change: (text: string, span: Span) => Span) => {
    const range = noteTarget?.range;
    const block = noteTarget ? blockById.get(noteTarget.blockId) : undefined;
    if (!range || !block) return;
    const text = block.parts[range.partIndex].text;
    setNoteTarget(noteTargetOf(block, range.partIndex, change(text, range)));
  };
  const setNoting = (on: boolean) => {
    clearSelection();
    setSelectedBlock(null);
    setTapped([]);
    setNoteTarget(null);
    setNoteMode(on);
  };
  const closeBar = () => {
    clearSelection();
    setSelectedBlock(null);
    setTapped([]);
  };
  const editBlockAt = (mode: BlockEditorState["mode"]) => {
    const id = selection?.blockId ?? selectedBlock;
    const block = blocks.find((entry) => entry.id === id);
    closeBar();
    if (block) setBlockEdit({ mode, block });
  };
  const tappedAnnotations = tapped.flatMap((id) => annotationById.get(id) ?? []);
  const tappedAnnotation =
    tappedAnnotations.length === 1 && tappedAnnotations[0].kind === "highlight"
      ? tappedAnnotations[0]
      : undefined;
  /** Gezogenes Stellen-Zeichen ablegen: vor einem Wort heißt hinter dem Wort davor. */
  const dropPoint = React.useCallback(
    (sign: ScriptSign, gap: DropGap) => {
      const block = blockById.get(gap.blockId);
      const text = block?.parts[gap.partIndex]?.text;
      if (!block || text === undefined) return;
      let at = gap.offset;
      if (gap.before) while (at > 0 && /\s/.test(text[at - 1])) at -= 1;
      void toggleSign(
        store,
        { blockId: block.id, partIndex: gap.partIndex, start: at, end: at, quote: "" },
        sign,
      );
    },
    [blockById, store],
  );
  const barRef = React.useRef<HTMLDivElement>(null);
  const toolbarRef = React.useRef<HTMLDivElement>(null);

  const roleSet = React.useMemo(() => new Set(settings.roleIds), [settings.roleIds]);
  const followed = React.useMemo(() => new Set(settings.followedCues), [settings.followedCues]);
  const cueLines = React.useMemo(() => cueLineIndices(blocks, roleSet), [blocks, roleSet]);
  const categories = React.useMemo(() => {
    const found = new Set<CueCategory>();
    for (const block of blocks)
      for (const part of block.parts) if (part.kind === "cue") found.add(part.category);
    return (Object.keys(CUE_STYLE) as CueCategory[]).filter((category) => found.has(category));
  }, [blocks]);
  // Rand für Hinweise nur, wenn sie unter dem Satz stehen und überhaupt welche sichtbar sind.
  const cueMargin =
    settings.cueLayout === "below" &&
    categories.some((category) => !settings.hiddenCues.includes(category));
  const sceneIndex = React.useMemo(() => {
    const first = new Map<string, number>();
    blocks.forEach((block, index) => {
      if (!first.has(block.sceneId)) first.set(block.sceneId, index);
    });
    return first;
  }, [blocks]);
  const roleScenes = React.useMemo(
    () => new Set(roles.filter((role) => roleSet.has(role.id)).flatMap((role) => role.sceneIds)),
    [roles, roleSet],
  );

  const trimmed = query.trim();
  const matches = React.useMemo(() => {
    if (trimmed.length < 2) return [];
    const needle = trimmed.toLowerCase();
    return blocks.flatMap((block, index) =>
      blockText(block).toLowerCase().includes(needle) ||
      block.speaker?.toLowerCase().includes(needle)
        ? [index]
        : [],
    );
  }, [blocks, trimmed]);
  const activeMatch = matches.length ? matches[Math.min(matchIndex, matches.length - 1)] : -1;

  const scrollToIndex = React.useCallback((index: number, smooth = true) => {
    refs.current[index]?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
  }, []);

  // Sichtbaren Bereich bestimmen (Kopfzeilen oben, Navigation und Vorschau-Leiste unten).
  React.useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const elements = refs.current;
      const bottoms = elements.map(
        (element) => element?.getBoundingClientRect().bottom ?? -Infinity,
      );
      const top = toolbarRef.current?.getBoundingClientRect().bottom ?? 0;
      const barTop = barRef.current?.getBoundingClientRect().top ?? window.innerHeight;
      const first = Math.min(firstVisibleIndex(bottoms, top), blocks.length - 1);
      let last = first;
      while (
        last + 1 < elements.length &&
        (elements[last + 1]?.getBoundingClientRect().top ?? Infinity) < barTop
      ) {
        last += 1;
      }
      setPosition((current) =>
        current.first === first && current.last === last ? current : { first, last },
      );
    };
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - lastY) > 8) {
        setChromeHidden(y > lastY && y > 80);
        lastY = y;
      }
      if (!frame) frame = window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [blocks.length, settings]);

  // Leseposition je Fassung merken und beim Öffnen wiederherstellen.
  const positionKey = `skript-position:${version.id}`;
  // Einstieg aus dem Probenmodus: `?szene=…&notieren=1` (Skript-Notizen, Schritt 7). Einmal
  // lesen – die URL wird gleich bereinigt, Effekte können aber erneut laufen.
  const entry = React.useRef<URLSearchParams | null>(null);
  const entryParams = React.useCallback(
    () => (entry.current ??= new URLSearchParams(window.location.search)),
    [],
  );
  React.useEffect(() => {
    // Einstieg aus dem Probenmodus springt in die Szene statt zur letzten Stelle.
    if (entryParams().has("szene")) return;
    const stored = readStored<{ lineageId: string }>(positionKey);
    const index = stored?.lineageId
      ? blocks.findIndex((block) => block.lineageId === stored.lineageId)
      : -1;
    if (index > 0) scrollToIndex(index, false);
  }, [blocks, positionKey, scrollToIndex]);
  React.useEffect(() => {
    const block = blocks[position.first];
    if (!block) return;
    const timer = window.setTimeout(
      () => writeStored(positionKey, { lineageId: block.lineageId }),
      500,
    );
    return () => window.clearTimeout(timer);
  }, [blocks, position.first, positionKey]);

  React.useEffect(() => {
    if (activeMatch >= 0) scrollToIndex(activeMatch);
  }, [activeMatch, scrollToIndex]);

  const nextLine = roleSet.size
    ? findNextTarget(blocks, (block) => isRoleBlock(block, roleSet), position.first, position.last)
    : null;
  const nextCue = followed.size
    ? findNextTarget(
        blocks,
        (block) => cueParts(block, followed).length > 0,
        position.first,
        position.last,
      )
    : null;
  const jumpToScene = (sceneId: string) => {
    const index = sceneIndex.get(sceneId);
    if (index !== undefined) scrollToIndex(index, false);
  };
  const entryUsed = React.useRef(false);
  React.useEffect(() => {
    if (entryUsed.current) return;
    const params = entryParams();
    const sceneId = params.get("szene");
    if (params.get("notieren") === "1") setNoteMode(true);
    if (window.location.search) {
      window.history.replaceState(window.history.state, "", window.location.pathname);
    }
    if (!sceneId) {
      entryUsed.current = true;
      return;
    }
    // Erst nach den Schriften springen, sonst verschiebt sich die Stelle noch.
    let cancelled = false;
    void document.fonts.ready.then(() => {
      const index = sceneIndex.get(sceneId);
      if (cancelled) return;
      entryUsed.current = true;
      if (index !== undefined) scrollToIndex(index, false);
    });
    return () => {
      cancelled = true;
    };
  }, [entryParams, sceneIndex, scrollToIndex]);
  // Offline: Seite beim Öffnen selbst in den Cache des Service Workers legen (wie im Lernmodus).
  React.useEffect(() => {
    if (!("caches" in window) || !navigator.onLine) return;
    const path = window.location.pathname;
    caches
      .open("skript-pages")
      .then((cache) => cache.add(new Request(path, { credentials: "same-origin" })))
      .catch((error) => console.warn("[skript] Offline-Kopie nicht gespeichert", error));
  }, []);
  const currentScene = scenes.find((scene) => scene.id === blocks[position.first]?.sceneId);
  const fontClass = FONT_SIZES[settings.fontSize] ?? FONT_SIZES[1];
  // Sprecher-Spalte so breit wie der längste übliche Name; längere Namen stehen darüber.
  const speakerChars = React.useMemo(() => {
    const lengths = blocks.map((block) => block.speaker?.length ?? 0).filter((n) => n > 0);
    return Math.min(SPEAKER_MAX_CHARS, Math.max(8, ...lengths));
  }, [blocks]);

  const pdfUrl = (download: boolean) => {
    const params = new URLSearchParams({ fassung: version.id, regie: settings.directions });
    if (settings.roleIds.length) params.set("rollen", settings.roleIds.join(","));
    if (settings.hiddenCues.length) params.set("ohne", settings.hiddenCues.join(","));
    if (settings.dimOthers) params.set("abblenden", "1");
    params.set("groesse", String(settings.fontSize));
    if (!settings.pdfCover) params.set("deckblatt", "0");
    if (download) params.set("download", "1");
    return `/api/skript/${version.showId}/pdf?${params}`;
  };

  const toggleCategory = (list: "hiddenCues" | "followedCues", category: CueCategory) => {
    const current = settings[list];
    update({
      [list]: current.includes(category)
        ? current.filter((entry) => entry !== category)
        : [...current, category],
    });
  };

  return (
    <div>
      <div
        ref={toolbarRef}
        className={cn(
          "fixed inset-x-0 top-0 z-30 border-b border-border/60 bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur transition-transform duration-200",
          chromeHidden && !searchOpen && !noteMode && "-translate-y-full",
        )}
      >
        <div className="mx-auto flex h-12 max-w-[1240px] items-center gap-0.5 px-1 lg:px-4">
          <Button asChild variant="ghost" size="icon" aria-label="Zurück zu den Fassungen">
            <Link href={SKRIPT_PATH}>
              <ArrowLeftIcon aria-hidden />
            </Link>
          </Button>
          <button
            type="button"
            onClick={() => setPanel("scenes")}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-1 px-1 text-left hover:bg-muted"
            aria-label="Szene wählen"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {currentScene?.title ?? version.label}
              </span>
              <span className="hidden truncate text-xs text-muted-foreground sm:block">
                {version.label}
              </span>
            </span>
            <ChevronDownIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Im Skript suchen"
            aria-pressed={searchOpen}
            onClick={() => setSearchOpen((open) => !open)}
          >
            <SearchIcon aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Rollen wählen"
            className="relative"
            onClick={() => setPanel("roles")}
          >
            <UsersIcon aria-hidden />
            {settings.roleIds.length ? (
              <span className="absolute right-1 top-1 rounded-full bg-primary px-1 text-[10px] leading-4 text-primary-foreground">
                {settings.roleIds.length}
              </span>
            ) : null}
          </Button>
          {version.status === "released" ? (
            <Button
              asChild
              variant="ghost"
              size="icon"
              aria-label="Text lernen"
              className="hidden sm:inline-flex"
            >
              <Link href={`/mitglieder/lernen/${version.showId}`}>
                <SparklesIcon aria-hidden />
              </Link>
            </Button>
          ) : null}
          {store.waiting ? (
            <span
              className="flex items-center gap-1 px-1 text-xs text-muted-foreground"
              title="Ohne Netz gespeichert – wird nachgesendet"
            >
              <CloudOffIcon aria-hidden className="size-4" />
              <span className="sr-only">Wartende Notizen:</span>
              {store.waiting}
            </span>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Notieren"
            aria-pressed={noteMode}
            className={cn(noteMode && "bg-primary/15 text-primary")}
            onClick={() => setNoting(!noteMode)}
          >
            <HighlighterIcon aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Ansicht einstellen"
            onClick={() => setPanel("settings")}
          >
            <SettingsIcon aria-hidden />
          </Button>
        </div>
        {searchOpen ? (
          <div className="mx-auto flex max-w-[1240px] items-center gap-1 px-2 pb-2 lg:px-4">
            <input
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setMatchIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && matches.length) {
                  setMatchIndex(
                    (index) => (index + (event.shiftKey ? matches.length - 1 : 1)) % matches.length,
                  );
                }
                if (event.key === "Escape") setSearchOpen(false);
              }}
              placeholder="Text oder Rolle suchen"
              aria-label="Suchbegriff"
              className="h-10 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-base"
            />
            <span
              className="w-14 shrink-0 text-center text-xs text-muted-foreground"
              aria-live="polite"
            >
              {trimmed.length < 2
                ? ""
                : matches.length
                  ? `${Math.min(matchIndex, matches.length - 1) + 1}/${matches.length}`
                  : "0"}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Vorheriger Treffer"
              disabled={!matches.length}
              onClick={() =>
                setMatchIndex((index) => (index + matches.length - 1) % matches.length)
              }
            >
              <ChevronUpIcon aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Nächster Treffer"
              disabled={!matches.length}
              onClick={() => setMatchIndex((index) => (index + 1) % matches.length)}
            >
              <ChevronDownIcon aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Suche schließen"
              onClick={() => {
                setSearchOpen(false);
                setQuery("");
              }}
            >
              <CloseIcon aria-hidden />
            </Button>
          </div>
        ) : null}
      </div>

      <div className="mx-auto max-w-[1240px] lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-8 lg:px-4">
        <aside className="sticky top-0 hidden max-h-dvh self-start overflow-y-auto pb-6 pt-16 text-sm lg:block">
          <p className="px-2 pb-1 text-xs text-muted-foreground">Szenen</p>
          <SceneList
            compact
            scenes={scenes}
            currentId={currentScene?.id}
            roleScenes={roleScenes}
            onPick={jumpToScene}
          />
        </aside>
        <article
          ref={articleRef}
          data-cue-margin={cueMargin || undefined}
          // Ist die Kopfleiste beim Lesen weggescrollt, klebt stattdessen die Szenenüberschrift oben.
          data-chrome-hidden={(chromeHidden && !searchOpen && !noteMode) || undefined}
          onClick={onArticleClick}
          // Notizmodus: kein Kontextmenü/„In Google suchen“ beim Gedrückthalten.
          onContextMenu={
            noteMode
              ? (event) => {
                  // Im Notiz-Textfeld bleibt das Menü (Einfügen, Diktieren).
                  if (!(event.target instanceof HTMLTextAreaElement)) event.preventDefault();
                }
              : undefined
          }
          className={cn(
            "group/reader",
            noteMode && "cursor-pointer select-none [-webkit-touch-callout:none]",
            "min-w-0 px-3 pb-24 pt-[calc(3.5rem+env(safe-area-inset-top))] leading-normal sm:px-4 lg:px-0",
            fontClass,
          )}
          style={{
            ["--speaker-col" as string]: `${(speakerChars * 0.78).toFixed(2)}em`,
          }}
        >
          {newVersionHint && previous ? (
            <div className="-mx-3 mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-l-[3px] border-primary bg-primary/10 px-3 py-2 text-sm sm:-mx-4 sm:px-4 md:mx-0 md:px-3">
              <span className="w-full min-w-0 sm:w-auto sm:flex-1">
                Neue Fassung seit „{previous.label}“. Was hat sich für dich geändert?
              </span>
              <Link
                href={`${compareHref}?nur=${settings.roleIds.length ? "meine" : "alle"}`}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Änderungen ansehen
              </Link>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => setNewVersionHint(false)}
              >
                Ausblenden
              </button>
            </div>
          ) : null}
          {toReview.length ? (
            <div className="-mx-3 mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-l-[3px] border-warning bg-warning/10 px-3 py-2 text-sm sm:-mx-4 sm:px-4 md:mx-0 md:px-3">
              <span className="w-full min-w-0 sm:w-auto sm:flex-1">
                {toReview.length === 1
                  ? "1 Notiz hängt an geändertem oder gestrichenem Text."
                  : `${toReview.length} Notizen hängen an geändertem oder gestrichenem Text.`}
              </span>
              <button
                type="button"
                className="font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => setReviewOpen(true)}
              >
                Prüfen
              </button>
            </div>
          ) : null}
          {version.status === "draft" ? (
            <p className="-mx-3 mb-2 border-l-[3px] border-warning bg-warning/15 px-3 py-1 text-sm sm:-mx-4 sm:px-4">
              Entwurf – das Ensemble sieht diese Fassung erst nach der Freigabe.
              {canManage ? (
                <>
                  {" "}
                  <Link
                    href={`${SKRIPT_PATH}&fassung=${version.id}`}
                    className="font-medium underline underline-offset-4"
                  >
                    Prüfen und freigeben
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
          {blocks.map((block, index) => {
            const scene =
              sceneIndex.get(block.sceneId) === index
                ? scenes.find((s) => s.id === block.sceneId)
                : null;
            return (
              <React.Fragment key={block.id}>
                {scene ? (
                  <h2
                    id={`szene-${scene.id}`}
                    className="top-[env(safe-area-inset-top)] z-10 mb-1 mt-8 scroll-mt-14 border-b-2 border-foreground bg-background/95 pb-1 pt-1 text-[0.85em] font-bold uppercase tracking-wider backdrop-blur first:mt-2 group-data-[chrome-hidden]/reader:sticky"
                  >
                    {scene.title}
                  </h2>
                ) : null}
                <BlockView
                  ref={(element) => {
                    refs.current[index] = element;
                  }}
                  block={block}
                  settings={settings}
                  mine={isRoleBlock(block, roleSet)}
                  cueLine={cueLines.has(index)}
                  stacked={(block.speaker?.length ?? 0) > SPEAKER_MAX_CHARS}
                  showPage={index === 0 || blocks[index - 1].page !== block.page}
                  query={trimmed.length >= 2 ? trimmed : ""}
                  activeMatch={index === activeMatch}
                  annotations={
                    settings.showNotes
                      ? (annotationsByBlock.get(block.id) ?? noAnnotations)
                      : noAnnotations
                  }
                  selected={
                    (!selection && selectedBlock === block.id) ||
                    pick?.blockId === block.id ||
                    (noteTarget?.blockId === block.id && !noteTarget.range)
                  }
                  words={noteMode}
                  editingId={inlineNote?.mode === "edit" ? inlineNote.annotation.id : null}
                  noteEditor={
                    inlineNote && inlineBlockId === block.id ? (
                      <InlineNoteEditor
                        key={inlineNote.mode === "edit" ? inlineNote.annotation.id : "neu"}
                        store={store}
                        state={inlineNote}
                        onClose={() => setInlineNote(null)}
                      />
                    ) : null
                  }
                  noteRange={noteTarget?.blockId === block.id ? noteTarget.range : null}
                />
              </React.Fragment>
            );
          })}
        </article>
      </div>

      <div
        ref={barRef}
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur",
          // Beim Schreiben einer Randnotiz verdeckt die Leiste sonst über der Tastatur das Feld.
          inlineNote && "hidden",
          (nextCue ||
            nextLine ||
            selection ||
            selectedBlock ||
            pick ||
            noteMode ||
            tappedAnnotations.length) &&
            "border-t border-border",
        )}
      >
        <div className="mx-auto flex max-w-[1240px] flex-col divide-y divide-border/60 lg:pl-[calc(13rem+3rem)] lg:pr-4">
          {noteMode ? (
            <>
              {tappedAnnotations.length ? (
                <TappedBar
                  store={store}
                  annotations={tappedAnnotations}
                  onEdit={(annotation) => {
                    setTapped([]);
                    openEditor({ mode: "edit", annotation });
                  }}
                  onDone={() => setTapped([])}
                />
              ) : null}
              <NoteToolbox
                store={store}
                target={noteTarget}
                partText={
                  noteTarget?.range
                    ? (blockById.get(noteTarget.blockId)?.parts[noteTarget.range.partIndex]?.text ??
                      null)
                    : null
                }
                onNudge={(direction) =>
                  changeNoteRange((text, span) => nudge(text, span, direction))
                }
                onSentence={() => changeNoteRange(sentenceAround)}
                onBlock={() =>
                  noteTarget && setNoteTarget({ blockId: noteTarget.blockId, range: null })
                }
                onNote={() => {
                  if (!noteTarget) return;
                  openEditor({
                    mode: "create",
                    blockId: noteTarget.blockId,
                    selection: noteTarget.range,
                  });
                  setNoteTarget(null);
                }}
                onClear={() => setNoteTarget(null)}
                onDone={() => setNoting(false)}
                onDropPoint={dropPoint}
                onSketch={() => {
                  if (!noteTarget) return;
                  const range = noteTarget.range;
                  const text = range
                    ? blockById.get(noteTarget.blockId)?.parts[range.partIndex]?.text
                    : undefined;
                  setSketch({
                    existing: null,
                    blockId: noteTarget.blockId,
                    partIndex: range && text !== undefined ? range.partIndex : null,
                    at: range && text !== undefined ? gapAfter(text, range.end) : null,
                    label: range?.quote ?? "Absatz",
                  });
                  setNoteTarget(null);
                }}
              />
            </>
          ) : pick ? (
            <PickBar
              versionId={version.id}
              annotationId={pick.annotationId}
              blockId={pick.blockId}
              onDone={() => setPick(null)}
            />
          ) : tappedAnnotations.length && !tappedAnnotation ? (
            <TappedBar
              store={store}
              annotations={tappedAnnotations}
              onEdit={(annotation) => {
                setTapped([]);
                openEditor({ mode: "edit", annotation });
              }}
              onDone={closeBar}
            />
          ) : tappedAnnotation ? (
            <HighlightBar
              store={store}
              annotation={tappedAnnotation}
              onNote={() => {
                if (tappedAnnotation.blockId) {
                  openEditor({
                    mode: "create",
                    blockId: tappedAnnotation.blockId,
                    selection:
                      tappedAnnotation.partIndex !== null &&
                      tappedAnnotation.start !== null &&
                      tappedAnnotation.end !== null
                        ? {
                            blockId: tappedAnnotation.blockId,
                            partIndex: tappedAnnotation.partIndex,
                            start: tappedAnnotation.start,
                            end: tappedAnnotation.end,
                            quote: tappedAnnotation.quote ?? "",
                          }
                        : null,
                  });
                }
                closeBar();
              }}
              onDone={closeBar}
            />
          ) : selection || selectedBlock ? (
            <AnnotationBar
              store={store}
              selection={selection}
              blockId={selectedBlock}
              onNote={() => {
                const blockId = selection?.blockId ?? selectedBlock;
                if (blockId) openEditor({ mode: "create", blockId, selection });
                closeBar();
              }}
              onDone={closeBar}
              {...(canManage
                ? { onEdit: () => editBlockAt("edit"), onInsert: () => editBlockAt("insert") }
                : {})}
            />
          ) : null}
          {!noteMode && !pick && !selection && !selectedBlock && nextCue ? (
            <NextBar
              label="Nächster Hinweis"
              title={cueParts(blocks[nextCue.index], followed)
                .map((part) => part.text)
                .join(" · ")}
              linesAway={nextCue.linesAway}
              onClick={() => scrollToIndex(nextCue.index)}
            />
          ) : null}
          {!noteMode && !pick && !selection && !selectedBlock && nextLine ? (
            <NextBar
              label={`Nächste Passage · ${blocks[nextLine.index].speaker ?? ""}`}
              title={blockText(blocks[nextLine.index])}
              linesAway={nextLine.linesAway}
              onClick={() => scrollToIndex(nextLine.index)}
            />
          ) : null}
        </div>
      </div>

      {sidePanel ? (
        <Sheet open={panel === "scenes"} onOpenChange={(open) => setPanel(open ? "scenes" : null)}>
          <SheetContent
            side="left"
            className="w-80 overflow-y-auto p-4 pt-[calc(1rem+env(safe-area-inset-top))]"
          >
            <SheetTitle className="text-base">Szenen</SheetTitle>
            <SheetDescription className="sr-only">Zu einer Szene springen</SheetDescription>
            <SceneList
              scenes={scenes}
              currentId={currentScene?.id}
              roleScenes={roleScenes}
              onPick={(id) => {
                setPanel(null);
                window.setTimeout(() => jumpToScene(id), 50);
              }}
            />
            <p className="pt-3 text-xs text-muted-foreground">
              Dauer geschätzt aus der Wortzahl. Punkt = eine gewählte Rolle spricht in der Szene.
            </p>
          </SheetContent>
        </Sheet>
      ) : (
        <BottomSheet
          open={panel === "scenes"}
          onOpenChange={(open) => setPanel(open ? "scenes" : null)}
          title="Szenen"
          description="Zu einer Szene springen"
        >
          <SceneList
            scenes={scenes}
            currentId={currentScene?.id}
            roleScenes={roleScenes}
            onPick={(id) => {
              setPanel(null);
              window.setTimeout(() => jumpToScene(id), 50);
            }}
          />
          <p className="pt-3 text-xs text-muted-foreground">
            Dauer geschätzt aus der Wortzahl. Punkt = eine gewählte Rolle spricht in der Szene.
          </p>
        </BottomSheet>
      )}

      <BottomSheet
        open={panel === "roles"}
        onOpenChange={(open) => setPanel(open ? "roles" : null)}
        title="Rollen"
        description="Rollen wählen, deren Passagen hervorgehoben werden"
        headerAction={
          data.ownRoleIds.length ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => update({ roleIds: data.ownRoleIds })}
            >
              Meine Rollen
            </Button>
          ) : null
        }
      >
        <label className="flex min-h-11 items-center justify-between gap-3 border-b border-border/60 pb-3 text-sm">
          <span>Fremde Repliken abblenden</span>
          <Switch
            checked={settings.dimOthers}
            onCheckedChange={(checked) => update({ dimOthers: checked })}
            aria-label="Fremde Repliken abblenden"
          />
        </label>
        <ul className="divide-y divide-border/60">
          {roles.map((role) => (
            <li key={role.id}>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 py-2 text-sm">
                <Checkbox
                  checked={roleSet.has(role.id)}
                  onCheckedChange={(checked) =>
                    update({
                      roleIds:
                        checked === true
                          ? [...settings.roleIds, role.id]
                          : settings.roleIds.filter((id) => id !== role.id),
                    })
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 break-words font-medium">
                    {role.name}
                    {data.ownRoleIds.includes(role.id) ? (
                      <Badge size="sm" variant="secondary">
                        meine
                      </Badge>
                    ) : null}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {role.lines} {role.lines === 1 ? "Replik" : "Repliken"} · {role.words}{" "}
                    {role.words === 1 ? "Wort" : "Wörter"} · {role.sceneIds.length}{" "}
                    {role.sceneIds.length === 1 ? "Szene" : "Szenen"}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </BottomSheet>

      <BottomSheet
        open={panel === "settings"}
        onOpenChange={(open) => setPanel(open ? "settings" : null)}
        title="Ansicht"
        description="Schriftgröße, Regieanweisungen und Hinweise einstellen"
      >
        <div className="space-y-5 text-sm">
          {/* Handy: Lernen steht hier statt in der Kopfleiste. */}
          <section className="grid grid-cols-2 gap-2 sm:hidden">
            {version.status === "released" ? (
              <Button asChild variant="outline" className="min-h-11">
                <Link href={`/mitglieder/lernen/${version.showId}`}>
                  <SparklesIcon aria-hidden />
                  Text lernen
                </Link>
              </Button>
            ) : null}
          </section>
          <label className="flex min-h-11 items-center justify-between gap-3">
            <span>
              <span className="block font-medium">Probenmodus</span>
              <span className="block text-xs text-muted-foreground">
                Größere Schrift, Bildschirm bleibt an, fremde Repliken abgeblendet
              </span>
            </span>
            <Switch
              checked={settings.rehearsalBackup !== null}
              onCheckedChange={setRehearsal}
              aria-label="Probenmodus"
            />
          </label>
          <section className="space-y-2">
            <h3 className="font-medium">Schriftgröße</h3>
            <SegmentedControl
              aria-label="Schriftgröße"
              fullWidth
              value={String(settings.fontSize)}
              onValueChange={(value) => update({ fontSize: Number(value) })}
              options={["S", "M", "L", "XL"].map((label, index) => ({
                value: String(index),
                label,
              }))}
            />
          </section>
          <section className="space-y-2">
            <h3 className="font-medium">Regieanweisungen</h3>
            <SegmentedControl<Visibility>
              aria-label="Regieanweisungen"
              fullWidth
              value={settings.directions}
              onValueChange={(directions) => update({ directions })}
              options={[
                { value: "show", label: "Zeigen" },
                { value: "dim", label: "Abblenden" },
                { value: "hide", label: "Ausblenden" },
              ]}
            />
          </section>
          {categories.length ? (
            <section className="space-y-2">
              <h3 className="font-medium">Hinweise anzeigen</h3>
              <SegmentedControl<Settings["cueLayout"]>
                aria-label="Hinweise anzeigen"
                fullWidth
                value={settings.cueLayout}
                onValueChange={(cueLayout) => update({ cueLayout })}
                options={[
                  { value: "below", label: "Unter dem Satz" },
                  { value: "inline", label: "Im Text" },
                ]}
              />
            </section>
          ) : null}
          {categories.length ? (
            <section className="space-y-1">
              <h3 className="font-medium">Technische Hinweise</h3>
              <p className="text-xs text-muted-foreground">
                „Verfolgen“ zeigt unten den nächsten Hinweis des Gewerks an.
              </p>
              <ul className="divide-y divide-border/60">
                {categories.map((category) => (
                  <li
                    key={category}
                    className="flex min-h-11 flex-wrap items-center gap-x-4 gap-y-1 py-1"
                  >
                    <span
                      className={cn(
                        "min-w-24 flex-1 border-l-2 px-2 py-0.5 font-medium",
                        CUE_STYLE[category].className,
                      )}
                    >
                      {CUE_STYLE[category].label}
                    </span>
                    <label className="flex items-center gap-2">
                      <Switch
                        checked={!settings.hiddenCues.includes(category)}
                        onCheckedChange={() => toggleCategory("hiddenCues", category)}
                        aria-label={`${CUE_STYLE[category].label} anzeigen`}
                      />
                      Zeigen
                    </label>
                    <label className="flex items-center gap-2">
                      <Switch
                        checked={settings.followedCues.includes(category)}
                        onCheckedChange={() => toggleCategory("followedCues", category)}
                        aria-label={`${CUE_STYLE[category].label} verfolgen`}
                      />
                      Verfolgen
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <label className="flex min-h-11 items-center justify-between gap-3">
            <span>Meine Markierungen und Notizen</span>
            <Switch
              checked={settings.showNotes}
              onCheckedChange={(showNotes) => update({ showNotes })}
              aria-label="Markierungen und Notizen zeigen"
            />
          </label>
          <label className="flex min-h-11 items-center justify-between gap-3">
            <span>Bildschirm anlassen</span>
            <Switch
              checked={settings.keepAwake}
              onCheckedChange={(keepAwake) => update({ keepAwake })}
              aria-label="Bildschirm anlassen"
            />
          </label>
          <section className="space-y-2 border-t border-border/60 pt-4">
            <h3 className="font-medium">PDF</h3>
            <p className="text-xs text-muted-foreground">
              Mit den aktuellen Einstellungen: gewählte Rollen, Regieanweisungen, sichtbare Hinweise
              und Schriftgröße.
            </p>
            <label className="flex min-h-11 items-center justify-between gap-3">
              <span>Mit Deckblatt und Szenenverzeichnis</span>
              <Switch
                checked={settings.pdfCover}
                onCheckedChange={(pdfCover) => update({ pdfCover })}
                aria-label="PDF mit Deckblatt"
              />
            </label>
            <Button asChild variant="outline">
              <a href={pdfUrl(false)} target="_blank" rel="noopener">
                <PrinterIcon aria-hidden /> PDF öffnen
              </a>
            </Button>{" "}
            <Button asChild variant="ghost">
              <a href={pdfUrl(true)}>
                <DownloadIcon aria-hidden /> Herunterladen
              </a>
            </Button>
          </section>
          {previous ? (
            <Link
              href={compareHref}
              className="flex min-h-11 items-center gap-2 text-primary underline-offset-4 hover:underline"
            >
              <BookOpenTextIcon aria-hidden /> Änderungen seit „{previous.label}“
            </Link>
          ) : null}
          {canManage ? (
            <Link
              href={`${SKRIPT_PATH}&fassung=${version.id}`}
              className="inline-flex min-h-11 items-center gap-2 text-primary underline-offset-4 hover:underline"
            >
              <BookOpenTextIcon aria-hidden /> Fassung prüfen und verwalten
            </Link>
          ) : null}
          <Link
            href="/mitglieder/dashboard"
            className="flex min-h-11 items-center gap-2 text-primary underline-offset-4 hover:underline"
          >
            <ArrowLeftIcon aria-hidden /> Zum Mitgliederbereich
          </Link>
        </div>
      </BottomSheet>
      {canManage ? (
        <BlockEditor
          state={blockEdit}
          onClose={() => setBlockEdit(null)}
          versionId={version.id}
          released={version.status === "released"}
          roles={roles}
        />
      ) : null}
      <SelectionHandles
        selectionKey={
          noteMode && noteTarget?.range
            ? `${noteTarget.blockId}:${noteTarget.range.partIndex}:${noteTarget.range.start}:${noteTarget.range.end}:${settings.fontSize}`
            : null
        }
        onMove={moveNoteEdge}
      />
      {sketch ? (
        <SketchEditor
          // Eigener Schlüssel: der Notiz-Editor daneben heißt sonst ebenfalls „neu“.
          key={`zettel:${sketch.existing?.id ?? "neu"}`}
          target={sketch}
          onSave={(strokes, title) =>
            void store.saveSketch({
              existing: sketch.existing,
              blockId: sketch.blockId,
              partIndex: sketch.partIndex,
              at: sketch.at,
              title,
              strokes,
            })
          }
          onClose={() => setSketch(null)}
        />
      ) : null}
      <AnnotationEditor
        key={editor?.mode === "edit" ? editor.annotation.id : (editor?.blockId ?? "neu")}
        store={store}
        state={editor}
        onClose={() => setEditor(null)}
      />
      <AnnotationReview
        versionId={version.id}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        annotations={toReview}
        blocks={blockById}
        onPick={(annotationId) => {
          setReviewOpen(false);
          setPick({ annotationId, blockId: null });
        }}
      />
    </div>
  );
}

function NextBar({
  label,
  title,
  linesAway,
  onClick,
}: {
  label: string;
  title: string;
  linesAway: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 w-full min-w-0 items-center gap-3 px-3 py-1.5 text-left hover:bg-muted sm:px-4"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold uppercase tracking-wide text-primary">
          {label}
        </span>
        <span className="block truncate text-sm">{title}</span>
      </span>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {linesAway === 0 ? "gleich" : `in ${linesAway} ${linesAway === 1 ? "Replik" : "Repliken"}`}
      </span>
    </button>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";

import {
  ArrowLeftIcon,
  BookOpenTextIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CloseIcon,
  DownloadIcon,
  PenLineIcon,
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
import { Switch } from "@/components/ui/switch";
import { SCRIPT_MARKER_STYLES } from "@/config/category-colors";
import type { ReaderAnnotation } from "@/lib/skript/annotation-types";
import type { ReaderBlock, ScriptReaderData } from "@/lib/skript/reader";
import {
  cueLineIndices,
  cueParts,
  findNextTarget,
  firstVisibleIndex,
  isRoleBlock,
  splitTail,
} from "@/lib/skript/reader-logic";
import type { CueCategory } from "@/lib/skript/types";
import { cn } from "@/lib/utils";

import {
  CUE_STYLE,
  CueMark,
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
  PickBar,
  useTextSelection,
  type EditorState,
} from "./annotations";
import { InkLayer, PenBar, usePen, type PenSettings } from "./ink";

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

type Range = { start: number; end: number; annotation: ReaderAnnotation };

/** Text eines Absatz-Teils mit Suchtreffern, Markern und Notiz-Stellen. */
function TextRun({
  text,
  offset,
  ranges,
  query,
}: {
  text: string;
  /** Position von `text` innerhalb des Teils (für Marker-Bereiche). */
  offset: number;
  ranges: Range[];
  query: string;
}) {
  const cuts = new Set([offset, offset + text.length]);
  for (const range of ranges) {
    if (range.end <= offset || range.start >= offset + text.length) continue;
    cuts.add(Math.max(offset, range.start));
    cuts.add(Math.min(offset + text.length, range.end));
  }
  const points = [...cuts].sort((a, b) => a - b);
  return (
    <>
      {points.slice(0, -1).map((from, index) => {
        const to = points[index + 1];
        const piece = <Highlighted text={text.slice(from - offset, to - offset)} query={query} />;
        const range = ranges.find((entry) => entry.start <= from && entry.end >= to);
        if (!range) return <React.Fragment key={from}>{piece}</React.Fragment>;
        const { annotation } = range;
        return (
          <mark
            key={from}
            data-annotation={annotation.id}
            className={cn(
              "cursor-pointer text-inherit",
              annotation.kind === "highlight"
                ? SCRIPT_MARKER_STYLES[annotation.color ?? "gelb"]
                : "bg-transparent underline decoration-warning decoration-dotted decoration-2 underline-offset-4",
            )}
          >
            {piece}
          </mark>
        );
      })}
    </>
  );
}

function NoteCards({ notes, className }: { notes: ReaderAnnotation[]; className?: string }) {
  if (!notes.length) return null;
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
    </div>
  );
}

type BlockViewProps = {
  block: ReaderBlock;
  settings: Settings;
  mine: boolean;
  cueLine: boolean;
  /** Name zu lang für die Sprecher-Spalte: eigene Zeile über dem Text (Desktop). */
  stacked: boolean;
  query: string;
  activeMatch: boolean;
  /** Eigene Markierungen und Notizen an diesem Absatz (bereits nach Einstellung gefiltert). */
  annotations: ReaderAnnotation[];
  /** Absatz ist angetippt (Aktionsleiste offen) oder Ziel beim Neu-Zuordnen. */
  selected: boolean;
  /** Freihand-Zeichnung des Absatzes (gespeichert + vorläufig). */
  ink: React.ComponentProps<typeof InkLayer> | null;
};

const BlockView = React.memo(
  React.forwardRef<HTMLDivElement, BlockViewProps>(function BlockView(
    { block, settings, mine, cueLine, stacked, query, activeMatch, annotations, selected, ink },
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
    const rangesOf = (index: number): Range[] =>
      annotations.flatMap((annotation) =>
        annotation.partIndex === index && annotation.start !== null && annotation.end !== null
          ? [{ start: annotation.start, end: annotation.end, annotation }]
          : [],
      );
    const blockMark = annotations.find(
      (annotation) => annotation.kind === "highlight" && annotation.partIndex === null,
    );
    const notes = annotations.filter((annotation) => annotation.kind === "note");

    const renderPart = ({ part, index }: (typeof parts)[number]) => {
      if (part.kind === "cue") return <CueMark key={index} part={part} />;
      const ranges = rangesOf(index);
      const content =
        index === lastText ? (
          (() => {
            const [head, tail] = splitTail(part.text);
            return (
              <>
                <TextRun text={head} offset={0} ranges={ranges} query={query} />
                <span className="font-semibold underline decoration-primary decoration-2 underline-offset-4">
                  <TextRun text={tail} offset={head.length} ranges={ranges} query={query} />
                </span>
              </>
            );
          })()
        ) : (
          <TextRun text={part.text} offset={0} ranges={ranges} query={query} />
        );
      return (
        <span
          key={index}
          data-part={index}
          className={cn(
            part.kind === "direction" && block.kind === "speech" && "italic text-muted-foreground",
            part.kind === "direction" && settings.directions === "dim" && "opacity-50",
          )}
        >
          {content}{" "}
        </span>
      );
    };

    if (block.kind === "direction") {
      const visible =
        parts.length > 0 &&
        (settings.directions !== "hide" || parts.some(({ part }) => part.kind === "cue"));
      return (
        <div
          ref={ref}
          data-block={block.id}
          className={cn(
            "relative scroll-mt-14 py-0.5 pl-4 italic text-muted-foreground md:pl-[calc(var(--speaker-col)+1.25rem+3px)]",
            !visible && !notes.length && "hidden",
            settings.directions === "dim" && "opacity-50",
            blockMark && SCRIPT_MARKER_STYLES[blockMark.color ?? "gelb"],
            activeMatch && "ring-2 ring-inset ring-ring",
            selected && "outline outline-2 -outline-offset-2 outline-primary",
          )}
        >
          {parts.map(renderPart)}
          <NoteCards notes={notes} className="mt-1 xl:mr-[17rem]" />
          {ink ? <InkLayer {...ink} /> : null}
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
        <p data-ink-anchor className={cn("relative break-words", stacked && "md:col-start-2")}>
          <span
            className={cn(
              "mr-1.5 text-[0.72em] font-bold uppercase tracking-wide md:sr-only",
              mine ? "text-primary" : "text-muted-foreground",
            )}
          >
            {block.speaker ?? "?"}
          </span>
          <span data-ink-text>{parts.map(renderPart)}</span>
          {ink ? <InkLayer {...ink} /> : null}
        </p>
        <span className="hidden pt-[0.25em] text-right text-[0.72em] tabular-nums text-muted-foreground md:block">
          {block.page ?? ""}
        </span>
        <NoteCards
          notes={notes}
          className="mt-1 md:col-span-2 md:col-start-2 xl:col-span-1 xl:col-start-4 xl:row-span-2 xl:row-start-1 xl:mt-0"
        />
      </div>
    );
  }),
);

type Position = { first: number; last: number };

export function ScriptReader({
  data,
  canManage,
  previous,
  annotations,
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

  // Markierungen und Notizen (Phase 8)
  const [selection, clearSelection] = useTextSelection(articleRef, blocks);
  const [selectedBlock, setSelectedBlock] = React.useState<string | null>(null);
  const [editor, setEditor] = React.useState<EditorState | null>(null);
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
  // Freihandnotizen (Phase 9)
  const [penMode, setPenMode] = React.useState(false);
  const [penSettings, setPenSettings] = React.useState<PenSettings>({
    tool: "pen",
    color: "rot",
    size: "mittel",
    finger: false,
  });
  const inkByBlock = React.useMemo(() => {
    const map = new Map<string, ReaderAnnotation>();
    for (const annotation of annotations) {
      if (annotation.kind === "ink" && annotation.blockId && annotation.state !== "orphaned") {
        map.set(annotation.blockId, annotation);
      }
    }
    return map;
  }, [annotations]);
  const pen = usePen({
    enabled: penMode,
    settings: penSettings,
    versionId: version.id,
    inkByBlock,
  });
  const noStrokes = React.useMemo(() => [], []);
  const toReview = annotations.filter((annotation) => annotation.state !== "ok");
  const blockById = React.useMemo(() => new Map(blocks.map((b) => [b.id, b])), [blocks]);
  const noAnnotations: ReaderAnnotation[] = React.useMemo(() => [], []);

  /** Antippen im Text: Notiz öffnen, Absatz wählen oder beim Neu-Zuordnen das Ziel setzen. */
  const onArticleClick = (event: React.MouseEvent) => {
    if (penMode) return;
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    if (window.getSelection()?.isCollapsed === false) return;
    if (target.closest("a,button:not([data-annotation])")) return;
    const blockId = target.closest("[data-block]")?.getAttribute("data-block") ?? null;
    if (pick) {
      setPick({ ...pick, blockId });
      return;
    }
    const annotationId = target.closest("[data-annotation]")?.getAttribute("data-annotation");
    const annotation = annotationId ? annotationById.get(annotationId) : undefined;
    if (annotation) {
      setSelectedBlock(null);
      setEditor({ mode: "edit", annotation });
      return;
    }
    setSelectedBlock((current) => (current === blockId ? null : blockId));
  };
  const closeBar = () => {
    clearSelection();
    setSelectedBlock(null);
  };
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
  React.useEffect(() => {
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
          chromeHidden && !searchOpen && !penMode && "-translate-y-full",
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
              <span className="block truncate text-xs text-muted-foreground">{version.label}</span>
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
            <Button asChild variant="ghost" size="icon" aria-label="Text lernen">
              <Link href={`/mitglieder/lernen/${version.showId}`}>
                <SparklesIcon aria-hidden />
              </Link>
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Stift"
            aria-pressed={penMode}
            className={cn(penMode && "bg-primary/15 text-primary")}
            onClick={() => {
              closeBar();
              setPenMode((on) => !on);
            }}
          >
            <PenLineIcon aria-hidden />
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

      <div className="mx-auto max-w-[1240px] lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8 lg:px-4">
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
          onClick={onArticleClick}
          {...pen.handlers}
          className={cn(
            penMode && "cursor-crosshair touch-none select-none",
            "min-w-0 px-3 pb-24 pt-[calc(3.5rem+env(safe-area-inset-top))] leading-normal sm:px-4 lg:px-0",
            fontClass,
          )}
          style={{ ["--speaker-col" as string]: `${(speakerChars * 0.78).toFixed(2)}em` }}
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
                    className="mb-1 mt-8 scroll-mt-14 border-b-2 border-foreground pb-1 text-[0.85em] font-bold uppercase tracking-wider first:mt-2"
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
                  query={trimmed.length >= 2 ? trimmed : ""}
                  activeMatch={index === activeMatch}
                  annotations={
                    settings.showNotes
                      ? (annotationsByBlock.get(block.id) ?? noAnnotations)
                      : noAnnotations
                  }
                  selected={
                    (!selection && selectedBlock === block.id) || pick?.blockId === block.id
                  }
                  ink={
                    settings.showNotes && (inkByBlock.has(block.id) || pen.pending.has(block.id))
                      ? {
                          annotation: inkByBlock.get(block.id) ?? null,
                          pending: pen.pending.get(block.id) ?? noStrokes,
                          erasing: penMode && penSettings.tool === "eraser",
                          erased: pen.erased,
                        }
                      : null
                  }
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
          (nextCue || nextLine || selection || selectedBlock || pick || penMode) &&
            "border-t border-border",
        )}
      >
        <div className="mx-auto flex max-w-[1240px] flex-col divide-y divide-border/60 lg:pl-[calc(15rem+3rem)] lg:pr-4">
          {penMode ? (
            <PenBar
              settings={penSettings}
              onChange={(patch) => setPenSettings((current) => ({ ...current, ...patch }))}
              onUndo={() => void pen.undo()}
              onDone={() => setPenMode(false)}
            />
          ) : pick ? (
            <PickBar
              versionId={version.id}
              annotationId={pick.annotationId}
              blockId={pick.blockId}
              onDone={() => setPick(null)}
            />
          ) : selection || selectedBlock ? (
            <AnnotationBar
              versionId={version.id}
              selection={selection}
              blockId={selectedBlock}
              onNote={() => {
                const blockId = selection?.blockId ?? selectedBlock;
                if (blockId) setEditor({ mode: "create", blockId, selection });
                closeBar();
              }}
              onDone={closeBar}
            />
          ) : null}
          {!penMode && !pick && !selection && !selectedBlock && nextCue ? (
            <NextBar
              label="Nächster Hinweis"
              title={cueParts(blocks[nextCue.index], followed)
                .map((part) => part.text)
                .join(" · ")}
              linesAway={nextCue.linesAway}
              onClick={() => scrollToIndex(nextCue.index)}
            />
          ) : null}
          {!penMode && !pick && !selection && !selectedBlock && nextLine ? (
            <NextBar
              label={`Nächste Passage · ${blocks[nextLine.index].speaker ?? ""}`}
              title={blockText(blocks[nextLine.index])}
              linesAway={nextLine.linesAway}
              onClick={() => scrollToIndex(nextLine.index)}
            />
          ) : null}
        </div>
      </div>

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
        description="Schriftgröße, Regieanweisungen und technische Hinweise einstellen"
      >
        <div className="space-y-5 text-sm">
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
      {pen.liveStroke}
      <AnnotationEditor
        key={editor?.mode === "edit" ? editor.annotation.id : (editor?.blockId ?? "neu")}
        versionId={version.id}
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

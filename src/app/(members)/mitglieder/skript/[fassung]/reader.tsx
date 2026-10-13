"use client";

import * as React from "react";
import Link from "next/link";

import {
  ArrowLeftIcon,
  BookOpenTextIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CloseIcon,
  SearchIcon,
  SettingsIcon,
  UsersIcon,
} from "@/components/ui/action-icons";
import { Badge } from "@/components/ui/badge";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { SCRIPT_CUE_STYLES } from "@/config/category-colors";
import type { ReaderBlock, ScriptReaderData } from "@/lib/skript/reader";
import {
  cueLineIndices,
  cueParts,
  findNextTarget,
  firstVisibleIndex,
  isRoleBlock,
  splitTail,
} from "@/lib/skript/reader-logic";
import type { CueCategory, ScriptPart } from "@/lib/skript/types";
import { cn } from "@/lib/utils";

const SKRIPT_PATH = "/mitglieder/produktionen/stueck?ansicht=skript";

const CUE_STYLE: Record<CueCategory, { label: string; className: string }> = {
  ton: { label: "Ton", className: SCRIPT_CUE_STYLES.ton },
  licht: { label: "Licht", className: SCRIPT_CUE_STYLES.licht },
  nebel: { label: "Nebel", className: SCRIPT_CUE_STYLES.nebel },
  effekt: { label: "Effekt", className: SCRIPT_CUE_STYLES.effekt },
  umbau: { label: "Umbau", className: SCRIPT_CUE_STYLES.umbau },
  aus: { label: "Aus dem Off", className: SCRIPT_CUE_STYLES.aus },
  technik: { label: "Technik", className: SCRIPT_CUE_STYLES.technik },
};

const FONT_SIZES = ["text-base", "text-lg", "text-xl", "text-2xl"] as const;

type Visibility = "show" | "dim" | "hide";

type Settings = {
  fontSize: number;
  directions: Visibility;
  hiddenCues: CueCategory[];
  followedCues: CueCategory[];
  roleIds: string[];
  dimOthers: boolean;
  keepAwake: boolean;
};

const DEFAULT_SETTINGS: Omit<Settings, "roleIds"> = {
  fontSize: 1,
  directions: "show",
  hiddenCues: [],
  followedCues: [],
  dimOthers: false,
  keepAwake: true,
};

/** Einstellungen je Stück im Browser (nur Komfort, E: localStorage nur für Ansicht). */
function readStored<T>(key: string): Partial<T> | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Partial<T>) : null;
  } catch (error) {
    console.warn("Leser-Einstellungen nicht lesbar", error);
    return null;
  }
}

function writeStored(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("Leser-Einstellungen nicht speicherbar", error);
  }
}

function useSettings(showId: string, ownRoleIds: string[]) {
  const key = `skript-leser:${showId}`;
  const [settings, setSettings] = React.useState<Settings>({
    ...DEFAULT_SETTINGS,
    roleIds: ownRoleIds,
  });
  const loaded = React.useRef(false);
  React.useEffect(() => {
    const stored = readStored<Settings>(key);
    if (stored) setSettings((current) => ({ ...current, ...stored }));
    loaded.current = true;
  }, [key]);
  const update = React.useCallback(
    (patch: Partial<Settings>) =>
      setSettings((current) => {
        const next = { ...current, ...patch };
        if (loaded.current) writeStored(key, next);
        return next;
      }),
    [key],
  );
  return [settings, update] as const;
}

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

function CueMark({ part }: { part: Extract<ScriptPart, { kind: "cue" }> }) {
  const style = CUE_STYLE[part.category];
  return (
    <span
      className={cn(
        "mx-0.5 inline rounded border-l-4 px-1.5 py-0.5 text-[0.85em] font-medium not-italic text-foreground [box-decoration-break:clone]",
        style.className,
      )}
    >
      <span className="sr-only">{style.label}: </span>
      {part.text}
    </span>
  );
}

type BlockViewProps = {
  block: ReaderBlock;
  settings: Settings;
  mine: boolean;
  cueLine: boolean;
  query: string;
  activeMatch: boolean;
};

const BlockView = React.memo(
  React.forwardRef<HTMLDivElement, BlockViewProps>(function BlockView(
    { block, settings, mine, cueLine, query, activeMatch },
    ref,
  ) {
    const hiddenCues = new Set(settings.hiddenCues);
    const parts = block.parts.filter((part) => {
      if (part.kind === "cue") return !hiddenCues.has(part.category);
      if (part.kind === "direction") return settings.directions !== "hide";
      return true;
    });
    const lastText = cueLine ? parts.findLastIndex((part) => part.kind === "text") : -1;

    if (block.kind === "direction") {
      const visible =
        parts.length > 0 && (settings.directions !== "hide" || parts.some((p) => p.kind === "cue"));
      return (
        <div
          ref={ref}
          data-block={block.id}
          className={cn(
            "scroll-mt-52 py-1.5 pl-6 italic text-muted-foreground sm:pl-10",
            !visible && "hidden",
            settings.directions === "dim" && "opacity-50",
            activeMatch && "rounded-md ring-2 ring-ring",
          )}
        >
          {parts.map((part, index) =>
            part.kind === "cue" ? (
              <CueMark key={index} part={part} />
            ) : (
              <span key={index}>
                <Highlighted text={part.text} query={query} />{" "}
              </span>
            ),
          )}
        </div>
      );
    }

    const dimmed = settings.dimOthers && settings.roleIds.length > 0 && !mine;
    return (
      <div
        ref={ref}
        data-block={block.id}
        className={cn(
          "scroll-mt-52 rounded-md border-l-4 border-transparent py-2 pl-3 pr-2",
          mine && "border-primary bg-primary/10",
          dimmed && "opacity-45",
          activeMatch && "ring-2 ring-ring",
        )}
      >
        <p
          className={cn(
            "text-[0.75em] font-semibold uppercase tracking-wider",
            mine ? "text-primary" : "text-muted-foreground",
          )}
        >
          {block.speaker ?? "?"}
        </p>
        <p className="break-words">
          {parts.map((part, index) => {
            if (part.kind === "cue") return <CueMark key={index} part={part} />;
            if (part.kind === "direction") {
              return (
                <span
                  key={index}
                  className={cn(
                    "italic text-muted-foreground",
                    settings.directions === "dim" && "opacity-50",
                  )}
                >
                  <Highlighted text={part.text} query={query} />{" "}
                </span>
              );
            }
            if (index === lastText) {
              const [head, tail] = splitTail(part.text);
              return (
                <span key={index}>
                  <Highlighted text={head} query={query} />
                  <span className="font-semibold underline decoration-primary decoration-2 underline-offset-4">
                    <Highlighted text={tail} query={query} />
                  </span>{" "}
                </span>
              );
            }
            return (
              <span key={index}>
                <Highlighted text={part.text} query={query} />{" "}
              </span>
            );
          })}
        </p>
      </div>
    );
  }),
);

type Position = { first: number; last: number };

export function ScriptReader({ data, canManage }: { data: ScriptReaderData; canManage: boolean }) {
  const { version, scenes, blocks, roles } = data;
  const [settings, update] = useSettings(version.showId, data.ownRoleIds);
  useWakeLock(settings.keepAwake);

  const [panel, setPanel] = React.useState<"scenes" | "roles" | "settings" | null>(null);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [matchIndex, setMatchIndex] = React.useState(0);
  const [position, setPosition] = React.useState<Position>({ first: 0, last: 0 });
  const refs = React.useRef<(HTMLDivElement | null)[]>([]);
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
    const onScroll = () => {
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
  const currentScene = scenes.find((scene) => scene.id === blocks[position.first]?.sceneId);
  const fontClass = FONT_SIZES[settings.fontSize] ?? FONT_SIZES[1];

  const toggleCategory = (list: "hiddenCues" | "followedCues", category: CueCategory) => {
    const current = settings[list];
    update({
      [list]: current.includes(category)
        ? current.filter((entry) => entry !== category)
        : [...current, category],
    });
  };

  return (
    <div className="-mt-2">
      <div
        ref={toolbarRef}
        className="sticky top-[calc(var(--members-topbar-offset,0px)+4rem)] z-20 -mx-4 border-b border-border/60 bg-background/95 px-2 backdrop-blur sm:-mx-6 sm:px-4"
      >
        <div className="mx-auto flex h-12 max-w-3xl items-center gap-1">
          <Button asChild variant="ghost" size="icon" aria-label="Zurück zu den Fassungen">
            <Link href={SKRIPT_PATH}>
              <ArrowLeftIcon aria-hidden />
            </Link>
          </Button>
          <button
            type="button"
            onClick={() => setPanel("scenes")}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-1 rounded-md px-2 text-left hover:bg-muted"
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
          <div className="mx-auto flex max-w-3xl items-center gap-1 pb-2">
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

      {version.status === "draft" ? (
        <p className="mx-auto mt-3 max-w-2xl rounded-md border border-warning bg-warning/15 px-3 py-2 text-sm">
          Entwurf – das Ensemble sieht diese Fassung erst nach der Freigabe.
        </p>
      ) : null}

      <article className={cn("mx-auto max-w-2xl space-y-1 pb-16 pt-4 leading-relaxed", fontClass)}>
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
                  className="!mt-8 border-b border-border pb-1 text-[0.8em] font-bold uppercase tracking-wide first:!mt-0"
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
                query={trimmed.length >= 2 ? trimmed : ""}
                activeMatch={index === activeMatch}
              />
            </React.Fragment>
          );
        })}
      </article>

      <div
        ref={barRef}
        className="pointer-events-none sticky bottom-[calc(var(--members-bottom-nav)+0.75rem)] z-20"
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-2">
          {nextCue ? (
            <NextBar
              label="Nächster Hinweis"
              title={cueParts(blocks[nextCue.index], followed)
                .map((part) => part.text)
                .join(" · ")}
              linesAway={nextCue.linesAway}
              onClick={() => scrollToIndex(nextCue.index)}
            />
          ) : null}
          {nextLine ? (
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
        <ul className="divide-y divide-border/60">
          {scenes.map((scene) => (
            <li key={scene.id}>
              <button
                type="button"
                className={cn(
                  "flex min-h-11 w-full items-center gap-3 py-2 text-left text-sm hover:bg-muted",
                  scene.id === currentScene?.id && "font-semibold",
                )}
                onClick={() => {
                  setPanel(null);
                  const index = sceneIndex.get(scene.id);
                  if (index !== undefined) window.setTimeout(() => scrollToIndex(index, false), 50);
                }}
              >
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    roleScenes.has(scene.id) ? "bg-primary" : "bg-transparent",
                  )}
                  aria-label={roleScenes.has(scene.id) ? "Gewählte Rolle spielt mit" : undefined}
                />
                <span className="min-w-0 flex-1 break-words">{scene.title}</span>
                {scene.minutes ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    ca. {scene.minutes} min
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
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
                        "min-w-24 flex-1 rounded border-l-4 px-2 py-0.5 font-medium",
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
            <span>Bildschirm anlassen</span>
            <Switch
              checked={settings.keepAwake}
              onCheckedChange={(keepAwake) => update({ keepAwake })}
              aria-label="Bildschirm anlassen"
            />
          </label>
          {canManage ? (
            <Link
              href={`${SKRIPT_PATH}&fassung=${version.id}`}
              className="inline-flex min-h-11 items-center gap-2 text-primary underline-offset-4 hover:underline"
            >
              <BookOpenTextIcon aria-hidden /> Fassung prüfen und verwalten
            </Link>
          ) : null}
        </div>
      </BottomSheet>
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
      className="pointer-events-auto flex w-full min-w-0 items-center gap-3 rounded-xl border border-border bg-card/95 px-3 py-2 text-left shadow-lg backdrop-blur"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold uppercase tracking-wide text-primary">
          {label}
        </span>
        <span className="block truncate text-sm">{title}</span>
      </span>
      <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
        {linesAway === 0 ? "gleich" : `in ${linesAway} ${linesAway === 1 ? "Replik" : "Repliken"}`}
      </span>
    </button>
  );
}

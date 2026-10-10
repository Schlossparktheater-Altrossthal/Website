"use client";

import { Fragment, useId, useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";

import { AgendaQuickAdd, type QuickAddScene } from "@/components/calendar/agenda/agenda-quick-add";
import { AgendaRow } from "@/components/calendar/agenda/agenda-row";
import { RehearsalSuggestPanel } from "@/components/calendar/agenda/rehearsal-suggest-panel";
import { ReadinessSummary } from "@/components/calendar/scene-readiness-list";
import { PlusIcon, SparklesIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_DURATION,
  computeAgendaTiming,
  computePersonSchedules,
  findParallelConflicts,
  formatDuration,
  itemPeople,
  segmentAgenda,
  summarizeSchedules,
  toMinutes,
  toTime,
  type AgendaItem,
} from "@/lib/calendar/agenda";
import type { AudienceContext } from "@/lib/calendar/audience";
import { optimizeOrder, rankScenes, type SceneCandidate } from "@/lib/calendar/rehearsal-suggest";
import { READINESS_LABEL, type SceneReadiness } from "@/lib/calendar/scene-readiness";
import { HEAVY_WEEK_COUNT, type PersonLoad } from "@/lib/calendar/week-load";
import { DEFAULT_TIME_ZONE } from "@/lib/date-time";
import { cn } from "@/lib/utils";

export type SceneStatsView = Record<
  string,
  { rehearsed: number; lastRehearsedAt: string | null; planned: number }
>;

/** Rückstand je Szene aus dem Szenen-Plan (Probenwochen, nicht feste Tage). */
export type SceneUrgencyView = Record<string, { blocksSince: number; behind: ("long" | "rare")[] }>;

const SHORT_DATE = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  timeZone: DEFAULT_TIME_ZONE,
});

const DAY_LABEL = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "numeric",
  month: "numeric",
  timeZone: DEFAULT_TIME_ZONE,
});

function describeSceneStats(stats: SceneStatsView[string] | undefined) {
  if (!stats || (!stats.rehearsed && !stats.planned)) return "noch nie geprobt";
  const parts = [`${stats.rehearsed}× geprobt`];
  if (stats.lastRehearsedAt)
    parts.push(`zuletzt ${SHORT_DATE.format(new Date(stats.lastRehearsedAt))}`);
  if (stats.planned) parts.push(`${stats.planned}× angesetzt`);
  return parts.join(" · ");
}

function SortableRow(props: Omit<Parameters<typeof AgendaRow>[0], "handle" | "style">) {
  const sortable = useSortable({ id: props.item.id });
  return (
    <AgendaRow
      {...props}
      setNodeRef={sortable.setNodeRef}
      dragging={sortable.isDragging}
      style={{
        transform: CSS.Translate.toString(sortable.transform),
        transition: sortable.transition,
      }}
      handle={{
        attributes: sortable.attributes,
        listeners: sortable.listeners,
        setActivatorNodeRef: sortable.setActivatorNodeRef,
      }}
    />
  );
}

/** Dezentes „+“ zwischen zwei Punkten. */
function InsertLine({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <li aria-hidden={false} className="group relative h-0">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className="absolute left-1/2 top-0 z-10 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hidden opacity-0 shadow-sm transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 sm:flex"
      >
        <PlusIcon className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

/**
 * Ablauf eines Termins: Programmpunkte mit Dauer, Uhrzeiten berechnet ab Beginn. Punkte lassen
 * sich anheften, verschieben, dazwischen einfügen und parallel in Spuren legen.
 */
export function EventAgendaEditor({
  context,
  items,
  onItemsChange,
  startTime,
  endTime,
  onSetEnd,
  mode,
  onModeChange,
  stats,
  urgency,
  readiness,
  invitedIds,
  weekLoad,
  dateKey,
}: {
  context: AudienceContext;
  items: AgendaItem[];
  onItemsChange: (items: AgendaItem[]) => void;
  /** Beginn des Termins (HH:MM). */
  startTime: string;
  /** Ende des Termins (HH:MM) oder leer: dann ergibt es sich aus dem Ablauf. */
  endTime: string;
  onSetEnd: (time: string) => void;
  mode: "TOGETHER" | "STAGGERED";
  onModeChange: (mode: "TOGETHER" | "STAGGERED") => void;
  stats: SceneStatsView;
  urgency: SceneUrgencyView;
  readiness: readonly SceneReadiness[];
  invitedIds: ReadonlySet<string>;
  weekLoad: Record<string, PersonLoad>;
  dateKey: string;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  // Feste ID: sonst weichen die Aria-IDs von dnd-kit zwischen Server und Browser ab.
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const readinessById = useMemo(
    () => new Map(readiness.map((entry) => [entry.sceneId, entry])),
    [readiness],
  );
  const names = useMemo(
    () => new Map(context.members.map((member) => [member.id, member.name])),
    [context.members],
  );
  const timing = useMemo(() => computeAgendaTiming(items, startTime), [items, startTime]);
  const schedules = useMemo(
    () => computePersonSchedules(items, timing, context, invitedIds),
    [items, timing, context, invitedIds],
  );
  const summary = useMemo(() => summarizeSchedules(schedules), [schedules]);
  const conflicts = useMemo(
    () => findParallelConflicts(items, timing, context),
    [items, timing, context],
  );
  const conflictText = (id: string) => {
    const userIds = new Set(
      conflicts.flatMap((entry) => (entry.a === id || entry.b === id ? entry.userIds : [])),
    );
    if (!userIds.size) return null;
    return [...userIds].map((userId) => names.get(userId) ?? "jemand").join(", ");
  };

  const sceneIds = items.flatMap((item) => (item.sceneId ? [item.sceneId] : []));
  const staggered = mode === "STAGGERED";
  const dayLabel = dateKey ? DAY_LABEL.format(new Date(`${dateKey}T12:00:00Z`)) : "diesem Tag";

  const sceneKey = sceneIds.join();
  // Geplante Szenen zählen mit ihrer Dauer im Ablauf, nicht mit der aus dem Stück.
  const durationKey = items
    .flatMap((item) => (item.sceneId ? [`${item.sceneId}=${item.durationMinutes}`] : []))
    .join();
  const candidates = useMemo<SceneCandidate[]>(() => {
    const planned = new Set(sceneKey.split(","));
    const agendaDurations = new Map(
      durationKey
        .split(",")
        .filter(Boolean)
        .map((entry) => {
          const [id, minutes] = entry.split("=");
          return [id ?? "", Number(minutes)] as const;
        }),
    );
    /** Wer aus der Besetzung diese Woche (mit diesem Termin) schon oft da ist. */
    const heavy = (userId: string) => (weekLoad[userId]?.count ?? 0) + 1 >= HEAVY_WEEK_COUNT;
    return context.scenes.map((scene) => {
      const entry = readinessById.get(scene.id);
      const primary = context.castings.filter(
        (casting) => casting.type === "primary" && scene.characterIds.includes(casting.characterId),
      );
      const people = [...new Set(primary.map((casting) => casting.userId))];
      return {
        sceneId: scene.id,
        label: scene.label,
        durationMinutes:
          agendaDurations.get(scene.id) ??
          (scene.durationMinutes && scene.durationMinutes > 0
            ? scene.durationMinutes
            : DEFAULT_DURATION),
        readiness: entry?.status ?? "ready",
        people,
        done: stats[scene.id]?.rehearsed ?? 0,
        // Der aktuelle Termin zählt nicht als „schon angesetzt“.
        planned: Math.max(0, (stats[scene.id]?.planned ?? 0) - (planned.has(scene.id) ? 1 : 0)),
        blocksSince: urgency[scene.id]?.blocksSince ?? 0,
        behind: urgency[scene.id]?.behind ?? [],
        heavyPeople: people.filter(heavy).length,
      };
    });
  }, [context, readinessById, stats, urgency, weekLoad, sceneKey, durationKey]);

  const quickScenes = useMemo<QuickAddScene[]>(() => {
    const ranked = rankScenes(candidates);
    const order = new Map(ranked.map((entry, index) => [entry.sceneId, index]));
    return candidates
      .filter((entry) => !sceneIds.includes(entry.sceneId))
      .sort(
        (a, b) =>
          (order.get(a.sceneId) ?? Number.MAX_SAFE_INTEGER) -
          (order.get(b.sceneId) ?? Number.MAX_SAFE_INTEGER),
      )
      .map((entry) => ({
        id: entry.sceneId,
        label: entry.label,
        durationMinutes: entry.durationMinutes,
        status: readinessById.get(entry.sceneId)?.status ?? null,
        hint: [
          readinessById.get(entry.sceneId)
            ? READINESS_LABEL[readinessById.get(entry.sceneId)!.status]
            : null,
          describeSceneStats(stats[entry.sceneId]),
          formatDuration(entry.durationMinutes),
        ]
          .filter(Boolean)
          .join(" · "),
      }));
  }, [candidates, sceneIds, readinessById, stats]);

  const update = (id: string, patch: Partial<AgendaItem>) =>
    onItemsChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  const remove = (id: string) => {
    onItemsChange(items.filter((item) => item.id !== id));
    if (expanded === id) setExpanded(null);
  };
  const move = (id: string, offset: -1 | 1) => {
    const index = items.findIndex((item) => item.id === id);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= items.length) return;
    onItemsChange(arrayMove(items, index, target));
  };
  const insert = (item: AgendaItem, index: number) => {
    if (items.some((entry) => entry.id === item.id)) return;
    // Hinter einem parallelen Punkt landet der neue in derselben Spur.
    const before = items[index - 1];
    const track = !item.forEveryone && before && !before.forEveryone ? before.track : 0;
    const next = [...items];
    next.splice(index, 0, { ...item, track });
    onItemsChange(next);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((item) => item.id === active.id);
    const to = items.findIndex((item) => item.id === over.id);
    if (from < 0 || to < 0) return;
    onItemsChange(arrayMove(items, from, to));
  };

  /** Hauptspur je Abschnitt so sortieren, dass möglichst wenig gewartet wird. */
  const optimize = () => {
    const before = summary.totalWait;
    const next = [...items];
    let index = 0;
    for (const segment of segmentAgenda(items)) {
      if (segment.kind === "shared") {
        index += 1;
        continue;
      }
      const size = segment.tracks.reduce((sum, track) => sum + track.items.length, 0);
      const slice = next.slice(index, index + size);
      const movable = slice.filter((item) => item.track === 0 && !item.fixedStart);
      const ordered = optimizeOrder(
        movable.map((item) => ({
          ...item,
          people: itemPeople(item, context).filter((id) => invitedIds.has(id)),
        })),
      );
      let cursor = 0;
      for (let offset = 0; offset < slice.length; offset += 1) {
        const item = slice[offset];
        if (item && item.track === 0 && !item.fixedStart) {
          const replacement = movable.find((entry) => entry.id === ordered[cursor]?.id);
          cursor += 1;
          if (replacement) next[index + offset] = replacement;
        }
      }
      index += size;
    }
    const after = summarizeSchedules(
      computePersonSchedules(next, computeAgendaTiming(next, startTime), context, invitedIds),
    ).totalWait;
    if (after >= before) {
      toast.info("Die Reihenfolge ist schon günstig.");
      return;
    }
    const previous = items;
    onItemsChange(next);
    toast.success(`Wartezeit gesamt ${formatDuration(before)} → ${formatDuration(after)}`, {
      action: { label: "Rückgängig", onClick: () => onItemsChange(previous) },
    });
  };

  /** Szenen aus dem Vorschlag übernehmen: an die Stelle der bisherigen Szenen der Hauptspur. */
  const applySuggestion = (ordered: string[]) => {
    const existing = new Map(
      items.flatMap((item) => (item.sceneId ? [[item.sceneId, item] as const] : [])),
    );
    const movable = (item: AgendaItem) =>
      item.type === "SCENE" &&
      ((item.track === 0 && !item.fixedStart) || ordered.includes(item.sceneId ?? ""));
    const firstScene = items.findIndex(movable);
    const rest = items.filter((item) => !movable(item));
    let position: number;
    if (firstScene >= 0) {
      position = items.slice(0, firstScene).filter((item) => !movable(item)).length;
    } else {
      // Nach führenden Punkten „für alle“ (Aufwärmen); bestehen alle daraus, nach dem ersten.
      position = 0;
      while (rest[position]?.forEveryone) position += 1;
      if (position === rest.length && position > 1) position = 1;
    }
    const sceneItems: AgendaItem[] = ordered.map(
      (sceneId) =>
        existing.get(sceneId) ?? {
          id: `scene:${sceneId}`,
          type: "SCENE",
          sceneId,
          departmentId: null,
          title: "",
          location: "",
          description: "",
          durationMinutes:
            candidates.find((entry) => entry.sceneId === sceneId)?.durationMinutes ??
            DEFAULT_DURATION,
          fixedStart: "",
          track: 0,
          forEveryone: false,
          timesChanged: true,
        },
    );
    const next = [...rest];
    next.splice(position, 0, ...sceneItems);
    onItemsChange(next);
    setSuggestOpen(false);
  };

  const otherMinutes = items
    .filter((item) => item.type !== "SCENE" && item.track === 0)
    .reduce((sum, item) => sum + item.durationMinutes, 0);
  const eventMinutes = endTime
    ? (toMinutes(endTime) - toMinutes(startTime) + 1440) % 1440 || 1440
    : 180;
  const defaultBudget = Math.max(30, Math.round((eventMinutes - otherMinutes) / 15) * 15);

  const trackNames = useMemo(() => {
    const result: string[] = [];
    for (const item of items) {
      if (!item.forEveryone && item.location.trim() && !result[item.track])
        result[item.track] = item.location.trim();
    }
    return result;
  }, [items]);

  const overEnd = endTime ? timing.end - (toMinutes(startTime) + eventMinutes) : 0;

  const labelOf = (item: AgendaItem) => {
    if (item.type === "SCENE")
      return context.scenes.find((scene) => scene.id === item.sceneId)?.label ?? "Szene";
    if (item.type === "DEPARTMENT") {
      const name = context.departments.find((entry) => entry.id === item.departmentId)?.name;
      return item.title || `Gewerk ${name ?? ""}`.trim();
    }
    return item.title || "Programmpunkt";
  };
  const subtitleOf = (item: AgendaItem) => {
    const room = item.location.trim() ? ` · ${item.location.trim()}` : "";
    if (item.type === "SCENE" && item.sceneId) {
      const entry = readinessById.get(item.sceneId);
      const status = entry && entry.status !== "ready" ? `${READINESS_LABEL[entry.status]} · ` : "";
      return `${status}${describeSceneStats(stats[item.sceneId])}${room}`;
    }
    if (item.type === "DEPARTMENT") {
      const name = context.departments.find((entry) => entry.id === item.departmentId)?.name;
      return `${item.title ? `Gewerk ${name} · ` : ""}Details plant die Gewerk-Leitung`;
    }
    return `${item.forEveryone ? "für alle" : "Sonstiges"}${room}`;
  };

  const rowProps = (item: AgendaItem) => ({
    item,
    label: labelOf(item),
    subtitle: subtitleOf(item),
    timing: timing.times[item.id],
    overlap: timing.overlaps[item.id],
    conflict: conflictText(item.id),
    expanded: expanded === item.id,
    onToggle: () => setExpanded((current) => (current === item.id ? null : item.id)),
    onChange: (patch: Partial<AgendaItem>) => update(item.id, patch),
    onRemove: () => remove(item.id),
    onMove: (offset: -1 | 1) => move(item.id, offset),
    onInsertAfter: () => {
      setExpanded(null);
      setInsertAt(items.indexOf(item) + 1);
    },
    trackNames,
  });

  /** Aufwärmen/Einsingen gehören an den Anfang, hinter schon vorhandene Eröffnungspunkte. */
  const opensRehearsal = (entry: AgendaItem) =>
    entry.forEveryone && /^(aufwärmen|einsingen)/i.test(entry.title);
  const leadingShared = () => {
    let index = 0;
    while (items[index] && opensRehearsal(items[index] as AgendaItem)) index += 1;
    return index;
  };

  const inlineAdd = (index: number) => (
    <li className="p-2">
      <AgendaQuickAdd
        context={context}
        scenes={quickScenes}
        autoFocus
        onAdd={(entry) => {
          insert(entry, index);
          setInsertAt(index + 1);
        }}
        onClose={() => setInsertAt(null)}
      />
    </li>
  );

  const renderRow = (item: AgendaItem) => {
    const index = items.indexOf(item);
    const gap = timing.gaps[item.id];
    return (
      <Fragment key={item.id}>
        {insertAt === index ? (
          inlineAdd(index)
        ) : index > 0 ? (
          <InsertLine label={`Vor ${labelOf(item)} einfügen`} onClick={() => setInsertAt(index)} />
        ) : null}
        {gap ? (
          <li className="px-3 py-1 text-xs text-muted-foreground">{formatDuration(gap)} frei</li>
        ) : null}
        <SortableRow {...rowProps(item)} />
      </Fragment>
    );
  };

  const segments = segmentAgenda(items);

  return (
    <div className="space-y-3">
      {context.scenes.length ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setSuggestOpen(true)}>
            <SparklesIcon className="h-4 w-4" aria-hidden />
            Probe vorschlagen
          </Button>
          {readiness.length ? (
            <span className="text-xs text-muted-foreground">
              Am {dayLabel} probbar: <ReadinessSummary entries={readiness} />
            </span>
          ) : null}
        </div>
      ) : null}

      {items.length ? (
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={items.map((item) => item.id)} strategy={rectSortingStrategy}>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {segments.map((segment) => {
                if (segment.kind === "shared") return renderRow(segment.item);
                if (segment.tracks.length === 1) return segment.tracks[0]?.items.map(renderRow);
                const key = segment.tracks.map((track) => track.items[0]?.id).join();
                return (
                  <li key={key} className="bg-muted/40 p-2">
                    <p className="px-1 pb-1.5 text-xs font-medium text-muted-foreground">
                      Parallel
                    </p>
                    <div
                      className={cn(
                        "grid gap-2",
                        segment.tracks.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3",
                      )}
                    >
                      {segment.tracks.map((track) => (
                        <div key={track.track} className="min-w-0">
                          <p className="px-1 pb-1 text-xs text-muted-foreground">
                            {trackNames[track.track] ??
                              (track.track === 0 ? "Hauptspur" : `Parallel ${track.track}`)}
                          </p>
                          <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
                            {track.items.map((item) => (
                              <Fragment key={item.id}>
                                {insertAt === items.indexOf(item) && items.indexOf(item) > 0
                                  ? inlineAdd(items.indexOf(item))
                                  : null}
                                <SortableRow {...rowProps(item)} />
                              </Fragment>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          </SortableContext>
        </DndContext>
      ) : (
        <p className="text-sm text-muted-foreground">
          Noch kein Ablauf. Punkte bekommen eine Dauer, die Uhrzeiten ergeben sich ab Beginn.
        </p>
      )}

      <AgendaQuickAdd
        context={context}
        scenes={quickScenes}
        autoFocus={insertAt === items.length}
        onClose={() => setInsertAt(null)}
        onAdd={(entry) => insert(entry, opensRehearsal(entry) ? leadingShared() : items.length)}
      />

      {items.length ? (
        <div className="space-y-2 text-sm">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>
              Ende geplant <span className="font-semibold tabular-nums">{toTime(timing.end)}</span>
            </span>
            {overEnd > 0 ? (
              <>
                <span className="text-warning">· {formatDuration(overEnd)} über Terminende</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => onSetEnd(toTime(timing.end))}
                >
                  Ende auf {toTime(timing.end)} setzen
                </Button>
              </>
            ) : overEnd < 0 ? (
              <span className="text-muted-foreground">
                · {formatDuration(-overEnd)} Puffer bis {endTime}
              </span>
            ) : !endTime ? (
              <span className="text-muted-foreground">· gilt als Terminende</span>
            ) : null}
          </p>

          {summary.people ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-muted px-3 py-2 text-xs">
              <span>
                <span className="font-semibold">{summary.people}</span>{" "}
                {summary.people === 1 ? "Person" : "Leute"} in Punkten
              </span>
              <span>
                Ø Auslastung{" "}
                <span className="font-semibold">{Math.round(summary.utilization * 100)} %</span>
              </span>
              {summary.longestWait ? (
                <span>
                  längste Wartezeit: {names.get(summary.longestWait.userId) ?? "jemand"}{" "}
                  <span className="font-semibold">
                    {formatDuration(summary.longestWait.minutes)}
                  </span>
                </span>
              ) : (
                <span>keine Wartezeiten</span>
              )}
              {summary.totalWait > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="ml-auto"
                  onClick={optimize}
                >
                  Reihenfolge optimieren
                </Button>
              ) : null}
            </div>
          ) : null}

          <label className="flex min-h-10 items-center gap-2">
            <Switch
              checked={staggered}
              onCheckedChange={(value) => onModeChange(value ? "STAGGERED" : "TOGETHER")}
            />
            <span>
              Jeder kommt erst zu seinem ersten Punkt
              <span className="block text-xs text-muted-foreground">
                Punkte „für alle“ zählen für jeden; wer in keinem Punkt steckt, kommt zum Beginn.
              </span>
            </span>
          </label>

          {staggered && schedules.length ? (
            <details className="rounded-lg bg-muted px-3 py-2">
              <summary className="cursor-pointer font-medium">
                Wer kommt wann? ({schedules.length})
              </summary>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {[...schedules]
                  .sort(
                    (a, b) =>
                      a.window.start - b.window.start ||
                      (names.get(a.userId) ?? "").localeCompare(names.get(b.userId) ?? "", "de"),
                  )
                  .map((entry) => (
                    <li key={entry.userId}>
                      <span className="font-medium text-foreground">
                        {names.get(entry.userId) ?? "Unbekannt"}:
                      </span>{" "}
                      {toTime(entry.window.start)}–{toTime(entry.window.end)}
                      {entry.wait ? ` · ${formatDuration(entry.wait)} Wartezeit` : ""}
                      {weekLoad[entry.userId]?.count
                        ? ` · diese Woche schon ${weekLoad[entry.userId]?.count}×`
                        : ""}
                    </li>
                  ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}

      {suggestOpen ? (
        <RehearsalSuggestPanel
          open
          onOpenChange={setSuggestOpen}
          candidates={candidates}
          existingSceneIds={sceneIds}
          defaultBudget={defaultBudget}
          names={names}
          onApply={applySuggestion}
        />
      ) : null}
    </div>
  );
}

"use client";

import type { CSSProperties, ReactNode } from "react";
import type { DraggableAttributes, DraggableSyntheticListeners } from "@dnd-kit/core";

import {
  AlertTriangleIcon,
  ChevronDownIcon,
  GripVerticalIcon,
  MinusIcon,
  PlusIcon,
  TrashIcon,
  UsersIcon,
} from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { TimeInput } from "@/components/ui/time-input";
import {
  DURATION_STEPS,
  MAX_TRACKS,
  formatDuration,
  toTime,
  type AgendaItem,
  type ItemTiming,
} from "@/lib/calendar/agenda";
import { cn } from "@/lib/utils";

/** Farbstreifen links: Szene, Gewerk, Sonstiges, für alle. */
const STRIPE = {
  SCENE: "bg-info",
  DEPARTMENT: "bg-primary",
  CUSTOM: "bg-muted-foreground/50",
  everyone: "bg-success",
} as const;

export type DragHandle = {
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  setActivatorNodeRef: (element: HTMLElement | null) => void;
};

/** Eine Zeile im Ablauf: Uhrzeit · Titel · Dauer; Antippen klappt die Details auf. */
export function AgendaRow({
  item,
  label,
  subtitle,
  timing,
  overlap,
  conflict,
  expanded,
  onToggle,
  onChange,
  onRemove,
  onMove,
  onInsertAfter,
  handle,
  style,
  setNodeRef,
  dragging,
  trackNames,
}: {
  item: AgendaItem;
  label: string;
  subtitle: ReactNode;
  timing: ItemTiming | undefined;
  /** Angeheftete Uhrzeit liegt vor dem Ende des vorherigen Punkts. */
  overlap?: number;
  /** Personen, die gleichzeitig woanders eingeplant sind. */
  conflict?: string | null;
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<AgendaItem>) => void;
  onRemove: () => void;
  onMove: (offset: -1 | 1) => void;
  /** Schnellanlage direkt hinter diesem Punkt öffnen. */
  onInsertAfter?: () => void;
  handle?: DragHandle;
  style?: CSSProperties;
  setNodeRef?: (element: HTMLElement | null) => void;
  dragging?: boolean;
  trackNames: string[];
}) {
  const stripe = item.forEveryone ? STRIPE.everyone : STRIPE[item.type];
  const isScene = item.type === "SCENE";
  const isDepartment = item.type === "DEPARTMENT";
  const startLabel = timing ? toTime(timing.start) : "–";

  const setDuration = (minutes: number) =>
    onChange({ durationMinutes: Math.max(5, Math.min(720, minutes)), timesChanged: true });

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-card",
        dragging && "relative z-20 rounded-md shadow-lg ring-1 ring-primary/40",
      )}
    >
      <div
        className="flex min-h-12 items-stretch gap-2 py-1.5 pl-1 pr-1"
        onKeyDown={(event) => {
          if (!event.altKey) return;
          if (event.key === "ArrowUp") {
            event.preventDefault();
            onMove(-1);
          } else if (event.key === "ArrowDown") {
            event.preventDefault();
            onMove(1);
          }
        }}
      >
        {handle ? (
          <button
            type="button"
            ref={handle.setActivatorNodeRef}
            {...handle.attributes}
            {...handle.listeners}
            aria-label={`${label} verschieben`}
            className="flex w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-sm text-muted-foreground hover:text-foreground active:cursor-grabbing"
          >
            <GripVerticalIcon className="h-4 w-4" />
          </button>
        ) : null}
        <span
          className={cn(
            "w-10 shrink-0 self-center text-sm tabular-nums sm:w-11",
            item.fixedStart ? "font-semibold text-foreground" : "text-muted-foreground",
          )}
          title={item.fixedStart ? "Uhrzeit angeheftet" : "berechnet aus der Reihenfolge"}
        >
          {startLabel}
          {item.fixedStart ? <span className="sr-only"> (angeheftet)</span> : null}
        </span>
        <span aria-hidden className={cn("w-1 shrink-0 rounded-full", stripe)} />
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="min-w-0 flex-1 rounded-sm text-left"
        >
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{label}</span>
            {item.forEveryone ? (
              <UsersIcon className="h-3.5 w-3.5 shrink-0 text-success" aria-label="für alle" />
            ) : null}
            {item.fixedStart ? (
              <span className="shrink-0 rounded-full bg-muted px-1.5 text-[11px] text-foreground/80">
                fest
              </span>
            ) : null}
          </span>
          <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
          {overlap ? (
            <span className="flex items-center gap-1 text-xs text-warning">
              <AlertTriangleIcon className="h-3 w-3" /> {formatDuration(overlap)} zu knapp
            </span>
          ) : null}
          {conflict ? (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <AlertTriangleIcon className="h-3 w-3" /> gleichzeitig woanders: {conflict}
            </span>
          ) : null}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="subtle"
              size="xs"
              className="h-8 shrink-0 self-center px-2 tabular-nums"
              aria-label={`Dauer ${label}: ${formatDuration(item.durationMinutes)}`}
            >
              {formatDuration(item.durationMinutes)}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-28">
            {DURATION_STEPS.map((minutes) => (
              <DropdownMenuItem
                key={minutes}
                onSelect={() => setDuration(minutes)}
                className={cn(minutes === item.durationMinutes && "font-semibold")}
              >
                {formatDuration(minutes)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="hidden h-9 w-8 shrink-0 self-center sm:inline-flex"
          aria-label={expanded ? `Details ${label} schließen` : `Details ${label}`}
          onClick={onToggle}
        >
          <ChevronDownIcon
            className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")}
          />
        </Button>
      </div>

      {expanded ? (
        <div className="mb-2 ml-3 mr-2 grid gap-3 rounded-md bg-muted p-3 sm:grid-cols-2">
          {!isScene ? (
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor={`title-${item.id}`} className="text-xs text-muted-foreground">
                {isDepartment ? "Was steht an?" : "Titel"}
              </Label>
              <Input
                id={`title-${item.id}`}
                value={item.title}
                maxLength={120}
                placeholder={isDepartment ? "z. B. Podeste bauen" : "z. B. Einsingen"}
                onChange={(event) => onChange({ title: event.target.value })}
                className="h-10"
              />
            </div>
          ) : null}

          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Dauer</span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10"
                aria-label="5 Minuten kürzer"
                onClick={() => setDuration(item.durationMinutes - 5)}
              >
                <MinusIcon className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                inputMode="numeric"
                min={5}
                max={720}
                step={5}
                value={item.durationMinutes}
                aria-label={`Dauer ${label} in Minuten`}
                onChange={(event) => setDuration(Number(event.target.value) || 5)}
                className="h-10 w-20 text-center tabular-nums"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10"
                aria-label="5 Minuten länger"
                onClick={() => setDuration(item.durationMinutes + 5)}
              >
                <PlusIcon className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">min</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch
                checked={Boolean(item.fixedStart)}
                onCheckedChange={(value) =>
                  onChange({
                    fixedStart: value ? (timing ? toTime(timing.start) : "18:00") : "",
                    timesChanged: true,
                  })
                }
                aria-label="Uhrzeit anheften"
              />
              Fest um
            </label>
            {item.fixedStart ? (
              <TimeInput
                value={item.fixedStart}
                aria-label={`Feste Uhrzeit ${label}`}
                onChange={(event) =>
                  event.target.value &&
                  onChange({ fixedStart: event.target.value, timesChanged: true })
                }
                className="h-10"
              />
            ) : (
              <p className="text-xs text-muted-foreground">Folgt auf den vorherigen Punkt.</p>
            )}
          </div>

          {item.type === "CUSTOM" ? (
            <label className="flex min-h-10 items-center gap-2 text-sm sm:col-span-2">
              <Switch
                checked={item.forEveryone}
                onCheckedChange={(value) => onChange({ forEveryone: value, track: 0 })}
              />
              <span>
                Für alle
                <span className="block text-xs text-muted-foreground">
                  Alle Eingeladenen sind dabei; wartet auf parallele Punkte.
                </span>
              </span>
            </label>
          ) : null}

          {!item.forEveryone ? (
            <div className="space-y-1 sm:col-span-2">
              <span className="text-xs text-muted-foreground">Läuft</span>
              <SegmentedControl
                aria-label={`Spur ${label}`}
                fullWidth
                value={String(item.track)}
                onValueChange={(value) => onChange({ track: Number(value), timesChanged: true })}
                options={Array.from({ length: MAX_TRACKS }, (_, track) => ({
                  value: String(track),
                  label: trackNames[track] ?? (track === 0 ? "Hauptspur" : `Parallel ${track}`),
                }))}
              />
            </div>
          ) : null}

          {!isDepartment ? (
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor={`room-${item.id}`} className="text-xs text-muted-foreground">
                Raum (optional)
              </Label>
              <Input
                id={`room-${item.id}`}
                value={item.location}
                maxLength={120}
                placeholder="z. B. Bühne, Saal"
                onChange={(event) => onChange({ location: event.target.value })}
                className="h-10"
              />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Raum und Details plant die Gewerk-Leitung.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            {onInsertAfter ? (
              <Button type="button" variant="outline" size="sm" onClick={onInsertAfter}>
                <PlusIcon className="h-4 w-4" /> Danach einfügen
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={() => onMove(-1)}>
              Nach oben
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onMove(1)}>
              Nach unten
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto text-destructive hover:text-destructive"
              onClick={onRemove}
            >
              <TrashIcon className="h-4 w-4" /> Entfernen
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

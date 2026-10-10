"use client";

import { useState, type ReactNode } from "react";
import type { CalendarEventKind } from "@prisma/client";

import {
  CalendarIcon,
  ChevronDownIcon,
  CloseIcon,
  MapPinIcon,
  PlusIcon,
  TheaterIcon,
} from "@/components/ui/action-icons";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TimeInput } from "@/components/ui/time-input";
import { CALENDAR_EVENT_KIND_LABELS } from "@/lib/calendar/event-kinds";
import { DEFAULT_TIME_ZONE } from "@/lib/date-time";
import { cn } from "@/lib/utils";

const DATE_LABEL = new Intl.DateTimeFormat("de-DE", {
  weekday: "short",
  day: "numeric",
  month: "numeric",
  year: "2-digit",
  timeZone: DEFAULT_TIME_ZONE,
});

function formatDay(dateKey: string) {
  return dateKey ? DATE_LABEL.format(new Date(`${dateKey}T12:00:00Z`)) : "Datum offen";
}

const CHIP =
  "inline-flex h-9 max-w-full items-center gap-1.5 rounded-full border border-border bg-background px-3 text-sm text-foreground transition-colors hover:border-primary/50 disabled:opacity-60";

function Chip({
  icon,
  children,
  muted,
  onClick,
  disabled,
  title,
  label,
}: {
  icon?: ReactNode;
  children: ReactNode;
  muted?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      className={cn(CHIP, muted && "text-muted-foreground")}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={label}
    >
      {icon}
      <span className="truncate">{children}</span>
    </button>
  );
}

export type EventHeaderValue = {
  title: string;
  kind: CalendarEventKind;
  date: string;
  allDay: boolean;
  multiDay: boolean;
  endDate: string;
  time: string;
  endTime: string;
  location: string;
  scope: "production" | "all";
};

/**
 * Kopf des Termineditors: Titel und eine Zeile antippbarer Angaben (Art, Wann, Ort, Produktion).
 * Details öffnen ein Blatt – mobil von unten, am Desktop als Dialog.
 */
export function EventEditorHeader({
  value,
  onChange,
  kindOptions,
  kindLocked,
  production,
  onScopeChange,
  isRehearsal,
  plannedEnd,
  showDescription,
  onShowDescription,
  status,
}: {
  value: EventHeaderValue;
  onChange: (patch: Partial<EventHeaderValue>) => void;
  kindOptions: CalendarEventKind[];
  kindLocked: boolean;
  production: { id: string; title: string } | null;
  onScopeChange: (scope: "production" | "all") => void;
  isRehearsal: boolean;
  /** Ende aus dem Ablauf (HH:MM), wenn kein festes Ende gesetzt ist. */
  plannedEnd: string | null;
  showDescription: boolean;
  onShowDescription: () => void;
  /** Statuszeile unter den Angaben (wer kommt, wer fehlt). */
  status: ReactNode;
}) {
  const [sheet, setSheet] = useState<"when" | "where" | null>(null);
  const end = value.endTime || plannedEnd;
  const whenLabel = value.allDay
    ? `${formatDay(value.date)}${value.multiDay && value.endDate > value.date ? ` – ${formatDay(value.endDate)}` : ""} · ganztägig`
    : `${formatDay(value.date)}${value.multiDay && value.endDate > value.date ? ` – ${formatDay(value.endDate)}` : ""} · ${value.time}${end ? `–${end}` : ""}`;

  return (
    <div className="space-y-3">
      <Input
        id="event-title"
        value={value.title}
        onChange={(event) => onChange({ title: event.target.value })}
        minLength={3}
        maxLength={120}
        required
        placeholder={`Titel ${isRehearsal ? "der Probe" : "des Termins"}`}
        aria-label="Titel"
        className="h-11 border-transparent bg-transparent px-2 text-lg font-semibold shadow-none hover:border-border focus-visible:border-border sm:text-xl"
      />

      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={kindLocked}>
            <button
              type="button"
              className={CHIP}
              title={kindLocked ? "Mit Szenen ist es immer eine Probe." : undefined}
              aria-label={`Art: ${CALENDAR_EVENT_KIND_LABELS[value.kind]}`}
            >
              {CALENDAR_EVENT_KIND_LABELS[value.kind]}
              {kindLocked ? null : <ChevronDownIcon className="h-3.5 w-3.5 opacity-60" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {kindOptions.map((kind) => (
              <DropdownMenuItem key={kind} onSelect={() => onChange({ kind })}>
                {CALENDAR_EVENT_KIND_LABELS[kind]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Chip
          icon={<CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />}
          onClick={() => setSheet("when")}
          label={`Wann: ${whenLabel}`}
        >
          <span className="tabular-nums">{whenLabel}</span>
          {!value.allDay && !value.endTime && plannedEnd ? (
            <span className="text-muted-foreground"> (Ablauf)</span>
          ) : null}
        </Chip>

        <Chip
          icon={<MapPinIcon className="h-4 w-4 shrink-0 text-muted-foreground" />}
          muted={!value.location}
          onClick={() => setSheet("where")}
          label={`Ort: ${value.location || "offen"}`}
        >
          {value.location || "Ort offen"}
        </Chip>

        {production ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(CHIP, value.scope === "all" && "text-muted-foreground")}
                aria-label={`Gehört zu: ${value.scope === "production" ? production.title : "keiner Produktion"}`}
              >
                <TheaterIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">
                  {value.scope === "production" ? production.title : "Keine Produktion"}
                </span>
                <ChevronDownIcon className="h-3.5 w-3.5 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={() => onScopeChange("production")}>
                Gehört zu {production.title}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onScopeChange("all")}>
                Keiner Produktion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        {!showDescription ? (
          <Chip muted icon={<PlusIcon className="h-4 w-4 shrink-0" />} onClick={onShowDescription}>
            Beschreibung
          </Chip>
        ) : null}
      </div>

      {status ? <div className="text-xs text-muted-foreground">{status}</div> : null}

      <BottomSheet
        open={sheet === "when"}
        onOpenChange={(open) => setSheet(open ? "when" : null)}
        title="Wann?"
        description="Datum und Uhrzeit des Termins"
        footer={
          <Button type="button" className="w-full sm:w-auto" onClick={() => setSheet(null)}>
            Fertig
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1 sm:col-span-1">
              <Label htmlFor="event-date" className="text-xs text-muted-foreground">
                {value.multiDay ? "Von" : "Datum"}
              </Label>
              <DateInput
                id="event-date"
                value={value.date}
                onChange={(event) => {
                  const next = event.target.value;
                  onChange({
                    date: next,
                    ...(value.endDate && value.endDate < next ? { endDate: next } : {}),
                  });
                }}
                required
              />
            </div>
            {value.multiDay ? (
              <div className="col-span-2 space-y-1 sm:col-span-1">
                <Label htmlFor="event-end-date" className="text-xs text-muted-foreground">
                  Bis
                </Label>
                <DateInput
                  id="event-end-date"
                  value={value.endDate}
                  min={value.date}
                  onChange={(event) => onChange({ endDate: event.target.value })}
                />
              </div>
            ) : null}
            {!value.allDay ? (
              <>
                <div className="space-y-1">
                  <Label htmlFor="event-time" className="text-xs text-muted-foreground">
                    Beginn
                  </Label>
                  <TimeInput
                    id="event-time"
                    value={value.time}
                    onChange={(event) => onChange({ time: event.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="event-end" className="text-xs text-muted-foreground">
                    Ende
                  </Label>
                  <div className="flex items-center gap-1">
                    <TimeInput
                      id="event-end"
                      value={value.endTime}
                      onChange={(event) => onChange({ endTime: event.target.value })}
                    />
                    {value.endTime ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 shrink-0"
                        aria-label="Ende entfernen"
                        onClick={() => onChange({ endTime: "" })}
                      >
                        <CloseIcon className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {value.endTime
                      ? "Festes Ende."
                      : plannedEnd
                        ? `Leer: Ende aus dem Ablauf (${plannedEnd}).`
                        : "Leer: Ende ergibt sich aus dem Ablauf."}
                  </p>
                </div>
              </>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            <label className="flex min-h-10 items-center gap-2">
              <Switch checked={value.allDay} onCheckedChange={(allDay) => onChange({ allDay })} />
              Ganztägig
            </label>
            <label className="flex min-h-10 items-center gap-2">
              <Switch
                checked={value.multiDay}
                onCheckedChange={(multiDay) =>
                  onChange({
                    multiDay,
                    ...(multiDay && !value.endDate ? { endDate: value.date } : {}),
                  })
                }
              />
              Mehrtägig
            </label>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet
        open={sheet === "where"}
        onOpenChange={(open) => setSheet(open ? "where" : null)}
        title="Wo?"
        description="Ort des Termins"
        footer={
          <Button type="button" className="w-full sm:w-auto" onClick={() => setSheet(null)}>
            Fertig
          </Button>
        }
      >
        <div className="space-y-2">
          <Input
            id="event-location"
            value={value.location}
            autoFocus
            onChange={(event) => onChange({ location: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter") setSheet(null);
            }}
            placeholder={isRehearsal ? "z. B. Scheune, Bühne" : "Ort (optional)"}
            aria-label="Ort"
            className="h-10"
          />
          <p className="text-xs text-muted-foreground">
            {isRehearsal ? "Leer lassen, wenn noch offen." : "Optional."}
          </p>
        </div>
      </BottomSheet>
    </div>
  );
}

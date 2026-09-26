"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { EventResponseStatus } from "@prisma/client";
import { toast } from "sonner";

import {
  AlertTriangleIcon,
  CalendarPlusIcon,
  ChevronDownIcon,
  MapPinIcon,
  PencilIcon,
  TrashIcon,
} from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DateBadge } from "@/components/ui/date-badge";
import type { EventBlock, TeamEvent, TeamEventsData } from "@/lib/departments/events";
import { cn } from "@/lib/utils";

import { ResponsivePanel } from "../board/panel";
import type { ActionResult } from "../board/shared";
import {
  deleteTeamEventAction,
  respondTeamEventAction,
  saveTeamEventAction,
} from "../event-actions";

const RESPONSES: { value: EventResponseStatus; label: string; active: string }[] = [
  { value: "yes", label: "Dabei", active: "border-success bg-success/15 text-success" },
  { value: "maybe", label: "Vielleicht", active: "border-warning bg-warning/20 text-foreground" },
  {
    value: "no",
    label: "Nicht dabei",
    active: "border-destructive bg-destructive/10 text-destructive",
  },
];

const RESPONSE_GROUPS: { value: EventResponseStatus; label: string }[] = [
  { value: "yes", label: "Dabei" },
  { value: "maybe", label: "Vielleicht" },
  { value: "no", label: "Nicht dabei" },
];

const MONTH = new Intl.DateTimeFormat("de-DE", {
  month: "long",
  year: "numeric",
  timeZone: "Europe/Berlin",
});
const LONG_DAY = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Berlin",
});

const inputClass =
  "h-11 w-full rounded-lg border border-border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm";

type Draft = {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string;
};

function timeRange(event: TeamEvent) {
  return event.endTime ? `${event.startTime}–${event.endTime}` : `${event.startTime} Uhr`;
}

function blockLabel(block: EventBlock) {
  return block.kind === "LIMITED" ? `${block.name} (eingeschränkt)` : block.name;
}

export function TeamEvents({
  data,
  canRespond,
  canManage,
}: {
  data: TeamEventsData;
  canRespond: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<TeamEvent | "new" | null>(null);
  const [showPast, setShowPast] = React.useState(false);
  // Optimistische Antworten, bis der Server neu geladen hat.
  const [pendingResponses, setPendingResponses] = React.useState<
    Record<string, EventResponseStatus | null>
  >({});

  const all = [...data.upcoming, ...data.past];
  const opened = all.find((event) => event.id === openId) ?? null;

  const run = async (action: () => Promise<ActionResult>, success?: string) => {
    const result = await action();
    if (!result.ok) {
      toast.error("Das hat nicht geklappt", { description: result.error, duration: 5000 });
      return false;
    }
    if (success) toast.success(success, { duration: 3000 });
    router.refresh();
    return true;
  };

  const respond = async (event: TeamEvent, status: EventResponseStatus) => {
    const current = pendingResponses[event.id] ?? event.myResponse;
    const next = current === status ? null : status;
    setPendingResponses((map) => ({ ...map, [event.id]: next }));
    const ok = await run(() => respondTeamEventAction({ eventId: event.id, status: next }));
    if (!ok) setPendingResponses((map) => ({ ...map, [event.id]: current }));
  };

  const myResponse = (event: TeamEvent) =>
    event.id in pendingResponses ? pendingResponses[event.id] : event.myResponse;

  // Kommende Termine nach Monat gruppiert.
  const months: { label: string; events: TeamEvent[] }[] = [];
  for (const event of data.upcoming) {
    const label = MONTH.format(new Date(event.start));
    const group = months.at(-1);
    if (group?.label === label) group.events.push(event);
    else months.push({ label, events: [event] });
  }

  return (
    <section className="space-y-3" aria-labelledby="events-heading">
      <div className="flex items-center justify-between gap-2">
        <h2 id="events-heading" className="text-sm font-semibold">
          Termine
        </h2>
        {canManage ? (
          <Button type="button" size="sm" className="h-10" onClick={() => setEditing("new")}>
            <CalendarPlusIcon className="h-4 w-4" aria-hidden />
            Termin
          </Button>
        ) : null}
      </div>

      {months.length ? (
        months.map((month) => (
          <div key={month.label} className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {month.label}
            </h3>
            <ul className="grid gap-2 lg:grid-cols-2">
              {month.events.map((event, index) => (
                <EventCard
                  key={event.id}
                  event={event}
                  highlight={month === months[0] && index === 0}
                  response={myResponse(event)}
                  canRespond={canRespond}
                  onOpen={() => setOpenId(event.id)}
                  onRespond={(status) => respond(event, status)}
                />
              ))}
            </ul>
          </div>
        ))
      ) : (
        <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">Keine anstehenden Termine.</p>
          {canManage ? (
            <Button
              type="button"
              variant="outline"
              className="mt-3 h-10"
              onClick={() => setEditing("new")}
            >
              Ersten Termin anlegen
            </Button>
          ) : null}
        </div>
      )}

      {data.past.length ? (
        <div>
          <button
            type="button"
            onClick={() => setShowPast((value) => !value)}
            aria-expanded={showPast}
            className="flex min-h-10 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronDownIcon
              className={cn("h-4 w-4 transition-transform", showPast ? "" : "-rotate-90")}
              aria-hidden
            />
            Vergangene Termine ({data.past.length})
          </button>
          {showPast ? (
            <ul className="mt-1 divide-y divide-border/60 rounded-xl border border-border bg-card">
              {data.past.map((event) => (
                <li key={event.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(event.id)}
                    className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left"
                  >
                    <span className="w-20 shrink-0 text-xs tabular-nums text-muted-foreground">
                      {new Date(event.start).toLocaleDateString("de-DE", {
                        day: "numeric",
                        month: "short",
                        timeZone: "Europe/Berlin",
                      })}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">{event.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {event.responses.filter((entry) => entry.status === "yes").length} dabei
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <EventDetail
        event={opened}
        response={opened ? myResponse(opened) : null}
        canRespond={canRespond && !opened?.past}
        canManage={canManage}
        onOpenChange={(open) => !open && setOpenId(null)}
        onRespond={(status) => opened && respond(opened, status)}
        onEdit={() => {
          setEditing(opened);
          setOpenId(null);
        }}
        onDelete={async () => {
          if (!opened) return;
          const ok = await run(
            () => deleteTeamEventAction({ eventId: opened.id }),
            "Termin gelöscht",
          );
          if (ok) setOpenId(null);
        }}
      />

      <EventForm
        open={editing !== null}
        event={editing === "new" ? null : editing}
        today={data.today}
        blocksByDay={data.blocksByDay}
        onOpenChange={(open) => !open && setEditing(null)}
        onSave={(draft) =>
          run(
            () =>
              saveTeamEventAction({
                departmentId: data.departmentId,
                eventId: editing && editing !== "new" ? editing.id : undefined,
                ...draft,
              }),
            editing === "new" ? "Termin angelegt, das Team wird benachrichtigt" : "Gespeichert",
          )
        }
      />
    </section>
  );
}

function ResponseButtons({
  value,
  onChange,
  className,
}: {
  value: EventResponseStatus | null;
  onChange: (status: EventResponseStatus) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Deine Antwort"
      className={cn("grid grid-cols-3 gap-1.5", className)}
    >
      {RESPONSES.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "h-9 rounded-lg border px-2 text-sm font-medium transition-colors",
            value === option.value
              ? option.active
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function EventCard({
  event,
  highlight,
  response,
  canRespond,
  onOpen,
  onRespond,
}: {
  event: TeamEvent;
  highlight: boolean;
  response: EventResponseStatus | null;
  canRespond: boolean;
  onOpen: () => void;
  onRespond: (status: EventResponseStatus) => void;
}) {
  const yes = event.responses.filter((entry) => entry.status === "yes").length;
  const no = event.responses.filter((entry) => entry.status === "no").length;
  return (
    <li className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-start gap-3 p-3 text-left"
        aria-label={`${event.title} öffnen`}
      >
        <DateBadge date={new Date(event.start)} tone={highlight ? "primary" : "muted"} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{event.title}</span>
          <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <span className="shrink-0 tabular-nums">{timeRange(event)}</span>
            {event.location ? (
              <>
                <MapPinIcon className="ml-1 h-3 w-3 shrink-0" aria-hidden />
                <span className="truncate">{event.location}</span>
              </>
            ) : null}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="text-muted-foreground">
              <span className="font-medium text-success">{yes} dabei</span>
              {no ? ` · ${no} nicht` : ""}
              {event.pending.length ? ` · ${event.pending.length} offen` : ""}
            </span>
            {event.blocked.length ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning/20 px-2 py-0.5 font-medium">
                <AlertTriangleIcon className="h-3 w-3" aria-hidden />
                {event.blocked.length} laut Sperrliste verhindert
              </span>
            ) : null}
          </span>
        </span>
      </button>
      {canRespond ? (
        <ResponseButtons value={response} onChange={onRespond} className="px-3 pb-3" />
      ) : null}
    </li>
  );
}

function EventDetail({
  event,
  response,
  canRespond,
  canManage,
  onOpenChange,
  onRespond,
  onEdit,
  onDelete,
}: {
  event: TeamEvent | null;
  response: EventResponseStatus | null;
  canRespond: boolean;
  canManage: boolean;
  onOpenChange: (open: boolean) => void;
  onRespond: (status: EventResponseStatus) => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}) {
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  return (
    <>
      <ResponsivePanel
        open={event !== null}
        onOpenChange={onOpenChange}
        title={event?.title ?? "Termin"}
        description="Termin mit Zu- und Absagen"
        footer={
          event && canManage ? (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="h-11 w-11"
                aria-label="Termin löschen"
                onClick={() => setConfirmDelete(true)}
              >
                <TrashIcon />
              </Button>
              <Button type="button" variant="outline" className="h-11 flex-1" onClick={onEdit}>
                <PencilIcon className="h-4 w-4" aria-hidden />
                Bearbeiten
              </Button>
            </div>
          ) : undefined
        }
      >
        {event ? (
          <div className="space-y-4">
            <div className="space-y-1 text-sm">
              <p className="font-medium">
                {LONG_DAY.format(new Date(event.start))}, {timeRange(event)}
              </p>
              {event.location ? (
                <p className="flex items-center gap-1 text-muted-foreground">
                  <MapPinIcon className="h-4 w-4" aria-hidden />
                  {event.location}
                </p>
              ) : null}
              {event.description ? (
                <p className="whitespace-pre-line pt-1 text-muted-foreground">
                  {event.description}
                </p>
              ) : null}
            </div>

            {canRespond ? (
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Deine Antwort</span>
                <ResponseButtons value={response} onChange={onRespond} />
              </div>
            ) : null}

            {event.blocked.length ? (
              <div className="flex gap-2 rounded-lg bg-warning/15 px-3 py-2 text-sm">
                <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p>
                  <span className="font-medium">Laut Sperrliste verhindert: </span>
                  {event.blocked.map(blockLabel).join(", ")}
                </p>
              </div>
            ) : null}

            <dl className="space-y-3">
              {RESPONSE_GROUPS.map((group) => {
                const people = event.responses.filter((entry) => entry.status === group.value);
                if (!people.length) return null;
                return (
                  <PeopleGroup
                    key={group.value}
                    label={`${group.label} (${people.length})`}
                    names={people.map((entry) => entry.person.name)}
                  />
                );
              })}
              {event.pending.length ? (
                <PeopleGroup
                  label={`Noch keine Antwort (${event.pending.length})`}
                  names={event.pending.map((person) => person.name)}
                />
              ) : null}
            </dl>
          </div>
        ) : null}
      </ResponsivePanel>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Termin löschen?"
        description="Wer zugesagt hat, bekommt eine Absage-Benachrichtigung."
        confirmLabel="Löschen"
        cancelLabel="Abbrechen"
        variant="destructive"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false);
          await onDelete();
        }}
      />
    </>
  );
}

function PeopleGroup({ label, names }: { label: string; names: string[] }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 flex flex-wrap gap-1.5">
        {names.map((name) => (
          <span key={name} className="rounded-full bg-muted px-2.5 py-1 text-xs">
            {name}
          </span>
        ))}
      </dd>
    </div>
  );
}

function toDraft(event: TeamEvent | null, today: string): Draft {
  return {
    title: event?.title ?? "",
    date: event?.dayKey ?? today,
    startTime: event?.startTime ?? "18:00",
    endTime: event?.endTime ?? "",
    location: event?.location ?? "",
    description: event?.description ?? "",
  };
}

function EventForm({
  open,
  event,
  today,
  blocksByDay,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  event: TeamEvent | null;
  today: string;
  blocksByDay: Record<string, EventBlock[]>;
  onOpenChange: (open: boolean) => void;
  onSave: (draft: Draft) => Promise<boolean>;
}) {
  const [draft, setDraft] = React.useState<Draft>(() => toDraft(event, today));
  const [key, setKey] = React.useState(`${event?.id ?? "new"}-${open}`);
  const nextKey = `${event?.id ?? "new"}-${open}`;
  // Beim Öffnen den Entwurf neu setzen (ohne Effekt).
  if (key !== nextKey) {
    setKey(nextKey);
    setDraft(toDraft(event, today));
  }
  const [saving, setSaving] = React.useState(false);
  const update = <K extends keyof Draft>(field: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [field]: value }));

  const blocks = draft.date ? (blocksByDay[draft.date] ?? []) : [];
  const valid =
    draft.title.trim() &&
    draft.date &&
    draft.startTime &&
    (!draft.endTime || draft.endTime > draft.startTime);

  const save = async () => {
    setSaving(true);
    const ok = await onSave(draft);
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <ResponsivePanel
      open={open}
      onOpenChange={onOpenChange}
      title={event ? "Termin bearbeiten" : "Neuer Termin"}
      description="Termin für das Gewerk planen"
      footer={
        <AsyncButton
          type="button"
          className="h-11 w-full"
          isLoading={saving}
          loadingText="Speichert …"
          disabled={!valid}
          onClick={save}
        >
          {event ? "Speichern" : "Anlegen und Team benachrichtigen"}
        </AsyncButton>
      }
    >
      <div className="space-y-4">
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Titel</span>
          <input
            className={inputClass}
            value={draft.title}
            maxLength={120}
            autoFocus={!event}
            placeholder="z. B. Anprobe, Bautag, Besprechung"
            onChange={(e) => update("title", e.target.value)}
          />
        </label>
        <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2">
          <label className="block min-w-0 space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Datum</span>
            <input
              type="date"
              className={cn(inputClass, "px-2")}
              value={draft.date}
              min={event ? undefined : today}
              onChange={(e) => update("date", e.target.value)}
            />
          </label>
          <label className="block min-w-0 space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Beginn</span>
            <input
              type="time"
              className={cn(inputClass, "px-2")}
              value={draft.startTime}
              onChange={(e) => update("startTime", e.target.value)}
            />
          </label>
          <label className="block min-w-0 space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Ende</span>
            <input
              type="time"
              className={cn(inputClass, "px-2")}
              value={draft.endTime}
              onChange={(e) => update("endTime", e.target.value)}
            />
          </label>
        </div>

        {draft.date ? (
          blocks.length ? (
            <div className="flex gap-2 rounded-lg bg-warning/15 px-3 py-2 text-sm">
              <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>
                <span className="font-medium">Laut Sperrliste verhindert: </span>
                {blocks.map(blockLabel).join(", ")}
              </p>
            </div>
          ) : (
            <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">
              Laut Sperrliste hat das ganze Team an diesem Tag Zeit.
            </p>
          )
        ) : null}

        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Ort</span>
          <input
            className={inputClass}
            value={draft.location}
            maxLength={160}
            placeholder="optional"
            onChange={(e) => update("location", e.target.value)}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Beschreibung</span>
          <textarea
            className={cn(inputClass, "h-auto min-h-20 py-2")}
            value={draft.description}
            maxLength={2000}
            placeholder="optional, z. B. was mitzubringen ist"
            onChange={(e) => update("description", e.target.value)}
          />
        </label>
      </div>
    </ResponsivePanel>
  );
}

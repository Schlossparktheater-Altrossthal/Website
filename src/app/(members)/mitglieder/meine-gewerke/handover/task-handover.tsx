"use client";

import * as React from "react";
import { formatDistanceToNowStrict, format } from "date-fns";
import { de } from "date-fns/locale/de";

import {
  AlertTriangleIcon,
  CheckIcon,
  ChevronDownIcon,
  PlusIcon,
  HistoryIcon,
  WrenchIcon,
} from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import {
  NOTE_LIMIT,
  type ActivityEntry,
  type HandoverState,
  type NoteState,
} from "@/lib/departments/activity-format";
import { cn } from "@/lib/utils";

import { useAction } from "../ausstattung/shared";
import {
  loadTaskActivityAction,
  setTaskNoteAction,
  toggleTaskClaimAction,
} from "../handover-actions";

export function ago(iso: string) {
  return formatDistanceToNowStrict(new Date(iso), { locale: de, addSuffix: true });
}

/** „von Anna, vor 2 Std.“ */
function byLine(note: NoteState) {
  return `${note.by ? `${note.by.split(" ")[0]}, ` : ""}${ago(note.at)}`;
}

/**
 * Stand einer Karte für die Übergabe: „Ich bin dran“, Nächster Schritt, Achtung, Verlauf.
 * Erscheint in der Karte im Board und auf der Seite eines Ausstattungsstücks.
 */
export function TaskHandover({
  taskId,
  state,
  viewerId,
  canEdit,
  canEditCaution,
}: {
  taskId: string;
  state: HandoverState;
  viewerId: string;
  canEdit: boolean;
  canEditCaution: boolean;
}) {
  const run = useAction();
  const mine = state.claim?.userId === viewerId;
  const [claiming, setClaiming] = React.useState(false);
  const [editing, setEditing] = React.useState<NoteKey | null>(null);
  const [source, setSource] = React.useState(state);
  // Neue Serverdaten: Bearbeitung beenden (ohne Effekt).
  if (source !== state) {
    setSource(state);
    setEditing(null);
  }

  const notes: NoteConfig[] = [
    {
      key: "caution",
      label: "Achtung",
      placeholder: "z. B. Lack trocknet bis Samstag – nicht anfassen",
      note: state.caution,
      canEdit: canEdit && canEditCaution,
    },
    {
      key: "nextStep",
      label: "Nächster Schritt",
      placeholder: "Wo geht es weiter? z. B. zweite Schicht Farbe",
      note: state.nextStep,
      canEdit,
    },
  ];

  return (
    <section className="space-y-2" aria-label="Stand">
      <div className="flex flex-wrap items-center gap-2">
        {state.claim && !mine ? (
          <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-info/10 px-3 text-sm text-info">
            <WrenchIcon className="h-4 w-4" />
            {state.claim.name.split(" ")[0]} ist dran · {ago(state.claim.at)}
          </span>
        ) : null}
        {canEdit && (!state.claim || mine) ? (
          <AsyncButton
            type="button"
            variant={mine ? "default" : "outline"}
            size="sm"
            className="h-9"
            isLoading={claiming}
            onClick={async () => {
              setClaiming(true);
              await run(() => toggleTaskClaimAction({ taskId }));
              setClaiming(false);
            }}
          >
            <WrenchIcon className="h-4 w-4" />
            {mine ? "Ich bin dran ✓" : "Ich bin dran"}
          </AsyncButton>
        ) : null}
        {notes
          .filter((entry) => !entry.note && entry.canEdit && editing !== entry.key)
          .map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => setEditing(entry.key)}
              className="inline-flex h-9 items-center gap-1 rounded-full border border-dashed border-border px-3 text-sm text-muted-foreground hover:text-foreground"
            >
              <PlusIcon className="h-3.5 w-3.5" /> {entry.label}
            </button>
          ))}
      </div>

      {notes.map((entry) =>
        entry.note || editing === entry.key ? (
          <NoteField
            key={entry.key}
            taskId={taskId}
            config={entry}
            editing={editing === entry.key}
            onEdit={(value) => setEditing(value ? entry.key : null)}
          />
        ) : null,
      )}

      <ActivityList taskId={taskId} />
    </section>
  );
}

type NoteKey = "nextStep" | "caution";

type NoteConfig = {
  key: NoteKey;
  label: string;
  placeholder: string;
  note: NoteState | null;
  canEdit: boolean;
};

function NoteField({
  taskId,
  config,
  editing,
  onEdit,
}: {
  taskId: string;
  config: NoteConfig;
  editing: boolean;
  onEdit: (editing: boolean) => void;
}) {
  const run = useAction();
  const { key, label, placeholder, note, canEdit } = config;
  const [value, setValue] = React.useState(note?.text ?? "");
  const [saving, setSaving] = React.useState(false);
  const warn = key === "caution";

  const save = async (text: string) => {
    setSaving(true);
    const ok = await run(() => setTaskNoteAction({ taskId, field: key, text }));
    setSaving(false);
    if (ok) onEdit(false);
  };

  return (
    <div
      className={cn(
        "space-y-1 rounded-lg border px-3 py-2",
        warn ? "border-warning/60 bg-warning/10" : "border-border bg-muted/30",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 text-xs font-semibold",
            warn ? "text-warning-foreground" : "text-muted-foreground",
          )}
        >
          {warn ? <AlertTriangleIcon className="h-3.5 w-3.5" /> : null}
          {label}
        </span>
        {note && !editing ? (
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            {byLine(note)}
            {canEdit && warn ? (
              <button
                type="button"
                className="inline-flex h-7 items-center gap-0.5 rounded-md px-1.5 font-medium text-foreground hover:bg-muted"
                disabled={saving}
                onClick={() => void save("")}
              >
                <CheckIcon className="h-3.5 w-3.5" /> Erledigt
              </button>
            ) : null}
          </span>
        ) : null}
      </div>
      {editing ? (
        <form
          className="space-y-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            void save(value);
          }}
        >
          <textarea
            className="min-h-16 w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
            maxLength={NOTE_LIMIT}
            value={value}
            autoFocus
            placeholder={placeholder}
            aria-label={label}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void save(value);
              }
              if (event.key === "Escape") onEdit(false);
            }}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="h-9 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted"
              onClick={() => {
                setValue(note?.text ?? "");
                onEdit(false);
              }}
            >
              Abbrechen
            </button>
            <AsyncButton type="submit" size="sm" className="h-9" isLoading={saving}>
              Speichern
            </AsyncButton>
          </div>
        </form>
      ) : canEdit ? (
        <button
          type="button"
          className="block w-full whitespace-pre-wrap text-left text-sm"
          title="Antippen zum Ändern"
          onClick={() => {
            setValue(note?.text ?? "");
            onEdit(true);
          }}
        >
          {note?.text}
        </button>
      ) : (
        <p className="whitespace-pre-wrap text-sm">{note?.text}</p>
      )}
    </div>
  );
}

function ActivityList({ taskId }: { taskId: string }) {
  const [open, setOpen] = React.useState(false);
  const [entries, setEntries] = React.useState<ActivityEntry[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      const result = await loadTaskActivityAction({ taskId });
      setEntries(result.ok ? (result.data ?? []) : []);
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => void toggle()}
        aria-expanded={open}
        className="flex min-h-10 w-full items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <HistoryIcon className="h-4 w-4" />
        Verlauf
        <ChevronDownIcon
          className={cn("ml-auto h-4 w-4 transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? (
        loading ? (
          <p className="py-2 text-sm text-muted-foreground">Lädt …</p>
        ) : entries?.length ? (
          <ol className="space-y-1.5 border-l border-border pl-3">
            {entries.map((entry) => (
              <li key={entry.id} className="text-sm">
                <span className="block text-xs text-muted-foreground">
                  {entry.actor ?? "Unbekannt"} ·{" "}
                  {format(new Date(entry.at), "EEE d. MMM, HH:mm", { locale: de })}
                </span>
                <span className="break-words">{entry.text}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="py-2 text-sm text-muted-foreground">Noch nichts passiert.</p>
        )
      ) : null}
    </div>
  );
}

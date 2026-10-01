"use client";

import { useState } from "react";

import { TrashIcon } from "@/components/ui/action-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import {
  NOTE_TYPE_LABELS,
  type AssigneeOption,
  type NoteTypeValue,
  type ProtocolOp,
  type ProtocolState,
  type TaskAssignee,
} from "@/lib/calendar/protocol";
import { cn } from "@/lib/utils";

type Dispatch = (op: ProtocolOp) => void;

const TYPE_OPTIONS = (["NOTE", "DECISION", "TASK"] as const).map((value) => ({
  value,
  label: NOTE_TYPE_LABELS[value],
}));

const TYPE_TONE: Record<NoteTypeValue, string> = {
  NOTE: "border-border",
  DECISION: "border-info text-info",
  TASK: "border-warning text-warning",
};

export function assigneeLabel(assignee: TaskAssignee | null, options: readonly AssigneeOption[]) {
  if (!assignee) return null;
  return (
    options.find((option) => option.kind === assignee.kind && option.id === assignee.id)?.label ??
    "unbekannt"
  );
}

/** Suchfeld für Zuständige: Gewerk, Figur oder Person. */
function AssigneePicker({
  options,
  value,
  onChange,
}: {
  options: readonly AssigneeOption[];
  value: TaskAssignee | null;
  onChange: (value: TaskAssignee | null) => void;
}) {
  const [query, setQuery] = useState("");
  const term = query.trim().toLocaleLowerCase("de");
  const matches = term
    ? options.filter((option) => option.label.toLocaleLowerCase("de").includes(term)).slice(0, 6)
    : [];
  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
        <span className="truncate">{assigneeLabel(value, options)}</span>
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
          Ändern
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Gewerk, Figur oder Person suchen"
        aria-label="Zuständig"
      />
      {matches.length ? (
        <ul className="rounded-md border border-border">
          {matches.map((option) => (
            <li key={`${option.kind}-${option.id}`}>
              <button
                type="button"
                className="min-h-11 w-full px-3 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onChange({ kind: option.kind, id: option.id });
                  setQuery("");
                }}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Notizen, Entscheidungen und Aufgaben der Probe – ein Verlauf mit Typ je Eintrag. */
export function NotesPanel({
  state,
  assignees,
  dispatch,
}: {
  state: ProtocolState;
  assignees: readonly AssigneeOption[];
  dispatch: Dispatch;
}) {
  const [type, setType] = useState<NoteTypeValue>("NOTE");
  const [text, setText] = useState("");
  const [blockId, setBlockId] = useState<string>("");
  const [assignee, setAssignee] = useState<TaskAssignee | null>(null);
  const [dueAt, setDueAt] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const running = state.blocks.find((block) => block.actualStart && !block.actualEnd);

  const submit = () => {
    if (!text.trim()) return;
    dispatch({
      type: "note-add",
      noteId: crypto.randomUUID(),
      noteType: type,
      text: text.trim(),
      blockId: blockId || running?.id || null,
      assignee: type === "TASK" ? assignee : null,
      dueAt: type === "TASK" && dueAt ? dueAt : null,
    });
    setText("");
    setAssignee(null);
    setDueAt("");
  };

  const blockLabel = (id: string | null) =>
    id ? (state.blocks.find((block) => block.id === id)?.label ?? null) : null;
  const notes = [...state.notes].reverse();

  return (
    <div className="space-y-4">
      <form
        className="space-y-3 rounded-lg border border-border bg-card p-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <SegmentedControl
          value={type}
          onValueChange={setType}
          options={TYPE_OPTIONS}
          fullWidth
          aria-label="Art des Eintrags"
        />
        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={2}
          maxLength={4000}
          placeholder={
            type === "DECISION"
              ? "z. B. Kostüm Sz. 3 wird rot"
              : type === "TASK"
                ? "z. B. Koffer besorgen"
                : "z. B. Auftritt links statt rechts"
          }
          aria-label="Text"
        />
        {type === "TASK" ? (
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
            <div className="space-y-1">
              <Label>Zuständig</Label>
              <AssigneePicker options={assignees} value={assignee} onChange={setAssignee} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="probe-task-due">Bis</Label>
              <DateInput
                id="probe-task-due"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
              />
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground">
            Zu
            <select
              value={blockId}
              onChange={(event) => setBlockId(event.target.value)}
              className="min-h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-sm text-foreground"
            >
              <option value="">
                {running ? `aktuellem Punkt (${running.label})` : "der ganzen Probe"}
              </option>
              {state.blocks.map((block) => (
                <option key={block.id} value={block.id}>
                  {block.label}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="submit"
            disabled={!text.trim() || (type === "TASK" && !assignee)}
            className="shrink-0"
          >
            {NOTE_TYPE_LABELS[type]} speichern
          </Button>
        </div>
      </form>

      {notes.length ? (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {notes.map((note) => (
            <li key={note.id} className="flex items-start gap-3 px-3 py-2">
              <Badge variant="outline" className={cn("mt-0.5 shrink-0", TYPE_TONE[note.type])}>
                {NOTE_TYPE_LABELS[note.type]}
              </Badge>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm", note.doneAt && "line-through text-muted-foreground")}>
                  {note.text}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[
                    blockLabel(note.blockId),
                    assigneeLabel(note.assignee, assignees),
                    note.dueAt
                      ? `bis ${new Date(`${note.dueAt}T12:00:00Z`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", timeZone: "UTC" })}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Eintrag löschen"
                onClick={() => setRemoving(note.id)}
              >
                <TrashIcon className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Eintrag löschen?"
        description="Er verschwindet aus dem Protokoll; eine Gewerk-Aufgabe auch aus dem Board."
        confirmLabel="Löschen"
        cancelLabel="Abbrechen"
        variant="destructive"
        onConfirm={() => {
          if (removing) dispatch({ type: "note-remove", noteId: removing });
          setRemoving(null);
        }}
        onCancel={() => setRemoving(null)}
      />
      {notes.length ? null : (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Noch keine Einträge. Was besprochen, entschieden oder zu erledigen ist, landet hier – und
          später im Protokoll.
        </p>
      )}
    </div>
  );
}

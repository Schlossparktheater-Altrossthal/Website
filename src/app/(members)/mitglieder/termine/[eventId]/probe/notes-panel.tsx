"use client";

import { useState } from "react";

import { CloseIcon, EditIcon, TrashIcon } from "@/components/ui/action-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DateInput } from "@/components/ui/date-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import {
  NOTE_TYPE_LABELS,
  assigneeKey,
  uniqueAssignees,
  type AssigneeOption,
  type NoteTypeValue,
  type ProtocolNote,
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

export function assigneeLabel(assignee: TaskAssignee, options: readonly AssigneeOption[]) {
  return (
    options.find((option) => option.kind === assignee.kind && option.id === assignee.id)?.label ??
    "unbekannt"
  );
}

type SceneOption = { id: string; label: string; characterIds: string[] };

/** Suchfeld für Zuständige (Gewerke, Figuren, Personen); mehrere möglich, als Chips. */
function AssigneePicker({
  options,
  value,
  onChange,
  scene,
}: {
  options: readonly AssigneeOption[];
  value: TaskAssignee[];
  onChange: (value: TaskAssignee[]) => void;
  /** Szene des gewählten Punkts: Schnellwahl „Besetzung der Szene“. */
  scene: SceneOption | null;
}) {
  const [query, setQuery] = useState("");
  const chosen = new Set(value.map(assigneeKey));
  const term = query.trim().toLocaleLowerCase("de");
  const matches = term
    ? options
        .filter(
          (option) =>
            !chosen.has(assigneeKey(option)) && option.label.toLocaleLowerCase("de").includes(term),
        )
        .slice(0, 6)
    : [];
  const sceneCast = scene
    ? scene.characterIds
        .map((id) => ({ kind: "character" as const, id }))
        .filter((entry) => options.some((option) => assigneeKey(option) === assigneeKey(entry)))
    : [];
  const missingCast = sceneCast.filter((entry) => !chosen.has(assigneeKey(entry)));
  return (
    <div className="space-y-2">
      {value.length ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Zuständige">
          {value.map((entry) => (
            <li
              key={assigneeKey(entry)}
              className="flex max-w-full items-center gap-1 rounded-full border border-border bg-muted/50 py-0.5 pr-0.5 pl-2.5 text-sm"
            >
              <span className="truncate">{assigneeLabel(entry, options)}</span>
              <button
                type="button"
                className="flex size-7 shrink-0 items-center justify-center rounded-full hover:bg-muted"
                aria-label={`${assigneeLabel(entry, options)} entfernen`}
                onClick={() =>
                  onChange(value.filter((item) => assigneeKey(item) !== assigneeKey(entry)))
                }
              >
                <CloseIcon className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={value.length ? "Weitere hinzufügen" : "Gewerk, Figur oder Person suchen"}
        aria-label="Zuständige suchen"
      />
      {matches.length ? (
        <ul className="rounded-md border border-border">
          {matches.map((option) => (
            <li key={assigneeKey(option)}>
              <button
                type="button"
                className="min-h-11 w-full px-3 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onChange([...value, { kind: option.kind, id: option.id }]);
                  setQuery("");
                }}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {missingCast.length ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange(uniqueAssignees([...value, ...missingCast]))}
        >
          + Besetzung von {scene?.label}
        </Button>
      ) : null}
    </div>
  );
}

type NoteDraft = {
  type: NoteTypeValue;
  text: string;
  /** Leer: aktueller Punkt bzw. ganze Probe. */
  blockId: string;
  assignees: TaskAssignee[];
  dueAt: string;
  notify: boolean;
};

/** Eingabe für einen Eintrag – zum Anlegen und zum Bearbeiten. */
function NoteForm({
  state,
  assignees,
  scenes,
  preparing,
  initial,
  editing,
  onSubmit,
  onCancel,
}: {
  state: ProtocolState;
  assignees: readonly AssigneeOption[];
  scenes: readonly SceneOption[];
  preparing: boolean;
  initial?: Partial<NoteDraft>;
  /** Bearbeiten: Benachrichtigung betrifft nur neu hinzugekommene Zuständige. */
  editing?: boolean;
  onSubmit: (draft: NoteDraft) => void;
  onCancel?: () => void;
}) {
  const [type, setType] = useState<NoteTypeValue>(initial?.type ?? "NOTE");
  const [text, setText] = useState(initial?.text ?? "");
  const [blockId, setBlockId] = useState(initial?.blockId ?? "");
  const [chosen, setChosen] = useState<TaskAssignee[]>(initial?.assignees ?? []);
  const [dueAt, setDueAt] = useState(initial?.dueAt ?? "");
  // Aufgaben melden die Zuständigen standardmäßig; Notizen gehen nur auf Wunsch an alle.
  const [notifyChoice, setNotifyChoice] = useState<boolean | null>(null);
  const notify = notifyChoice ?? type === "TASK";
  const running = state.blocks.find((block) => block.actualStart && !block.actualEnd);
  const effectiveBlock = state.blocks.find(
    (block) => block.id === (blockId || (editing ? "" : running?.id)),
  );
  const scene = effectiveBlock?.sceneId
    ? (scenes.find((entry) => entry.id === effectiveBlock.sceneId) ?? null)
    : null;
  const fieldId = editing ? "probe-task-due-edit" : "probe-task-due";

  const submit = () => {
    if (!text.trim()) return;
    onSubmit({ type, text: text.trim(), blockId, assignees: chosen, dueAt, notify });
    if (editing) return;
    setText("");
    setNotifyChoice(null);
    setChosen([]);
    setDueAt("");
  };

  return (
    <form
      className="space-y-3 rounded-lg border border-border bg-card p-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <SegmentedControl
        value={type}
        onValueChange={(value) => {
          setType(value);
          setNotifyChoice(null);
        }}
        options={TYPE_OPTIONS}
        fullWidth
        aria-label="Art des Eintrags"
      />
      <Textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={editing ? 3 : 2}
        maxLength={4000}
        autoFocus={editing}
        placeholder={
          type === "DECISION"
            ? "z. B. Kostüm Sz. 3 wird rot"
            : type === "TASK"
              ? "z. B. Koffer besorgen"
              : preparing
                ? "z. B. Bitte Degen mitbringen, Kampfszene zuerst"
                : "z. B. Auftritt links statt rechts"
        }
        aria-label="Text"
      />
      {type === "TASK" ? (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <div className="space-y-1">
            <Label>Zuständig</Label>
            <AssigneePicker options={assignees} value={chosen} onChange={setChosen} scene={scene} />
          </div>
          <div className="space-y-1">
            <Label htmlFor={fieldId}>Bis</Label>
            <DateInput
              id={fieldId}
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
            />
          </div>
        </div>
      ) : null}
      {editing && type !== "TASK" ? null : (
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <Checkbox checked={notify} onCheckedChange={(value) => setNotifyChoice(value === true)} />
          {type === "TASK"
            ? editing
              ? "Neu hinzugefügte Zuständige benachrichtigen"
              : "Zuständige benachrichtigen"
            : "Alle Eingeladenen benachrichtigen"}
        </label>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground",
            // Beim Bearbeiten stehen zwei Knöpfe daneben: mobil eigene Zeile.
            onCancel && "basis-full sm:basis-0",
          )}
        >
          Zu
          <select
            value={blockId}
            onChange={(event) => setBlockId(event.target.value)}
            className="min-h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-sm text-foreground"
          >
            <option value="">
              {!editing && running ? `aktuellem Punkt (${running.label})` : "der ganzen Probe"}
            </option>
            {state.blocks.map((block) => (
              <option key={block.id} value={block.id}>
                {block.label}
              </option>
            ))}
          </select>
        </label>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} className="ml-auto shrink-0">
            Abbrechen
          </Button>
        ) : null}
        <Button
          type="submit"
          disabled={!text.trim() || (type === "TASK" && !chosen.length)}
          className="shrink-0"
        >
          {editing ? "Speichern" : `${NOTE_TYPE_LABELS[type]} speichern`}
        </Button>
      </div>
    </form>
  );
}

/** Notizen, Entscheidungen und Aufgaben der Probe – ein Verlauf mit Typ je Eintrag. */
export function NotesPanel({
  state,
  assignees,
  scenes,
  dispatch,
  canChange,
  preparing,
}: {
  state: ProtocolState;
  assignees: readonly AssigneeOption[];
  scenes: readonly SceneOption[];
  dispatch: Dispatch;
  /** Darf dieser Eintrag bearbeitet/gelöscht werden (Gewerk-Leitungen: nur eigene)? */
  canChange: (note: ProtocolNote) => boolean;
  /** Vor der Probe: Einträge sind Vorab-Hinweise. */
  preparing: boolean;
}) {
  const [removing, setRemoving] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const running = state.blocks.find((block) => block.actualStart && !block.actualEnd);

  const blockLabel = (id: string | null) =>
    id ? (state.blocks.find((block) => block.id === id)?.label ?? null) : null;
  const notes = [...state.notes].reverse();
  const isPrepared = (note: ProtocolNote) =>
    state.actualStart ? note.createdAt < state.actualStart : preparing;
  const assigneeText = (note: ProtocolNote) =>
    note.assignees.length
      ? note.assignees
          .map((entry) => {
            const label = assigneeLabel(entry, assignees);
            return note.assignees.length > 1 && entry.doneAt ? `${label} ✓` : label;
          })
          .join(", ")
      : null;

  return (
    <div className="space-y-4">
      <NoteForm
        state={state}
        assignees={assignees}
        scenes={scenes}
        preparing={preparing}
        onSubmit={(draft) =>
          dispatch({
            type: "note-add",
            noteId: crypto.randomUUID(),
            noteType: draft.type,
            text: draft.text,
            blockId: draft.blockId || running?.id || null,
            assignees: draft.type === "TASK" ? draft.assignees : [],
            dueAt: draft.type === "TASK" && draft.dueAt ? draft.dueAt : null,
            notify: draft.notify,
          })
        }
      />

      {notes.length ? (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {notes.map((note) =>
            editingId === note.id ? (
              <li key={note.id} className="p-2">
                <NoteForm
                  state={state}
                  assignees={assignees}
                  scenes={scenes}
                  preparing={preparing}
                  editing
                  initial={{
                    type: note.type,
                    text: note.text,
                    blockId: note.blockId ?? "",
                    assignees: note.assignees.map(({ kind, id }) => ({ kind, id })),
                    dueAt: note.dueAt ?? "",
                  }}
                  onCancel={() => setEditingId(null)}
                  onSubmit={(draft) => {
                    const task = draft.type === "TASK";
                    dispatch({
                      type: "note-edit",
                      noteId: note.id,
                      noteType: draft.type,
                      text: draft.text,
                      blockId: draft.blockId || null,
                      assignees: task ? draft.assignees : [],
                      dueAt: task && draft.dueAt ? draft.dueAt : null,
                      notify: draft.notify,
                    });
                    setEditingId(null);
                  }}
                />
              </li>
            ) : (
              <li key={note.id} className="flex items-start gap-3 px-3 py-2">
                <Badge variant="outline" className={cn("mt-0.5 shrink-0", TYPE_TONE[note.type])}>
                  {NOTE_TYPE_LABELS[note.type]}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-sm whitespace-pre-line",
                      note.doneAt && "line-through text-muted-foreground",
                    )}
                  >
                    {note.text}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[
                      isPrepared(note) ? "vorab" : null,
                      note.authorName,
                      blockLabel(note.blockId),
                      assigneeText(note),
                      note.dueAt
                        ? `bis ${new Date(`${note.dueAt}T12:00:00Z`).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", timeZone: "UTC" })}`
                        : null,
                      note.editedAt ? "bearbeitet" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {canChange(note) ? (
                  <div className="flex shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label="Eintrag bearbeiten"
                      onClick={() => setEditingId(note.id)}
                    >
                      <EditIcon className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label="Eintrag löschen"
                      onClick={() => setRemoving(note.id)}
                    >
                      <TrashIcon className="size-4" />
                    </Button>
                  </div>
                ) : null}
              </li>
            ),
          )}
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

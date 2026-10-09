"use client";

import * as React from "react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { de } from "date-fns/locale/de";
import type { StepUndoScope, TaskStatus } from "@prisma/client";

import {
  AlertTriangleIcon,
  CheckIcon,
  ChevronDownIcon,
  HistoryIcon,
  PlusIcon,
  TrashIcon,
  WrenchIcon,
} from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  NOTE_LIMIT,
  STEP_LIMIT,
  WORK_STATUS_LABELS,
  orderSteps,
  splitSteps,
  type NoteState,
  type WorkState,
  type WorkStep,
} from "@/lib/departments/activity-format";
import type { FeedEntry } from "@/lib/departments/handover";
import { cn } from "@/lib/utils";

import { useAction } from "../ausstattung/shared";
import { addBoardTaskCommentAction } from "../board-actions";
import {
  addStepsAction,
  deleteStepAction,
  loadTaskFeedAction,
  renameStepAction,
  setTaskNoteAction,
  setTaskStatusAction,
  toggleStepAction,
  toggleTaskClaimAction,
} from "../handover-actions";

export function ago(iso: string) {
  return formatDistanceToNowStrict(new Date(iso), { locale: de, addSuffix: true });
}

const firstName = (name: string | null | undefined) => name?.split(" ")[0] ?? "Jemand";

export type WorkPermissions = {
  viewerId: string;
  canEdit: boolean;
  /** „Achtung“ darf je nach Gewerk nur die Leitung setzen. */
  canEditCaution: boolean;
  canManage: boolean;
  stepUndo: StepUndoScope;
};

/**
 * Arbeitsblock einer Karte (docs/Plan/uebergabe-plan.md, Teil 2): Status, „Ich bin dran“,
 * Achtung, Schritte, Notizen & Verlauf. Alles speichert sofort.
 */
export function TaskWork({ work, perms }: { work: WorkState; perms: WorkPermissions }) {
  const run = useAction();
  const [status, setStatus] = React.useState(work.status);
  const [source, setSource] = React.useState(work.status);
  if (source !== work.status) {
    setSource(work.status);
    setStatus(work.status);
  }

  return (
    <section className="space-y-3" aria-label="Arbeiten">
      <SegmentedControl<TaskStatus>
        aria-label="Status"
        size="md"
        fullWidth
        value={status}
        onValueChange={(value) => {
          if (!perms.canEdit) return;
          setStatus(value);
          void run(() => setTaskStatusAction({ taskId: work.taskId, status: value })).then(
            (ok) => !ok && setStatus(work.status),
          );
        }}
        options={(["todo", "doing", "done"] as const).map((value) => ({
          value,
          label: WORK_STATUS_LABELS[value],
          ariaLabel: WORK_STATUS_LABELS[value],
          disabled: !perms.canEdit,
        }))}
      />

      <ClaimAndCaution work={work} perms={perms} />

      <StepList taskId={work.taskId} steps={work.steps} perms={perms} />

      <Feed taskId={work.taskId} canEdit={perms.canEdit} />
    </section>
  );
}

function ClaimAndCaution({ work, perms }: { work: WorkState; perms: WorkPermissions }) {
  const run = useAction();
  const { claim, caution } = work.handover;
  const mine = claim?.userId === perms.viewerId;
  const [claiming, setClaiming] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const canCaution = perms.canEdit && perms.canEditCaution;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {claim && !mine ? (
          <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-info/10 px-3 text-sm text-info">
            <WrenchIcon className="h-4 w-4" />
            {firstName(claim.name)} ist dran · {ago(claim.at)}
          </span>
        ) : null}
        {perms.canEdit && (!claim || mine) ? (
          <AsyncButton
            type="button"
            variant={mine ? "default" : "outline"}
            size="sm"
            className="h-9"
            isLoading={claiming}
            onClick={async () => {
              setClaiming(true);
              await run(() => toggleTaskClaimAction({ taskId: work.taskId }));
              setClaiming(false);
            }}
          >
            <WrenchIcon className="h-4 w-4" />
            {mine ? "Ich bin dran ✓" : "Ich bin dran"}
          </AsyncButton>
        ) : null}
        {!caution && canCaution && !editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex h-9 items-center gap-1 rounded-full border border-dashed border-border px-3 text-sm text-muted-foreground hover:text-foreground"
          >
            <AlertTriangleIcon className="h-3.5 w-3.5" /> Achtung
          </button>
        ) : null}
      </div>
      {caution || editing ? (
        <CautionField
          key={caution?.at ?? "neu"}
          taskId={work.taskId}
          note={caution}
          canEdit={canCaution}
          editing={editing}
          onEdit={setEditing}
        />
      ) : null}
    </>
  );
}

function CautionField({
  taskId,
  note,
  canEdit,
  editing,
  onEdit,
}: {
  taskId: string;
  note: NoteState | null;
  canEdit: boolean;
  editing: boolean;
  onEdit: (editing: boolean) => void;
}) {
  const run = useAction();
  const [value, setValue] = React.useState(note?.text ?? "");
  const [saving, setSaving] = React.useState(false);

  const save = async (text: string) => {
    setSaving(true);
    const ok = await run(() => setTaskNoteAction({ taskId, field: "caution", text }));
    setSaving(false);
    if (ok) onEdit(false);
  };

  return (
    <div className="space-y-1 rounded-lg border border-warning/60 bg-warning/10 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-warning-foreground">
          <AlertTriangleIcon className="h-3.5 w-3.5" /> Achtung
        </span>
        {note && !editing ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {firstName(note.by)}, {ago(note.at)}
            {canEdit ? (
              <button
                type="button"
                className="inline-flex h-8 items-center gap-0.5 rounded-md px-2 font-medium text-foreground hover:bg-muted"
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
            placeholder="z. B. Lack trocknet bis Samstag – nicht anfassen"
            aria-label="Achtung"
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
              onClick={() => onEdit(false)}
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

/** Darf diesen erledigten Schritt wieder öffnen? */
function canUndo(step: WorkStep, perms: WorkPermissions) {
  if (!perms.canEdit) return false;
  if (perms.stepUndo === "all" || perms.canManage) return true;
  return !step.doneById || step.doneById === perms.viewerId;
}

/**
 * Schrittliste: offene zuerst, der erste ist „Als Nächstes“. Abhaken mit einem Tipp
 * (sofort sichtbar), Text antippen zum Ändern. `limit` kürzt die offenen Schritte (Vor Ort).
 */
export function StepList({
  taskId,
  steps,
  perms,
  limit,
  hideDone,
  hideAdd,
}: {
  taskId: string;
  steps: WorkStep[];
  perms: WorkPermissions;
  limit?: number;
  hideDone?: boolean;
  hideAdd?: boolean;
}) {
  const run = useAction();
  // Sofort abhaken, Server bestätigt nach.
  const [pending, setPending] = React.useState<Record<string, boolean>>({});
  const [source, setSource] = React.useState(steps);
  if (source !== steps) {
    setSource(steps);
    setPending({});
  }
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [showDone, setShowDone] = React.useState(false);

  const view = steps.map((step) =>
    step.id in pending ? { ...step, done: pending[step.id]! } : step,
  );
  const ordered = orderSteps(view);
  const open = ordered.filter((step) => !step.done);
  const done = ordered.filter((step) => step.done);
  const visibleOpen = limit ? open.slice(0, limit) : open;

  const toggle = (step: WorkStep) => {
    const next = !step.done;
    if (!next && !canUndo(step, perms)) return;
    setPending((current) => ({ ...current, [step.id]: next }));
    void run(() => toggleStepAction({ itemId: step.id, done: next })).then((ok) => {
      if (!ok)
        setPending((current) => {
          const rest = { ...current };
          delete rest[step.id];
          return rest;
        });
    });
  };

  return (
    <div className="space-y-1">
      {steps.length && !limit ? (
        <div className="flex items-center gap-2 pb-1">
          <span className="text-xs font-semibold text-muted-foreground">
            Schritte {done.length}/{steps.length}
          </span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-success transition-all"
              style={{ width: `${(done.length / steps.length) * 100}%` }}
            />
          </span>
        </div>
      ) : null}
      <ul className="space-y-1">
        {visibleOpen.map((step, index) => (
          <StepRow
            key={step.id}
            step={step}
            next={index === 0}
            perms={perms}
            editing={editingId === step.id}
            onEdit={(value) => setEditingId(value ? step.id : null)}
            onToggle={() => toggle(step)}
          />
        ))}
      </ul>
      {limit && open.length > limit ? (
        <p className="pl-11 text-xs text-muted-foreground">+ {open.length - limit} weitere</p>
      ) : null}
      {!hideDone && done.length ? (
        <>
          <button
            type="button"
            onClick={() => setShowDone((value) => !value)}
            aria-expanded={showDone}
            className="flex min-h-9 items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronDownIcon className={cn("h-3.5 w-3.5", showDone && "rotate-180")} />
            {done.length} erledigt
          </button>
          {showDone ? (
            <ul className="space-y-1">
              {done.map((step) => (
                <StepRow
                  key={step.id}
                  step={step}
                  perms={perms}
                  editing={editingId === step.id}
                  onEdit={(value) => setEditingId(value ? step.id : null)}
                  onToggle={() => toggle(step)}
                />
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
      {perms.canEdit && !hideAdd ? <AddSteps taskId={taskId} empty={!steps.length} /> : null}
    </div>
  );
}

function StepRow({
  step,
  next,
  perms,
  editing,
  onEdit,
  onToggle,
}: {
  step: WorkStep;
  next?: boolean;
  perms: WorkPermissions;
  editing: boolean;
  onEdit: (editing: boolean) => void;
  onToggle: () => void;
}) {
  const run = useAction();
  const [text, setText] = React.useState(step.text);
  const locked = step.done && !canUndo(step, perms);

  return (
    <li
      className={cn(
        "flex min-h-11 items-center gap-1 rounded-lg",
        next && "bg-primary/10 ring-1 ring-primary/30",
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={step.done}
        aria-label={step.text}
        disabled={!perms.canEdit || locked}
        onClick={onToggle}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg disabled:opacity-60"
      >
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors",
            step.done
              ? "border-success bg-success text-success-foreground"
              : next
                ? "border-primary"
                : "border-muted-foreground/50",
          )}
        >
          {step.done ? <CheckIcon className="h-4 w-4" /> : null}
        </span>
      </button>
      {editing ? (
        <form
          className="flex min-w-0 flex-1 items-center gap-1 pr-1"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!text.trim()) return;
            if (await run(() => renameStepAction({ itemId: step.id, text }))) onEdit(false);
          }}
        >
          <input
            className="h-10 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
            value={text}
            maxLength={STEP_LIMIT}
            autoFocus
            aria-label="Schritt ändern"
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => event.key === "Escape" && onEdit(false)}
            onBlur={(event) => {
              // Klick auf Löschen nicht durch Blur abbrechen.
              if (!event.relatedTarget) onEdit(false);
            }}
          />
          <button
            type="button"
            aria-label="Schritt löschen"
            className="flex h-10 w-10 items-center justify-center rounded-md text-destructive hover:bg-destructive/10"
            onClick={() => void run(() => deleteStepAction({ itemId: step.id }))}
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </form>
      ) : (
        <button
          type="button"
          disabled={!perms.canEdit}
          onClick={() => {
            setText(step.text);
            onEdit(true);
          }}
          className="min-w-0 flex-1 py-1.5 pr-2 text-left"
        >
          <span
            className={cn(
              "block text-sm leading-snug",
              step.done && "text-muted-foreground line-through",
              next && "font-medium",
            )}
          >
            {step.text}
          </span>
          {next ? (
            <span className="block text-[11px] font-medium text-primary">Als Nächstes</span>
          ) : step.done && step.doneAt ? (
            <span className="block text-[11px] text-muted-foreground">
              {firstName(step.doneBy)} · {ago(step.doneAt)}
            </span>
          ) : null}
        </button>
      )}
    </li>
  );
}

/** Eingabe für neue Schritte: Enter = nächster, mehrere Zeilen einfügen = mehrere Schritte. */
export function AddSteps({ taskId, empty }: { taskId: string; empty?: boolean }) {
  const run = useAction();
  const [text, setText] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const add = async (texts: string[]) => {
    if (!texts.length) return;
    setSaving(true);
    if (await run(() => addStepsAction({ taskId, texts }))) setText("");
    setSaving(false);
    inputRef.current?.focus();
  };

  return (
    <form
      className="flex items-center gap-1"
      onSubmit={(event) => {
        event.preventDefault();
        void add(splitSteps(text));
      }}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground">
        <PlusIcon className="h-4 w-4" />
      </span>
      <input
        ref={inputRef}
        className="h-11 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 text-base outline-none placeholder:text-muted-foreground focus:border-border focus:bg-background sm:text-sm"
        value={text}
        maxLength={STEP_LIMIT}
        disabled={saving}
        placeholder={
          empty ? "Ersten Schritt eintragen – oder Liste einfügen" : "Schritt hinzufügen"
        }
        aria-label="Schritt hinzufügen"
        enterKeyHint="next"
        onChange={(event) => setText(event.target.value)}
        onPaste={(event) => {
          const pasted = splitSteps(event.clipboardData.getData("text"));
          if (pasted.length > 1) {
            event.preventDefault();
            void add(pasted);
          }
        }}
      />
      {text.trim() ? (
        <AsyncButton type="submit" size="sm" className="h-10" isLoading={saving}>
          OK
        </AsyncButton>
      ) : null}
    </form>
  );
}

/** Notizen (Kommentare) und Verlauf in einer Zeitleiste. */
function Feed({ taskId, canEdit }: { taskId: string; canEdit: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [entries, setEntries] = React.useState<FeedEntry[] | null>(null);
  const [comment, setComment] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const run = useAction();

  const reload = async () => {
    const result = await loadTaskFeedAction({ taskId });
    setEntries(result.ok ? (result.data ?? []) : []);
  };

  return (
    <div className="space-y-2 border-t border-border pt-2">
      <button
        type="button"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) void reload();
        }}
        aria-expanded={open}
        className="flex min-h-10 w-full items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <HistoryIcon className="h-4 w-4" />
        Notizen & Verlauf
        <ChevronDownIcon
          className={cn("ml-auto h-4 w-4 transition-transform", open && "rotate-180")}
        />
      </button>
      {open ? (
        <>
          {canEdit ? (
            <form
              className="flex gap-2"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!comment.trim()) return;
                setSending(true);
                if (await run(() => addBoardTaskCommentAction({ taskId, body: comment }))) {
                  setComment("");
                  await reload();
                }
                setSending(false);
              }}
            >
              <input
                className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
                value={comment}
                maxLength={2000}
                placeholder="Notiz für die anderen"
                aria-label="Notiz"
                onChange={(event) => setComment(event.target.value)}
              />
              <AsyncButton type="submit" variant="outline" className="h-11" isLoading={sending}>
                Senden
              </AsyncButton>
            </form>
          ) : null}
          {entries === null ? (
            <p className="py-2 text-sm text-muted-foreground">Lädt …</p>
          ) : entries.length ? (
            <ol className="space-y-2 border-l border-border pl-3">
              {entries.map((entry) => (
                <li key={entry.id} className="text-sm">
                  <span className="block text-xs text-muted-foreground">
                    {entry.actor ?? "Unbekannt"} ·{" "}
                    {format(new Date(entry.at), "EEE d. MMM, HH:mm", { locale: de })}
                  </span>
                  <span
                    className={cn(
                      "block whitespace-pre-wrap break-words",
                      entry.comment && "rounded-md bg-muted/60 px-2 py-1",
                    )}
                  >
                    {entry.text}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="py-2 text-sm text-muted-foreground">Noch nichts passiert.</p>
          )}
        </>
      ) : null}
    </div>
  );
}

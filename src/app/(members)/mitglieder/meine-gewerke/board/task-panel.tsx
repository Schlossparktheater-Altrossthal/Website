"use client";

import * as React from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale/de";
import type { TaskPriority } from "@prisma/client";

import { TrashIcon } from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { BoardColumn, BoardPerson, BoardTask } from "@/lib/departments/board";
import { cn } from "@/lib/utils";

import { ResponsivePanel } from "./panel";
import { PRIORITY_LABELS, toDateInput } from "./shared";

export type TaskDraft = {
  title: string;
  description: string;
  dueAt: string;
  priority: TaskPriority;
  assigneeIds: string[];
  columnId: string;
};

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm";

export function TaskPanel({
  open,
  onOpenChange,
  task,
  columns,
  members,
  initialColumnId,
  canEdit,
  canDelete,
  onSave,
  onDelete,
  onComment,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` = neue Aufgabe. */
  task: BoardTask | null;
  columns: BoardColumn[];
  members: BoardPerson[];
  initialColumnId: string;
  canEdit: boolean;
  canDelete: boolean;
  onSave: (draft: TaskDraft) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  onComment: (body: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = React.useState<TaskDraft>(() => fromTask(task, initialColumnId));
  const [key, setKey] = React.useState(`${task?.id ?? "new"}-${open}`);
  const nextKey = `${task?.id ?? "new"}-${open}`;
  // Beim Öffnen einer anderen Aufgabe den Entwurf neu setzen (ohne Effekt).
  if (key !== nextKey) {
    setKey(nextKey);
    setDraft(fromTask(task, initialColumnId));
  }
  const [saving, setSaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [comment, setComment] = React.useState("");
  const [sending, setSending] = React.useState(false);

  const update = <K extends keyof TaskDraft>(field: K, value: TaskDraft[K]) =>
    setDraft((current) => ({ ...current, [field]: value }));
  const toggleAssignee = (id: string) =>
    update(
      "assigneeIds",
      draft.assigneeIds.includes(id)
        ? draft.assigneeIds.filter((entry) => entry !== id)
        : [...draft.assigneeIds, id],
    );

  const save = async () => {
    setSaving(true);
    const ok = await onSave(draft);
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <>
      <ResponsivePanel
        open={open}
        onOpenChange={onOpenChange}
        title={task ? "Aufgabe" : "Neue Aufgabe"}
        description="Aufgabe bearbeiten"
        footer={
          canEdit ? (
            <div className="flex gap-2">
              {task && canDelete ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="h-11 w-11"
                  aria-label="Aufgabe löschen"
                  onClick={() => setConfirmDelete(true)}
                >
                  <TrashIcon />
                </Button>
              ) : null}
              <AsyncButton
                type="button"
                className="h-11 flex-1"
                isLoading={saving}
                loadingText="Speichert …"
                disabled={!draft.title.trim()}
                onClick={save}
              >
                {task ? "Speichern" : "Anlegen"}
              </AsyncButton>
            </div>
          ) : undefined
        }
      >
        <fieldset disabled={!canEdit} className="space-y-4">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Titel</span>
            <input
              className={cn(inputClass, "h-11")}
              value={draft.title}
              maxLength={160}
              autoFocus={!task}
              onChange={(event) => update("title", event.target.value)}
              placeholder="Was ist zu tun?"
            />
          </label>

          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Spalte</span>
            <div className="flex flex-wrap gap-1.5">
              {columns.map((column) => (
                <button
                  key={column.id}
                  type="button"
                  onClick={() => update("columnId", column.id)}
                  aria-pressed={draft.columnId === column.id}
                  className={cn(
                    "h-9 rounded-full border px-3 text-sm",
                    draft.columnId === column.id
                      ? "border-primary bg-primary/10 font-medium text-primary"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {column.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Fällig am</span>
              <input
                type="date"
                className={cn(inputClass, "h-11")}
                value={draft.dueAt}
                onChange={(event) => update("dueAt", event.target.value)}
              />
            </label>
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Priorität</span>
              <SegmentedControl<TaskPriority>
                aria-label="Priorität"
                size="md"
                fullWidth
                value={draft.priority}
                onValueChange={(value) => update("priority", value)}
                options={(["low", "normal", "high"] as const).map((value) => ({
                  value,
                  label: PRIORITY_LABELS[value],
                  ariaLabel: PRIORITY_LABELS[value],
                }))}
              />
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Zuständig</span>
            <div className="flex flex-wrap gap-1.5">
              {members.map((member) => {
                const active = draft.assigneeIds.includes(member.id);
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => toggleAssignee(member.id)}
                    aria-pressed={active}
                    className={cn(
                      "h-9 rounded-full border px-3 text-sm",
                      active
                        ? "border-primary bg-primary/10 font-medium text-primary"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    {member.name}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Beschreibung</span>
            <textarea
              className={cn(inputClass, "min-h-24 py-2")}
              value={draft.description}
              maxLength={4000}
              onChange={(event) => update("description", event.target.value)}
              placeholder="Details, Links, Maße …"
            />
          </label>
        </fieldset>

        {task ? (
          <section className="mt-5 space-y-2 border-t border-border pt-4" aria-label="Kommentare">
            <h3 className="text-sm font-semibold">Kommentare ({task.comments.length})</h3>
            <ul className="space-y-2">
              {task.comments.map((entry) => (
                <li key={entry.id} className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
                  <span className="block text-xs text-muted-foreground">
                    {entry.author} ·{" "}
                    {format(new Date(entry.createdAt), "d. MMM, HH:mm", { locale: de })}
                  </span>
                  <span className="whitespace-pre-wrap">{entry.body}</span>
                </li>
              ))}
            </ul>
            {canEdit ? (
              <form
                className="flex gap-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (!comment.trim()) return;
                  setSending(true);
                  if (await onComment(comment)) setComment("");
                  setSending(false);
                }}
              >
                <input
                  className={cn(inputClass, "h-11 flex-1")}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Kommentar schreiben"
                  aria-label="Kommentar"
                />
                <AsyncButton type="submit" variant="outline" className="h-11" isLoading={sending}>
                  Senden
                </AsyncButton>
              </form>
            ) : null}
          </section>
        ) : null}
      </ResponsivePanel>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Aufgabe löschen?"
        description="Die Aufgabe und ihre Kommentare werden entfernt."
        confirmLabel="Löschen"
        cancelLabel="Abbrechen"
        variant="destructive"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false);
          if (await onDelete()) onOpenChange(false);
        }}
      />
    </>
  );
}

function fromTask(task: BoardTask | null, columnId: string): TaskDraft {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    dueAt: toDateInput(task?.dueAt ?? null),
    priority: task?.priority ?? "normal",
    assigneeIds: task?.assignees.map((person) => person.id) ?? [],
    columnId: task?.columnId ?? columnId,
  };
}

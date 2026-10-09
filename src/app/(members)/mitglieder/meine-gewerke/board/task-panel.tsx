"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { de } from "date-fns/locale/de";
import type { TaskPriority } from "@prisma/client";

import { ChevronDownIcon, TrashIcon } from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { BoardColumn, BoardMilestone, BoardPerson, BoardTask } from "@/lib/departments/board";
import { cn } from "@/lib/utils";

import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { TaskWork, type WorkPermissions } from "../handover/task-work";
import { PRIORITY_LABELS, toDateInput } from "./shared";

export type TaskDraft = {
  title: string;
  description: string;
  dueAt: string;
  milestoneId: string;
  priority: TaskPriority;
  assigneeIds: string[];
  columnId: string;
  /** Nur beim Anlegen: Schritte, eine Zeile je Schritt. */
  steps: string;
};

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm";

export function TaskPanel({
  open,
  onOpenChange,
  task,
  columns,
  members,
  milestones,
  initialMilestoneId,
  initialColumnId,
  canEdit,
  canDelete,
  onSave,
  onDelete,
  objectHref,
  perms,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` = neue Aufgabe. */
  task: BoardTask | null;
  columns: BoardColumn[];
  members: BoardPerson[];
  milestones: BoardMilestone[];
  /** Vorbelegung für neue Karten, z. B. „+ Karte“ aus dem Plan. */
  initialMilestoneId?: string | null;
  initialColumnId: string;
  canEdit: boolean;
  canDelete: boolean;
  onSave: (draft: TaskDraft) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  /** Karte eines Ausstattungsstücks: Link zur Objekt-Seite. */
  objectHref?: string | null;
  perms: WorkPermissions;
}) {
  const [draft, setDraft] = React.useState<TaskDraft>(() =>
    fromTask(task, initialColumnId, initialMilestoneId),
  );
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [key, setKey] = React.useState(`${task?.id ?? "new"}-${open}`);
  const nextKey = `${task?.id ?? "new"}-${open}`;
  // Beim Öffnen einer anderen Aufgabe den Entwurf neu setzen (ohne Effekt).
  if (key !== nextKey) {
    setKey(nextKey);
    setDraft(fromTask(task, initialColumnId, initialMilestoneId));
    setDetailsOpen(false);
  }
  const [saving, setSaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

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
        title={task ? task.title : "Neue Aufgabe"}
        description="Aufgabe bearbeiten"
        footer={
          canEdit && (!task || detailsOpen) ? (
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
        {objectHref ? (
          <Link
            href={objectHref}
            className="mb-3 flex min-h-10 items-center justify-between gap-2 rounded-lg px-1 text-sm font-medium text-primary hover:underline"
          >
            Ausstattungsstück öffnen – Fotos, Szenen
            <span aria-hidden>→</span>
          </Link>
        ) : null}
        {task ? (
          <div className="mb-4">
            <TaskWork work={task.work} perms={perms} />
          </div>
        ) : (
          <div className="mb-4 space-y-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Was ist zu tun?</span>
              <input
                className={cn(inputClass, "h-11")}
                value={draft.title}
                maxLength={160}
                autoFocus
                onChange={(event) => update("title", event.target.value)}
                placeholder="z. B. Laterne bauen"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                Schritte (optional, einer pro Zeile)
              </span>
              <textarea
                className={cn(inputClass, "min-h-28 py-2")}
                value={draft.steps}
                onChange={(event) => update("steps", event.target.value)}
                placeholder={"Material besorgen\nzuschneiden\nbemalen"}
              />
            </label>
          </div>
        )}
        <button
          type="button"
          onClick={() => setDetailsOpen((value) => !value)}
          aria-expanded={detailsOpen}
          className="flex min-h-11 w-full items-center gap-2 border-t border-border text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Details
          <span className="truncate text-xs font-normal">
            {[
              draft.dueAt ? "Frist" : null,
              draft.assigneeIds.length ? `${draft.assigneeIds.length} zuständig` : null,
              draft.milestoneId ? "Meilenstein" : null,
              draft.description ? "Beschreibung" : null,
            ]
              .filter(Boolean)
              .join(" · ") || "Frist, Zuständig, Meilenstein, Beschreibung"}
          </span>
          <ChevronDownIcon
            className={cn(
              "ml-auto h-4 w-4 shrink-0 transition-transform",
              detailsOpen && "rotate-180",
            )}
          />
        </button>
        {detailsOpen ? (
          <fieldset disabled={!canEdit} className="space-y-4 pt-2">
            {task ? (
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Titel</span>
                <input
                  className={cn(inputClass, "h-11")}
                  value={draft.title}
                  maxLength={160}
                  onChange={(event) => update("title", event.target.value)}
                  placeholder="Was ist zu tun?"
                />
              </label>
            ) : null}

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

            {milestones.length ? (
              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                  Gehört zu Meilenstein
                </span>
                <select
                  className={cn(inputClass, "h-11")}
                  value={draft.milestoneId}
                  onChange={(event) => update("milestoneId", event.target.value)}
                >
                  <option value="">Keiner</option>
                  {[true, false].map((own) => {
                    const group = milestones.filter((milestone) => milestone.own === own);
                    if (!group.length) return null;
                    return (
                      <optgroup
                        key={String(own)}
                        label={own ? "Dieses Gewerk" : "Andere Gewerke & Produktion"}
                      >
                        {group.map((milestone) => (
                          <option key={milestone.id} value={milestone.id}>
                            {milestone.title}
                            {!own && milestone.departmentName
                              ? ` (${milestone.departmentName})`
                              : ""}
                            {milestone.dueAt
                              ? ` · ${format(new Date(`${milestone.dueAt.slice(0, 10)}T12:00:00`), "d. MMM", { locale: de })}`
                              : ""}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
                {draft.milestoneId && !draft.dueAt ? (
                  <span className="block text-xs text-muted-foreground">
                    Ohne eigenes Datum gilt die Frist des Meilensteins.
                  </span>
                ) : null}
              </label>
            ) : null}

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

function fromTask(
  task: BoardTask | null,
  columnId: string,
  milestoneId?: string | null,
): TaskDraft {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    dueAt: toDateInput(task?.dueAt ?? null),
    milestoneId: task ? (task.milestone?.id ?? "") : (milestoneId ?? ""),
    priority: task?.priority ?? "normal",
    assigneeIds: task?.assignees.map((person) => person.id) ?? [],
    columnId: task?.columnId ?? columnId,
    steps: "",
  };
}

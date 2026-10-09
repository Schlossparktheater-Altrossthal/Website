"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { format } from "date-fns";
import { de } from "date-fns/locale/de";

import {
  AlertTriangleIcon,
  PlusIcon,
  SettingsIcon,
  WrenchIcon,
} from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { OBJECT_KIND_LABELS } from "@/lib/ausstattung/constants";
import { orderSteps, splitSteps } from "@/lib/departments/activity-format";
import type { BoardColumn, BoardData, BoardTask } from "@/lib/departments/board";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";

import {
  createBoardColumnAction,
  createBoardTaskAction,
  deleteBoardColumnAction,
  deleteBoardTaskAction,
  moveBoardColumnAction,
  moveBoardTaskAction,
  updateBoardColumnAction,
  updateBoardTaskAction,
} from "../board-actions";
import { toggleStepAction } from "../handover-actions";
import { ColumnsPanel } from "./columns-panel";
import type { ActionResult } from "./shared";
import { toDateInput } from "./shared";
import { TaskPanel, type TaskDraft } from "./task-panel";

type Props = {
  data: BoardData;
  viewerId: string;
  canEdit: boolean;
  canManage: boolean;
  /** Aus dem Plan: diese Karte direkt öffnen (`?karte=`). */
  initialTaskId?: string | null;
  /** Aus dem Plan: neue Karte für diesen Meilenstein anlegen (`?neu=1&meilenstein=`). */
  newForMilestoneId?: string | null;
  /** Portal-Pfad für Links zu Ausstattungsstücken (`…/objekt/:id`). */
  basePath?: string;
};

const ALL = "__all";
const WITHOUT = "__none";

export function DepartmentBoard({
  data,
  viewerId,
  canEdit,
  canManage,
  initialTaskId,
  newForMilestoneId,
  basePath,
}: Props) {
  const router = useRouter();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [columns, setColumns] = React.useState(data.columns);
  const [source, setSource] = React.useState(data.columns);
  // Neue Serverdaten übernehmen (ohne Effekt).
  if (source !== data.columns) {
    setSource(data.columns);
    setColumns(data.columns);
  }
  const [activeColumnId, setActiveColumnId] = React.useState(data.columns[0]?.id ?? "");
  const [openTask, setOpenTask] = React.useState<{
    task: BoardTask | null;
    columnId: string;
  } | null>(() => {
    if (initialTaskId) {
      const column = data.columns.find((entry) =>
        entry.tasks.some((task) => task.id === initialTaskId),
      );
      const task = column?.tasks.find((entry) => entry.id === initialTaskId);
      if (column && task) return { task, columnId: column.id };
    }
    if (newForMilestoneId && canEdit) return { task: null, columnId: data.columns[0]?.id ?? "" };
    return null;
  });
  const [milestoneFilter, setMilestoneFilter] = React.useState(ALL);
  const [columnsOpen, setColumnsOpen] = React.useState(false);
  const [dragging, setDragging] = React.useState<BoardTask | null>(null);
  const [onlyMine, setOnlyMine] = React.useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const run = async (action: () => Promise<ActionResult>, success?: string) => {
    const result = await action();
    if (!result.ok) {
      toast.error("Das hat nicht geklappt", { description: result.error, duration: 5000 });
      setColumns(data.columns);
      return false;
    }
    if (success) toast.success(success, { duration: 3000 });
    router.refresh();
    return true;
  };

  const visibleTasks = (column: BoardColumn) =>
    column.tasks.filter(
      (task) =>
        (!onlyMine || task.assignees.some((person) => person.id === viewerId)) &&
        (milestoneFilter === ALL ||
          (milestoneFilter === WITHOUT ? !task.milestone : task.milestone?.id === milestoneFilter)),
    );
  // Nur Meilensteine anbieten, an denen hier wirklich Karten hängen.
  const usedMilestones = data.milestones.filter((milestone) =>
    data.columns.some((column) => column.tasks.some((task) => task.milestone?.id === milestone.id)),
  );

  const moveLocal = (taskId: string, columnId: string, index: number) => {
    setColumns((current) => {
      const task = current.flatMap((column) => column.tasks).find((entry) => entry.id === taskId);
      if (!task) return current;
      return current.map((column) => {
        const rest = column.tasks.filter((entry) => entry.id !== taskId);
        if (column.id !== columnId) return { ...column, tasks: rest };
        const next = [...rest];
        next.splice(Math.min(index, next.length), 0, { ...task, columnId });
        return { ...column, tasks: next };
      });
    });
  };

  /** Nächsten Schritt direkt auf der Kachel abhaken (sofort sichtbar). */
  const checkStep = (taskId: string, stepId: string) => {
    setColumns((current) =>
      current.map((column) => ({
        ...column,
        tasks: column.tasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                work: {
                  ...task.work,
                  steps: task.work.steps.map((step) =>
                    step.id === stepId
                      ? {
                          ...step,
                          done: true,
                          doneById: viewerId,
                          doneAt: new Date().toISOString(),
                        }
                      : step,
                  ),
                },
              }
            : task,
        ),
      })),
    );
    void run(() => toggleStepAction({ itemId: stepId, done: true }));
  };

  const moveTask = (taskId: string, columnId: string, index: number) => {
    moveLocal(taskId, columnId, index);
    void run(() => moveBoardTaskAction({ taskId, columnId, index }));
  };

  const onDragStart = (event: DragStartEvent) => {
    const task = columns.flatMap((column) => column.tasks).find((t) => t.id === event.active.id);
    setDragging(task ?? null);
  };

  const onDragEnd = (event: DragEndEvent) => {
    setDragging(null);
    const over = event.over?.id ? String(event.over.id) : null;
    if (!over) return;
    const taskId = String(event.active.id);
    const targetColumn = columns.find((column) => column.id === over);
    if (targetColumn) {
      moveTask(taskId, targetColumn.id, targetColumn.tasks.filter((t) => t.id !== taskId).length);
      return;
    }
    const column = columns.find((entry) => entry.tasks.some((task) => task.id === over));
    if (!column || over === taskId) return;
    const index = column.tasks.filter((t) => t.id !== taskId).findIndex((t) => t.id === over);
    moveTask(taskId, column.id, Math.max(index, 0));
  };

  const saveTask = async (draft: TaskDraft) => {
    const fields = {
      title: draft.title,
      description: draft.description || null,
      dueAt: draft.dueAt || null,
      milestoneId: draft.milestoneId || null,
      priority: draft.priority,
      assigneeIds: draft.assigneeIds,
    };
    const current = openTask?.task;
    if (!current) {
      return run(
        () =>
          createBoardTaskAction({
            departmentId: data.departmentId,
            columnId: draft.columnId,
            steps: splitSteps(draft.steps),
            ...fields,
          }),
        "Aufgabe angelegt",
      );
    }
    const ok = await run(() => updateBoardTaskAction({ taskId: current.id, ...fields }));
    if (ok && draft.columnId !== current.columnId) {
      const target = columns.find((column) => column.id === draft.columnId);
      await run(() =>
        moveBoardTaskAction({
          taskId: current.id,
          columnId: draft.columnId,
          index: target?.tasks.length ?? 0,
        }),
      );
    }
    if (ok) toast.success("Gespeichert", { duration: 3000 });
    return ok;
  };

  const liveTask = openTask?.task
    ? (columns.flatMap((column) => column.tasks).find((task) => task.id === openTask.task?.id) ??
      openTask.task)
    : null;
  const activeColumn = columns.find((column) => column.id === activeColumnId) ?? columns[0];
  const mineCount = columns
    .flatMap((column) => column.tasks)
    .filter((task) => task.assignees.some((person) => person.id === viewerId)).length;

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => setOnlyMine((value) => !value)}
        aria-pressed={onlyMine}
        className={cn(
          "h-9 rounded-full border px-3 text-sm",
          onlyMine
            ? "border-primary bg-primary/10 font-medium text-primary"
            : "border-border text-muted-foreground",
        )}
      >
        Nur meine ({mineCount})
      </button>
      {usedMilestones.length ? (
        <select
          aria-label="Nach Meilenstein filtern"
          value={milestoneFilter}
          onChange={(event) => setMilestoneFilter(event.target.value)}
          className={cn(
            "h-9 min-w-0 max-w-48 truncate rounded-full border bg-background px-3 text-sm",
            milestoneFilter !== ALL
              ? "border-primary font-medium text-primary"
              : "border-border text-muted-foreground",
          )}
        >
          <option value={ALL}>Alle Meilensteine</option>
          {usedMilestones.map((milestone) => (
            <option key={milestone.id} value={milestone.id}>
              {milestone.title}
            </option>
          ))}
          <option value={WITHOUT}>Ohne Meilenstein</option>
        </select>
      ) : null}
      <div className="ml-auto flex items-center gap-2">
        {canManage ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            aria-label="Spalten anpassen"
            onClick={() => setColumnsOpen(true)}
          >
            <SettingsIcon />
          </Button>
        ) : null}
        {canEdit ? (
          <Button
            type="button"
            size="sm"
            className="h-10"
            onClick={() =>
              setOpenTask({ task: null, columnId: activeColumn?.id ?? columns[0]?.id ?? "" })
            }
          >
            <PlusIcon /> Aufgabe
          </Button>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {toolbar}

      {isDesktop ? (
        <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          {/* Viele Spalten scrollen innerhalb des Boards, nicht die ganze Seite (Tablet quer). */}
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(13.5rem, 1fr))` }}
            >
              {columns.map((column) => (
                <ColumnDrop key={column.id} column={column} count={visibleTasks(column).length}>
                  {visibleTasks(column).map((task) => (
                    <DraggableCard
                      key={task.id}
                      task={task}
                      today={data.today}
                      draggable={canEdit}
                      onOpen={() => setOpenTask({ task, columnId: column.id })}
                      onCheck={canEdit ? (stepId) => checkStep(task.id, stepId) : undefined}
                    />
                  ))}
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => setOpenTask({ task: null, columnId: column.id })}
                      className="flex h-10 w-full items-center justify-center gap-1 rounded-lg text-sm text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    >
                      <PlusIcon className="h-4 w-4" /> Hinzufügen
                    </button>
                  ) : null}
                </ColumnDrop>
              ))}
            </div>
          </div>
          <DragOverlay>
            {dragging ? <TaskCard task={dragging} today={data.today} lifted /> : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="space-y-3">
          <div
            role="tablist"
            aria-label="Spalten"
            className="grid gap-1 rounded-lg bg-muted/70 p-0.5"
            style={{
              gridTemplateColumns: `repeat(${Math.min(columns.length, 4)}, minmax(0, 1fr))`,
            }}
          >
            {columns.map((column) => {
              const active = column.id === activeColumn?.id;
              return (
                <button
                  key={column.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveColumnId(column.id)}
                  className={cn(
                    "flex h-11 flex-col items-center justify-center rounded-md px-1 text-xs leading-tight",
                    active
                      ? "bg-background font-medium text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground",
                  )}
                >
                  <span className="max-w-full truncate">{column.name}</span>
                  <span className="text-[11px] opacity-80">{visibleTasks(column).length}</span>
                </button>
              );
            })}
          </div>
          {activeColumn ? (
            <ul className="space-y-2" aria-label={activeColumn.name}>
              {visibleTasks(activeColumn).map((task) => (
                <li key={task.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    className="block w-full cursor-pointer text-left"
                    onClick={() => setOpenTask({ task, columnId: activeColumn.id })}
                    onKeyDown={(event) =>
                      event.key === "Enter" && setOpenTask({ task, columnId: activeColumn.id })
                    }
                  >
                    <TaskCard
                      task={task}
                      today={data.today}
                      onCheck={canEdit ? (stepId) => checkStep(task.id, stepId) : undefined}
                    />
                  </div>
                </li>
              ))}
              {visibleTasks(activeColumn).length === 0 ? (
                <li className="py-10 text-center text-sm text-muted-foreground">
                  Keine Aufgaben in „{activeColumn.name}“.
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>
      )}

      <TaskPanel
        open={Boolean(openTask)}
        onOpenChange={(value) => !value && setOpenTask(null)}
        task={liveTask}
        columns={columns}
        members={data.members}
        milestones={data.milestones}
        initialMilestoneId={newForMilestoneId ?? null}
        initialColumnId={openTask?.columnId ?? columns[0]?.id ?? ""}
        canEdit={canEdit}
        canDelete={
          !liveTask?.object && (canManage || (canEdit && liveTask?.createdById === viewerId))
        }
        objectHref={
          liveTask?.object && basePath ? `${basePath}/objekt/${liveTask.object.id}` : null
        }
        perms={{
          viewerId,
          canEdit,
          canManage,
          canEditCaution: data.canEditNotes,
          stepUndo: data.stepUndo,
        }}
        onSave={saveTask}
        onDelete={() =>
          liveTask
            ? run(() => deleteBoardTaskAction({ taskId: liveTask.id }), "Aufgabe gelöscht")
            : Promise.resolve(false)
        }
      />

      {canManage ? (
        <ColumnsPanel
          open={columnsOpen}
          onOpenChange={setColumnsOpen}
          columns={columns}
          onRename={(column, name, status) =>
            void run(() => updateBoardColumnAction({ columnId: column.id, name, status }))
          }
          onMove={(column, direction) =>
            void run(() => moveBoardColumnAction({ columnId: column.id, direction }))
          }
          onDelete={(column) =>
            void run(() => deleteBoardColumnAction({ columnId: column.id }), "Spalte gelöscht")
          }
          onCreate={(name) =>
            void run(() =>
              createBoardColumnAction({ departmentId: data.departmentId, name, status: "doing" }),
            )
          }
        />
      ) : null}
    </div>
  );
}

function ColumnDrop({
  column,
  count,
  children,
}: {
  column: BoardColumn;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  return (
    <section
      ref={setNodeRef}
      aria-label={column.name}
      className={cn(
        "flex min-h-40 flex-col gap-2 rounded-xl bg-muted/50 p-2 transition-colors",
        isOver && "bg-primary/10 ring-2 ring-primary/40",
      )}
    >
      <header className="flex items-center justify-between px-1 pt-0.5">
        <h3 className="text-sm font-semibold">{column.name}</h3>
        <span className="text-xs text-muted-foreground">{count}</span>
      </header>
      {children}
    </section>
  );
}

function DraggableCard({
  task,
  today,
  draggable,
  onOpen,
  onCheck,
}: {
  task: BoardTask;
  today: string;
  draggable: boolean;
  onOpen: () => void;
  onCheck?: (stepId: string) => void;
}) {
  const drag = useDraggable({ id: task.id, disabled: !draggable });
  const drop = useDroppable({ id: task.id });
  return (
    <div
      ref={(node) => {
        drag.setNodeRef(node);
        drop.setNodeRef(node);
      }}
      className={cn(
        drag.isDragging && "opacity-30",
        drop.isOver && !drag.isDragging && "border-t-2 border-primary pt-1",
      )}
    >
      <div
        {...drag.listeners}
        {...drag.attributes}
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(event) => event.key === "Enter" && onOpen()}
        className="block w-full cursor-grab text-left active:cursor-grabbing"
      >
        <TaskCard task={task} today={today} onCheck={onCheck} />
      </div>
    </div>
  );
}

function TaskCard({
  task,
  today,
  lifted,
  onCheck,
}: {
  task: BoardTask;
  today: string;
  lifted?: boolean;
  onCheck?: (stepId: string) => void;
}) {
  const steps = task.work.steps;
  const nextStep = orderSteps(steps).find((step) => !step.done);
  const doneCount = steps.filter((step) => step.done).length;
  // Ohne eigene Frist erbt die Karte die Frist ihres Meilensteins (Kettensymbol).
  const inherited = !task.dueAt && Boolean(task.milestone?.dueAt);
  const dueIso = task.dueAt ?? task.milestone?.dueAt ?? null;
  const due = inherited ? (dueIso?.slice(0, 10) ?? "") : toDateInput(dueIso);
  const overdue = Boolean(due && due < today);
  return (
    <span
      className={cn(
        "block space-y-1.5 rounded-lg border border-border bg-card px-3 py-2.5 shadow-sm",
        task.priority === "high" && "border-l-4 border-l-destructive",
        lifted && "rotate-1 shadow-lg",
      )}
    >
      <span className="flex items-start gap-1.5">
        <span className="min-w-0 flex-1 text-sm font-medium leading-snug">{task.title}</span>
        {task.hasNews ? (
          <span
            className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary"
            title="Neu seit deinem letzten Besuch"
            aria-label="neu"
          />
        ) : null}
      </span>
      {task.handover.caution ? (
        <span className="flex items-start gap-1 rounded-md bg-warning/15 px-2 py-1 text-xs text-warning-foreground">
          <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="line-clamp-2">{task.handover.caution.text}</span>
        </span>
      ) : null}
      {nextStep ? (
        <span className="flex items-center gap-1.5">
          {onCheck ? (
            <button
              type="button"
              aria-label={`„${nextStep.text}“ abhaken`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                onCheck(nextStep.id);
              }}
              className="-my-1 -ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-primary/10"
            >
              <span className="h-5 w-5 rounded-full border-2 border-primary" />
            </button>
          ) : (
            <span className="h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/50" />
          )}
          <span className="line-clamp-2 min-w-0 flex-1 text-xs">{nextStep.text}</span>
        </span>
      ) : null}
      {steps.length ? (
        <span className="flex items-center gap-2">
          <span className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-success"
              style={{ width: `${(doneCount / steps.length) * 100}%` }}
            />
          </span>
          <span
            className={cn(
              "text-[11px] tabular-nums text-muted-foreground",
              doneCount === steps.length && "text-success",
            )}
          >
            {doneCount}/{steps.length}
          </span>
        </span>
      ) : null}
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {dueIso ? (
          <span
            className={cn(
              "inline-flex items-center gap-1",
              overdue && "font-medium text-destructive",
            )}
            title={inherited ? `Frist vom Meilenstein „${task.milestone?.title}“` : undefined}
          >
            {inherited ? <ChainIcon /> : null}
            {overdue ? "überfällig · " : ""}
            {format(new Date(`${due}T12:00:00`), "d. MMM", { locale: de })}
          </span>
        ) : null}
        {task.milestone ? (
          <span className="max-w-full truncate rounded-full bg-primary/10 px-2 py-0.5 text-primary">
            {task.milestone.title}
          </span>
        ) : null}
        {task.priority === "high" ? <span className="text-destructive">Hoch</span> : null}
        {task.handover.claim ? (
          <span className="inline-flex items-center gap-1 font-medium text-info">
            <WrenchIcon className="h-3 w-3" />
            {task.handover.claim.name.split(" ")[0]} dran
          </span>
        ) : null}
        {task.assignees.length ? (
          <span className="truncate">
            {task.assignees.map((person) => person.name.split(" ")[0]).join(", ")}
          </span>
        ) : null}
        {task.comments.length ? (
          <span>
            {task.comments.length} Kommentar{task.comments.length === 1 ? "" : "e"}
          </span>
        ) : null}
      </span>
      {task.object ? (
        <span className="flex flex-wrap items-center gap-1 text-xs">
          <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
            {OBJECT_KIND_LABELS[task.object.kind]}
          </span>
          {task.object.scenes.length ? (
            <span className="rounded-full bg-muted px-2 py-0.5 tabular-nums text-muted-foreground">
              Sz. {task.object.scenes.join(" · ")}
            </span>
          ) : null}
          {!dueIso && task.object.nextRehearsal ? (
            <span className="text-muted-foreground">
              Probe {format(new Date(task.object.nextRehearsal), "d. MMM", { locale: de })}
            </span>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}

function ChainIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3 w-3"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
    </svg>
  );
}

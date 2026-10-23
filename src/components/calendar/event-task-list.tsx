"use client";

import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { setEventTaskDoneAction } from "@/app/(members)/mitglieder/termine/task-actions";
import { DEFAULT_TIME_ZONE } from "@/lib/format/date";
import type { MyTask } from "@/lib/calendar/my-tasks";
import { cn } from "@/lib/utils";

const DUE = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  timeZone: DEFAULT_TIME_ZONE,
});

/** Aufgaben aus Probenprotokollen zum Abhaken (Dashboard und Terminseite). */
export function EventTaskList({
  tasks,
  showEvent = true,
}: {
  tasks: MyTask[];
  /** Link auf die Probe zeigen (aus, wenn die Liste schon auf der Terminseite steht). */
  showEvent?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [optimistic, setDone] = useOptimistic(
    tasks,
    (current, change: { id: string; done: boolean; all: boolean }) =>
      current.map((task) =>
        task.id === change.id
          ? {
              ...task,
              doneAt: change.done ? new Date().toISOString() : null,
              othersOpen: change.all ? 0 : task.othersOpen,
            }
          : task,
      ),
  );

  const setTask = (task: MyTask, done: boolean, all: boolean) =>
    startTransition(async () => {
      setDone({ id: task.id, done, all });
      const result = await setEventTaskDoneAction({
        noteId: task.id,
        done,
        scope: all ? "all" : "mine",
      });
      if (!result.ok)
        toast.error("Nicht gespeichert", { description: result.error, duration: 5000 });
      else if (done) toast.success(all ? "Für alle erledigt" : "Erledigt", { duration: 3000 });
    });
  const toggle = (task: MyTask) => setTask(task, !task.doneAt, false);

  return (
    <ul className="divide-y divide-border" aria-busy={pending}>
      {optimistic.map((task) => (
        <li key={task.id} className="flex items-start gap-3 px-3 py-2">
          <Checkbox
            checked={!!task.doneAt}
            onCheckedChange={() => toggle(task)}
            aria-label={`${task.text} erledigt`}
            className="mt-0.5"
          />
          <div className="min-w-0 flex-1">
            <p className={cn("text-sm", task.doneAt && "text-muted-foreground line-through")}>
              {task.text}
            </p>
            <p className="text-xs text-muted-foreground">
              {[
                task.dueAt ? `bis ${DUE.format(new Date(`${task.dueAt}T12:00:00Z`))}` : null,
                task.via ? `als ${task.via}` : null,
                task.others
                  ? task.othersOpen
                    ? `mit ${task.others} weiteren, ${task.othersOpen} offen`
                    : `mit ${task.others} weiteren, alle erledigt`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              {showEvent ? (
                <>
                  {task.dueAt || task.via || task.others ? " · " : ""}
                  <Link
                    href={`/mitglieder/termine/${task.eventId}?ansicht=protokoll`}
                    className="hover:underline"
                  >
                    {task.eventTitle}
                  </Link>
                </>
              ) : null}
            </p>
          </div>
          {task.othersOpen ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 text-xs"
              onClick={() => setTask(task, true, true)}
            >
              Für alle erledigt
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

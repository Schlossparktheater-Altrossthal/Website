"use client";

import * as React from "react";
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  ChevronDownIcon,
  ChevronUpIcon,
  EditIcon,
  GripVerticalIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { RolesScenesData, RsAct, RsScene } from "@/lib/produktionen/roles-scenes";
import { cn } from "@/lib/utils";

import { deleteActAction, reorderScenesAction, saveActAction } from "../actions/roles-scenes";
import { formatMinutes, inputClass, SceneRow, useRun } from "./ui";

const ACT_PREFIX = "act:";

type Order = { id: string; act: number }[];

/** Szenen in Aktreihenfolge; Akt-Wechsel beim Verschieben über die Aktgrenze. */
function moveScene(scenes: RsScene[], acts: RsAct[], id: string, direction: -1 | 1): Order | null {
  const order: Order = scenes.map((scene) => ({ id: scene.id, act: scene.act }));
  const index = order.findIndex((entry) => entry.id === id);
  if (index < 0) return null;
  const current = order[index];
  const neighbour = order[index + direction];
  if (neighbour && neighbour.act === current.act) {
    order[index] = neighbour;
    order[index + direction] = current;
    return order;
  }
  // Am Rand des Akts: in den Nachbarakt wechseln (ans Ende bzw. an den Anfang).
  const actIndex = acts.findIndex((act) => act.number === current.act);
  const target = acts[actIndex + direction];
  if (!target) return null;
  order[index] = { ...current, act: target.number };
  return order;
}

export function AblaufView({
  data,
  scenes,
  onOpenScene,
  onNewScene,
}: {
  data: RolesScenesData;
  /** Gefilterte Szenen (Suche); Umsortieren nur ohne Filter. */
  scenes: RsScene[];
  onOpenScene: (id: string) => void;
  onNewScene: (act: number) => void;
}) {
  const run = useRun();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const filtered = scenes.length !== data.scenes.length;
  // Optimistische Reihenfolge bis zum Neuladen.
  const [pending, setPending] = React.useState<Order | null>(null);
  const [lastData, setLastData] = React.useState(data);
  if (lastData !== data) {
    setLastData(data);
    setPending(null);
  }

  const ordered = pending
    ? pending.flatMap((entry) => {
        const scene = scenes.find((item) => item.id === entry.id);
        return scene ? [{ ...scene, act: entry.act }] : [];
      })
    : scenes;

  const reorder = async (order: Order) => {
    setPending(order);
    const ok = await run(() => reorderScenesAction({ showId: data.showId, order }));
    if (!ok) setPending(null);
  };

  const totalMinutes = ordered.reduce((sum, scene) => sum + (scene.durationMinutes ?? 0), 0);
  const nextAct = (data.acts.at(-1)?.number ?? 0) + 1;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const ids = data.acts.flatMap((act) => [
    `${ACT_PREFIX}${act.number}`,
    ...ordered.filter((scene) => scene.act === act.number).map((scene) => scene.id),
  ]);
  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const next = arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
    if (!next[0]?.startsWith(ACT_PREFIX)) return;
    let act = data.acts[0]?.number ?? 1;
    const order: Order = [];
    for (const id of next) {
      if (id.startsWith(ACT_PREFIX)) act = Number(id.slice(ACT_PREFIX.length));
      else order.push({ id, act });
    }
    void reorder(order);
  };

  const canSort = !filtered;
  const content = (
    <div className="space-y-5">
      {data.acts.map((act) => {
        const actScenes = ordered.filter((scene) => scene.act === act.number);
        const minutes = actScenes.reduce((sum, scene) => sum + (scene.durationMinutes ?? 0), 0);
        if (filtered && !actScenes.length) return null;
        return (
          <section key={act.number} className="space-y-2" aria-label={`Akt ${act.number}`}>
            <ActHeader
              act={act}
              sortId={`${ACT_PREFIX}${act.number}`}
              sortable={canSort && isDesktop}
              summary={`${actScenes.length} ${actScenes.length === 1 ? "Szene" : "Szenen"}${
                minutes ? ` · ${formatMinutes(minutes)}` : ""
              }`}
              onRename={(title) =>
                run(() => saveActAction({ showId: data.showId, number: act.number, title }))
              }
              onDelete={
                actScenes.length || data.acts.length === 1
                  ? undefined
                  : () =>
                      run(
                        () => deleteActAction({ showId: data.showId, number: act.number }),
                        "Akt entfernt",
                      )
              }
            />
            <ul className="space-y-2">
              {actScenes.map((scene) => (
                <SortableScene
                  key={scene.id}
                  scene={scene}
                  data={data}
                  draggable={canSort && isDesktop}
                  onOpen={() => onOpenScene(scene.id)}
                  controls={
                    canSort && !isDesktop ? (
                      <MoveButtons
                        onMove={(direction) => {
                          const order = moveScene(ordered, data.acts, scene.id, direction);
                          if (order) void reorder(order);
                        }}
                      />
                    ) : undefined
                  }
                />
              ))}
            </ul>
            {!filtered ? (
              <Button
                type="button"
                variant="ghost"
                className="h-10 w-full justify-start text-muted-foreground"
                onClick={() => onNewScene(act.number)}
              >
                <PlusIcon className="h-4 w-4" aria-hidden />
                Szene in Akt {act.number}
              </Button>
            ) : null}
          </section>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {ordered.length} {ordered.length === 1 ? "Szene" : "Szenen"} in {data.acts.length}{" "}
        {data.acts.length === 1 ? "Akt" : "Akten"}
        {totalMinutes ? ` · ${formatMinutes(totalMinutes)} Spielzeit` : ""}
        {canSort
          ? isDesktop
            ? " · Szenen zum Umsortieren ziehen"
            : " · Mit den Pfeilen umsortieren"
          : ""}
      </p>
      {canSort && isDesktop ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            {content}
          </SortableContext>
        </DndContext>
      ) : (
        content
      )}
      {!filtered ? (
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full"
          onClick={() =>
            run(
              () => saveActAction({ showId: data.showId, number: nextAct }),
              `Akt ${nextAct} angelegt`,
            )
          }
        >
          <PlusIcon className="h-4 w-4" aria-hidden />
          Akt {nextAct} anlegen
        </Button>
      ) : null}
    </div>
  );
}

function ActHeader({
  act,
  sortId,
  sortable,
  summary,
  onRename,
  onDelete,
}: {
  act: RsAct;
  sortId: string;
  sortable: boolean;
  summary: string;
  onRename: (title: string) => Promise<boolean>;
  onDelete?: () => Promise<boolean>;
}) {
  // Kopfzeilen sind feste Anker in der Sortierliste (nicht ziehbar).
  const { setNodeRef } = useSortable({ id: sortId, disabled: true });
  const [editing, setEditing] = React.useState(false);
  const [title, setTitle] = React.useState(act.title ?? "");

  return (
    <div ref={sortable ? setNodeRef : undefined} className="flex min-h-11 items-center gap-2">
      {editing ? (
        <form
          className="flex flex-1 gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (await onRename(title)) setEditing(false);
          }}
        >
          <input
            className={cn(inputClass, "h-10")}
            value={title}
            maxLength={80}
            autoFocus
            placeholder={`Titel für Akt ${act.number} (optional)`}
            onChange={(event) => setTitle(event.target.value)}
          />
          <Button type="submit" className="h-10">
            OK
          </Button>
        </form>
      ) : (
        <>
          <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
            Akt {act.number}
            {act.title ? <span className="font-normal"> – {act.title}</span> : null}
            <span className="ml-2 text-xs font-normal text-muted-foreground">{summary}</span>
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            aria-label={`Akt ${act.number} umbenennen`}
            onClick={() => setEditing(true)}
          >
            <EditIcon className="h-4 w-4" />
          </Button>
          {onDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              aria-label={`Akt ${act.number} entfernen`}
              onClick={() => void onDelete()}
            >
              <TrashIcon className="h-4 w-4" />
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}

function SortableScene({
  scene,
  data,
  draggable,
  onOpen,
  controls,
}: {
  scene: RsScene;
  data: RolesScenesData;
  draggable: boolean;
  onOpen: () => void;
  controls?: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: scene.id,
    disabled: !draggable,
  });
  return (
    <li
      ref={draggable ? setNodeRef : undefined}
      style={draggable ? { transform: CSS.Transform.toString(transform), transition } : undefined}
      className={cn("min-w-0", isDragging && "relative z-10 opacity-80 shadow-lg")}
    >
      <SceneRow
        scene={scene}
        data={data}
        onOpen={onOpen}
        controls={controls}
        dragHandle={
          draggable ? (
            <button
              type="button"
              aria-label={`Szene ${scene.identifier ?? ""} verschieben`}
              className="flex w-8 shrink-0 cursor-grab items-center justify-center rounded-l-xl text-muted-foreground hover:bg-muted/60 active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <GripVerticalIcon className="h-4 w-4" />
            </button>
          ) : undefined
        }
      />
    </li>
  );
}

function MoveButtons({ onMove }: { onMove: (direction: -1 | 1) => void }) {
  return (
    <div className="flex shrink-0 flex-col border-l border-border/60">
      <button
        type="button"
        aria-label="Nach oben"
        className="flex flex-1 items-center justify-center px-3 text-muted-foreground hover:bg-muted/60"
        onClick={() => onMove(-1)}
      >
        <ChevronUpIcon className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="Nach unten"
        className="flex flex-1 items-center justify-center border-t border-border/60 px-3 text-muted-foreground hover:bg-muted/60"
        onClick={() => onMove(1)}
      >
        <ChevronDownIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";

import { CheckIcon, PrinterIcon, RefreshCwIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { ObjectListItem, StageData, StageScene } from "@/lib/ausstattung/objects";
import { cn } from "@/lib/utils";

import { resetChecksAction, setObjectCheckedAction } from "../ausstattung-actions";
import { EmptyState, StatusDot, fullScene, useAction } from "./shared";

/** Requisiten je Szene in Spielreihenfolge: was liegt wo, wer braucht es. Druckbar. */
export function PropsRunsheet({
  objects,
  stage,
  basePath,
}: {
  objects: ObjectListItem[];
  stage: StageData;
  basePath: string;
}) {
  const scenes = stage.scenes
    .map((scene) => ({
      scene,
      objects: objects.filter((object) => object.sceneIds.includes(scene.id)),
    }))
    .filter((entry) => entry.objects.length);
  const role = (id: string) => stage.characters.find((character) => character.id === id)?.name;

  if (!scenes.length) {
    return <EmptyState>Noch keine Requisite einer Szene zugeordnet.</EmptyState>;
  }
  return (
    <div className="space-y-3">
      <div className="flex justify-end print:hidden">
        <Button type="button" variant="outline" className="h-10" onClick={() => window.print()}>
          <PrinterIcon className="h-4 w-4" /> Drucken
        </Button>
      </div>
      {scenes.map(({ scene, objects: list }) => (
        <section
          key={scene.id}
          className="break-inside-avoid rounded-xl border border-border bg-card px-3 py-2.5"
        >
          <h3 className="text-sm font-semibold">{fullScene(scene)}</h3>
          <ul className="mt-1 divide-y divide-border">
            {list.map((object) => {
              const roles = object.characterIds
                .filter((id) => scene.characterIds.includes(id) || !scene.characterIds.length)
                .map(role)
                .filter(Boolean);
              return (
                <li key={object.id} className="flex min-h-10 items-start gap-2 py-1.5">
                  <span className="mt-1.5">
                    <StatusDot status={object.status} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <Link
                      href={`${basePath}/objekt/${object.id}`}
                      className="block text-sm hover:underline"
                    >
                      {object.title}
                    </Link>
                    {object.sceneNotes[scene.id] || roles.length ? (
                      <span className="block text-xs text-muted-foreground">
                        {[object.sceneNotes[scene.id], roles.join(", ")]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Check vor der Vorstellung: alles abhaken, danach zurücksetzen. */
export function PropsCheck({
  objects,
  stage,
  departmentId,
  canEdit,
}: {
  objects: ObjectListItem[];
  stage: StageData;
  departmentId: string;
  canEdit: boolean;
}) {
  const run = useAction();
  const [checked, setChecked] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(objects.map((object) => [object.id, Boolean(object.checkedAt)])),
  );
  const [source, setSource] = React.useState(objects);
  if (source !== objects) {
    setSource(objects);
    setChecked(Object.fromEntries(objects.map((object) => [object.id, Boolean(object.checkedAt)])));
  }
  const [confirmReset, setConfirmReset] = React.useState(false);

  // Nach erster Szene sortiert, ohne Szene ans Ende.
  const firstScene = (object: ObjectListItem) => {
    const indices = object.sceneIds
      .map((id) => stage.scenes.findIndex((scene) => scene.id === id))
      .filter((index) => index >= 0);
    return indices.length ? Math.min(...indices) : Number.MAX_SAFE_INTEGER;
  };
  const groups = new Map<number, ObjectListItem[]>();
  for (const object of [...objects].sort((a, b) => a.title.localeCompare(b.title, "de"))) {
    const index = firstScene(object);
    groups.set(index, [...(groups.get(index) ?? []), object]);
  }
  const done = objects.filter((object) => checked[object.id]).length;

  const toggle = (object: ObjectListItem) => {
    const next = !checked[object.id];
    setChecked((current) => ({ ...current, [object.id]: next }));
    void run(() => setObjectCheckedAction({ objectId: object.id, checked: next }));
  };

  if (!objects.length) return <EmptyState>Noch keine Requisiten.</EmptyState>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {done}/{objects.length} bereit
          </p>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-success transition-all"
              style={{ width: `${objects.length ? (done / objects.length) * 100 : 0}%` }}
            />
          </div>
        </div>
        {canEdit ? (
          <Button
            type="button"
            variant="outline"
            className="h-10"
            disabled={!done}
            onClick={() => setConfirmReset(true)}
          >
            <RefreshCwIcon className="h-4 w-4" /> Neu starten
          </Button>
        ) : null}
      </div>
      {[...groups.entries()]
        .sort(([a], [b]) => a - b)
        .map(([index, list]) => {
          const scene: StageScene | undefined = stage.scenes[index];
          return (
            <section key={index} className="space-y-1">
              <h3 className="text-xs font-medium text-muted-foreground">
                {scene ? `Ab ${fullScene(scene)}` : "Ohne Szene"}
              </h3>
              <ul className="space-y-1.5">
                {list.map((object) => {
                  const isChecked = Boolean(checked[object.id]);
                  return (
                    <li key={object.id}>
                      <button
                        type="button"
                        disabled={!canEdit}
                        aria-pressed={isChecked}
                        onClick={() => toggle(object)}
                        className={cn(
                          "flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 text-left transition-colors",
                          isChecked
                            ? "border-success/40 bg-success/10"
                            : "border-border bg-card hover:bg-muted/40",
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2",
                            isChecked
                              ? "border-success bg-success text-success-foreground"
                              : "border-muted-foreground/40",
                          )}
                        >
                          {isChecked ? <CheckIcon className="h-4 w-4" /> : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "block truncate text-sm font-medium",
                              isChecked && "text-muted-foreground line-through",
                            )}
                          >
                            {object.title}
                          </span>
                          {scene && object.sceneNotes[scene.id] ? (
                            <span className="block truncate text-xs text-muted-foreground">
                              {object.sceneNotes[scene.id]}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Check neu starten?"
        description="Alle Haken werden entfernt – zum Beispiel vor der nächsten Vorstellung."
        confirmLabel="Neu starten"
        cancelLabel="Abbrechen"
        variant="default"
        onCancel={() => setConfirmReset(false)}
        onConfirm={async () => {
          setConfirmReset(false);
          await run(() => resetChecksAction({ departmentId }), "Check zurückgesetzt");
        }}
      />
    </div>
  );
}

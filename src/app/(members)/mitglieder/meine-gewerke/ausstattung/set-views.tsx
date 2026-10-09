"use client";

import * as React from "react";
import Link from "next/link";

import { ArrowRightIcon } from "@/components/ui/action-icons";
import type { ObjectListItem, StageData, StageScene } from "@/lib/ausstattung/objects";

import { EmptyState, ObjectThumb, StatusDot, fullScene, shortScene } from "./shared";

/** Bühnenbild je Szene: welche Elemente stehen auf der Bühne. */
export function SetByScene({
  objects,
  stage,
  basePath,
}: {
  objects: ObjectListItem[];
  stage: StageData;
  basePath: string;
}) {
  if (!stage.scenes.length) return <EmptyState>Das Stück hat noch keine Szenen.</EmptyState>;
  return (
    <ul className="grid gap-2 lg:grid-cols-2">
      {stage.scenes.map((scene) => {
        const list = objects.filter((object) => object.sceneIds.includes(scene.id));
        return (
          <li key={scene.id} className="rounded-xl border border-border bg-card p-3">
            <h3 className="text-sm font-semibold">{fullScene(scene)}</h3>
            {list.length ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {list.map((object) => (
                  <li key={object.id}>
                    <Link
                      href={`${basePath}/objekt/${object.id}`}
                      className="flex items-center gap-2 rounded-lg bg-muted py-1 pl-1 pr-2.5 text-sm hover:bg-muted-foreground/15"
                    >
                      <ObjectThumb object={object} className="h-8 w-8 rounded-md" />
                      <StatusDot status={object.status} />
                      <span className="max-w-40 truncate">{object.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">Leere Bühne / nichts geplant.</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export type Changeover = {
  from: StageScene;
  to: StageScene;
  out: ObjectListItem[];
  in: ObjectListItem[];
  stays: ObjectListItem[];
};

/** Umbau zwischen zwei aufeinanderfolgenden Szenen: raus, rein, bleibt. */
export function buildChangeovers(objects: ObjectListItem[], stage: StageData): Changeover[] {
  const result: Changeover[] = [];
  for (let index = 1; index < stage.scenes.length; index += 1) {
    const from = stage.scenes[index - 1]!;
    const to = stage.scenes[index]!;
    const before = objects.filter((object) => object.sceneIds.includes(from.id));
    const after = objects.filter((object) => object.sceneIds.includes(to.id));
    result.push({
      from,
      to,
      out: before.filter((object) => !after.includes(object)),
      in: after.filter((object) => !before.includes(object)),
      stays: before.filter((object) => after.includes(object)),
    });
  }
  return result;
}

export function SetChangeovers({
  objects,
  stage,
  basePath,
}: {
  objects: ObjectListItem[];
  stage: StageData;
  basePath: string;
}) {
  const changeovers = buildChangeovers(objects, stage);
  if (!changeovers.length) {
    return <EmptyState>Umbauten gibt es ab zwei Szenen.</EmptyState>;
  }
  const item = (object: ObjectListItem, scene: StageScene) => (
    <li key={object.id}>
      <Link href={`${basePath}/objekt/${object.id}`} className="hover:underline">
        {object.title}
      </Link>
      {object.sceneNotes[scene.id] ? (
        <span className="text-muted-foreground"> · {object.sceneNotes[scene.id]}</span>
      ) : null}
    </li>
  );
  return (
    <ol className="space-y-2">
      {changeovers.map((change) => {
        const empty = !change.out.length && !change.in.length;
        return (
          <li key={change.to.id} className="rounded-xl border border-border bg-card px-3 py-2.5">
            <h3 className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
              <span className="tabular-nums">{shortScene(change.from)}</span>
              <ArrowRightIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{fullScene(change.to)}</span>
              {empty ? (
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  kein Umbau
                </span>
              ) : null}
            </h3>
            {!empty ? (
              <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
                <div>
                  <p className="text-xs font-medium text-destructive">Raus ({change.out.length})</p>
                  <ul className="space-y-0.5">{change.out.map((o) => item(o, change.from))}</ul>
                </div>
                <div>
                  <p className="text-xs font-medium text-success">Rein ({change.in.length})</p>
                  <ul className="space-y-0.5">{change.in.map((o) => item(o, change.to))}</ul>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Bleibt ({change.stays.length})
                  </p>
                  <ul className="space-y-0.5 text-muted-foreground">
                    {change.stays.map((o) => item(o, change.to))}
                  </ul>
                </div>
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

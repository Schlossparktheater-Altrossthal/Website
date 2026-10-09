"use client";

import * as React from "react";
import Link from "next/link";

import { AlertTriangleIcon } from "@/components/ui/action-icons";
import type {
  ObjectListItem,
  StageCharacter,
  StageData,
  StageScene,
} from "@/lib/ausstattung/objects";
import { cn } from "@/lib/utils";

import { EmptyState, StatusDot, fullScene, shortScene } from "./shared";

const PALETTE = [
  "#e76f51",
  "#2a9d8f",
  "#e9c46a",
  "#8e7dbe",
  "#f4a261",
  "#4d96ff",
  "#c06c84",
  "#6a994e",
];

type Cell = { costumes: ObjectListItem[]; appears: boolean };

export type QuickChange = {
  character: StageCharacter;
  from: StageScene;
  to: StageScene;
  fromCostume: ObjectListItem;
  toCostume: ObjectListItem;
};

/** Kostüm je Rolle und Szene; „appears“ = Rolle steht in der Szene. */
export function buildPlot(costumes: ObjectListItem[], stage: StageData) {
  const characters = stage.characters.filter(
    (character) =>
      costumes.some((costume) => costume.characterIds.includes(character.id)) ||
      stage.scenes.some((scene) => scene.characterIds.includes(character.id)),
  );
  const rows = characters.map((character) => ({
    character,
    cells: stage.scenes.map<Cell>((scene) => ({
      appears: scene.characterIds.includes(character.id),
      costumes: costumes.filter(
        (costume) =>
          costume.characterIds.includes(character.id) && costume.sceneIds.includes(scene.id),
      ),
    })),
  }));
  // Umzug: Rolle spielt in zwei direkt aufeinanderfolgenden Szenen mit verschiedenem Kostüm.
  const changes: QuickChange[] = [];
  for (const row of rows) {
    for (let index = 1; index < stage.scenes.length; index += 1) {
      const before = row.cells[index - 1];
      const after = row.cells[index];
      if (!before?.appears || !after?.appears) continue;
      const a = before.costumes[0];
      const b = after.costumes[0];
      if (a && b && a.id !== b.id) {
        changes.push({
          character: row.character,
          from: stage.scenes[index - 1]!,
          to: stage.scenes[index]!,
          fromCostume: a,
          toCostume: b,
        });
      }
    }
  }
  const missing = rows.reduce(
    (sum, row) => sum + row.cells.filter((cell) => cell.appears && !cell.costumes.length).length,
    0,
  );
  return { rows, changes, missing };
}

/** Kostümplot: Matrix Rolle × Szene (Desktop), Liste je Rolle (mobil), Umzüge. */
export function CostumePlot({
  costumes,
  stage,
  basePath,
}: {
  costumes: ObjectListItem[];
  stage: StageData;
  basePath: string;
}) {
  const { rows, changes, missing } = buildPlot(costumes, stage);
  const color = (id: string) =>
    PALETTE[costumes.findIndex((costume) => costume.id === id) % PALETTE.length] ?? PALETTE[0];

  if (!stage.scenes.length || !rows.length) {
    return <EmptyState>Für den Kostümplot braucht das Stück Szenen und Rollen.</EmptyState>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-muted px-2.5 py-1">{costumes.length} Kostüme</span>
        {missing ? (
          <span className="rounded-full bg-warning/20 px-2.5 py-1 text-warning-foreground">
            {missing} Auftritte ohne Kostüm
          </span>
        ) : null}
        {changes.length ? (
          <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-destructive">
            {changes.length} schnelle Umzüge
          </span>
        ) : null}
      </div>

      {/* Desktop: Matrix */}
      <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted/60">
              <th className="sticky left-0 z-10 bg-muted px-3 py-2 text-left font-medium">Rolle</th>
              {stage.scenes.map((scene) => (
                <th
                  key={scene.id}
                  title={fullScene(scene)}
                  className="min-w-16 px-1 py-2 text-center text-xs font-medium tabular-nums"
                >
                  {shortScene(scene)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.character.id} className="border-t border-border">
                <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left align-top font-normal">
                  <span className="block font-medium">{row.character.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {row.character.cast.map((entry) => entry.name).join(", ") || "nicht besetzt"}
                  </span>
                </th>
                {row.cells.map((cell, index) => {
                  const costume = cell.costumes[0];
                  return (
                    <td key={stage.scenes[index]!.id} className="p-0.5 align-middle">
                      {costume ? (
                        <Link
                          href={`${basePath}/objekt/${costume.id}`}
                          title={cell.costumes.map((entry) => entry.title).join(", ")}
                          className="flex h-10 items-center justify-center gap-1 truncate rounded-md px-1 text-xs font-medium text-foreground"
                          style={{
                            backgroundColor: `color-mix(in oklab, ${color(costume.id)} 35%, transparent)`,
                          }}
                        >
                          <StatusDot status={costume.status} />
                          <span className="truncate">{abbreviate(costume.title)}</span>
                          {cell.costumes.length > 1 ? (
                            <span>+{cell.costumes.length - 1}</span>
                          ) : null}
                        </Link>
                      ) : cell.appears ? (
                        <span
                          title="Rolle ist in der Szene, aber ohne Kostüm"
                          className="flex h-10 items-center justify-center rounded-md border border-dashed border-warning text-xs text-warning-foreground"
                        >
                          ?
                        </span>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobil: je Rolle */}
      <ul className="space-y-2 md:hidden">
        {rows.map((row) => {
          const appearances = row.cells
            .map((cell, index) => ({ cell, scene: stage.scenes[index]! }))
            .filter(({ cell }) => cell.appears || cell.costumes.length);
          if (!appearances.length) return null;
          return (
            <li key={row.character.id} className="rounded-xl border border-border bg-card p-3">
              <p className="text-sm font-semibold">{row.character.name}</p>
              <p className="text-xs text-muted-foreground">
                {row.character.cast.map((entry) => entry.name).join(", ") || "nicht besetzt"}
              </p>
              <ul className="mt-2 space-y-1.5">
                {groupByCostume(appearances).map((group) => (
                  <li key={group.costume?.id ?? "none"} className="flex items-start gap-2 text-sm">
                    {group.costume ? (
                      <Link
                        href={`${basePath}/objekt/${group.costume.id}`}
                        className="inline-flex min-w-0 shrink-0 items-center gap-1.5 truncate rounded-full px-2.5 py-1 text-xs font-medium"
                        style={{
                          backgroundColor: `color-mix(in oklab, ${color(group.costume.id)} 35%, transparent)`,
                        }}
                      >
                        <StatusDot status={group.costume.status} />
                        {abbreviate(group.costume.title)}
                      </Link>
                    ) : (
                      <span className="shrink-0 rounded-full border border-dashed border-warning px-2.5 py-1 text-xs text-warning-foreground">
                        ohne Kostüm
                      </span>
                    )}
                    <span className="pt-1 text-xs tabular-nums text-muted-foreground">
                      {group.scenes.map((scene) => shortScene(scene)).join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Umzüge zwischen direkt folgenden Szenen</h3>
        {changes.length ? (
          <ul className="space-y-1.5">
            {changes.map((change) => (
              <li
                key={`${change.character.id}-${change.to.id}`}
                className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm"
              >
                <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <span className="min-w-0">
                  <span className="font-medium">{change.character.name}</span>{" "}
                  <span className="text-muted-foreground">
                    {shortScene(change.from)} → {shortScene(change.to)}:
                  </span>{" "}
                  {change.fromCostume.title} → {change.toCostume.title}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={cn("text-sm text-muted-foreground")}>Keine schnellen Umzüge.</p>
        )}
      </section>
    </div>
  );
}

function abbreviate(title: string) {
  // „Fogg – Reiseanzug“ → „Reiseanzug“: in der Matrix steht die Rolle schon links.
  const parts = title.split(/\s[–-]\s/);
  return parts.length > 1 ? parts.slice(1).join(" – ") : title;
}

function groupByCostume(appearances: { cell: Cell; scene: StageScene }[]) {
  const groups: { costume: ObjectListItem | null; scenes: StageScene[] }[] = [];
  for (const { cell, scene } of appearances) {
    const costumes = cell.costumes.length ? cell.costumes : [null];
    for (const costume of costumes) {
      const group = groups.find((entry) => entry.costume?.id === costume?.id);
      if (group) group.scenes.push(scene);
      else groups.push({ costume, scenes: [scene] });
    }
  }
  // Fehlende Kostüme zuerst, damit sie auffallen.
  return groups.sort((a, b) => Number(Boolean(a.costume)) - Number(Boolean(b.costume)));
}

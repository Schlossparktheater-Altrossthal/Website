"use client";

import * as React from "react";

import { ChevronDownIcon } from "@/components/ui/action-icons";
import type { RolesScenesData } from "@/lib/produktionen/roles-scenes";
import { cn } from "@/lib/utils";

import { SceneAusstattung } from "./ausstattung";
import { sceneLabel, useRun } from "./ui";

/**
 * Stück für alle, die Ausstattung anfordern, aber Szenen nicht verwalten (z. B. Regie ohne
 * Produktionsrechte): Szenen nur lesen, Ausstattung sehen und anfordern.
 */
export function StueckRequestView({ data }: { data: RolesScenesData }) {
  const run = useRun();
  const [open, setOpen] = React.useState<string | null>(null);
  const role = (id: string) => data.roles.find((entry) => entry.id === id);

  if (!data.scenes.length) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Das Stück hat noch keine Szenen.
      </p>
    );
  }
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Szene öffnen, um Requisiten, Kostüme oder Bühnenbild anzufordern. Das zuständige Gewerk
        entscheidet im Eingang.
      </p>
      {data.acts.map((act) => {
        const scenes = data.scenes.filter((scene) => scene.act === act.number);
        if (!scenes.length) return null;
        return (
          <section key={act.number} className="space-y-2">
            <h2 className="text-sm font-semibold">
              Akt {act.number}
              {act.title ? ` – ${act.title}` : ""}
            </h2>
            <ul className="space-y-2">
              {scenes.map((scene) => {
                const expanded = open === scene.id;
                const requested = scene.requirements.filter(
                  (entry) => entry.status === "open",
                ).length;
                return (
                  <li key={scene.id} className="rounded-xl border border-border bg-card">
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => setOpen(expanded ? null : scene.id)}
                      className="flex min-h-14 w-full items-center gap-3 p-3 text-left"
                    >
                      <span className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-lg bg-muted px-2 text-sm font-semibold tabular-nums">
                        {sceneLabel(scene)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {scene.title ?? `Szene ${sceneLabel(scene)}`}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {scene.roles
                            .map((entry) => role(entry.characterId)?.name)
                            .filter(Boolean)
                            .join(", ") || "Keine Rollen"}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {scene.objects.length} Ausstattung
                          {requested ? (
                            <span className="text-info"> · {requested} angefordert</span>
                          ) : null}
                        </span>
                      </span>
                      <ChevronDownIcon
                        className={cn(
                          "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                          expanded && "rotate-180",
                        )}
                      />
                    </button>
                    {expanded ? (
                      <div className="border-t border-border/60 p-3">
                        <SceneAusstattung scene={scene} data={data} run={run} />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

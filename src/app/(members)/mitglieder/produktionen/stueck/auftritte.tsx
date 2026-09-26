"use client";

import * as React from "react";

import { StarIcon } from "@/components/ui/action-icons";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { RolesScenesData, RsRole, RsScene } from "@/lib/produktionen/roles-scenes";
import { cn } from "@/lib/utils";

import { setSceneRoleAction } from "../actions/roles-scenes";
import { sceneLabel, ToggleChip, useRun } from "./ui";

type CellState = "none" | "in" | "featured";

const NEXT_STATE: Record<CellState, CellState> = { none: "in", in: "featured", featured: "none" };

const STATE_LABEL: Record<CellState, string> = {
  none: "nicht dabei",
  in: "dabei",
  featured: "Hauptszene",
};

function roleTint(role: Pick<RsRole, "color">, amount: number) {
  return `color-mix(in oklab, ${role.color ?? "var(--muted-foreground)"} ${amount}%, transparent)`;
}

/** Wer steht wann auf der Bühne: Rollen × Szenen. Tippen: dabei → Hauptszene → nicht dabei. */
export function AuftritteView({ data }: { data: RolesScenesData }) {
  const run = useRun();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  // Optimistische Zellen, bis der Server neu geladen hat.
  const [pending, setPending] = React.useState<Record<string, CellState>>({});
  const [lastData, setLastData] = React.useState(data);
  if (lastData !== data) {
    setLastData(data);
    setPending({});
  }

  const stateOf = (scene: RsScene, role: RsRole): CellState => {
    const key = `${scene.id}:${role.id}`;
    if (key in pending) return pending[key];
    const entry = scene.roles.find((item) => item.characterId === role.id);
    return entry ? (entry.featured ? "featured" : "in") : "none";
  };

  const cycle = async (scene: RsScene, role: RsRole) => {
    const key = `${scene.id}:${role.id}`;
    const state = NEXT_STATE[stateOf(scene, role)];
    setPending((map) => ({ ...map, [key]: state }));
    const ok = await run(() =>
      setSceneRoleAction({ sceneId: scene.id, characterId: role.id, state }),
    );
    if (!ok)
      setPending((map) => {
        const next = { ...map };
        delete next[key];
        return next;
      });
  };

  if (!data.roles.length || !data.scenes.length) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Für den Auftrittsplan braucht es Rollen und Szenen.
      </p>
    );
  }

  const legend = (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span>Tippen: dabei → Hauptszene → nicht dabei</span>
      <span className="inline-flex items-center gap-1">
        <span className="h-3 w-3 rounded-sm bg-primary/60" aria-hidden /> dabei
      </span>
      <span className="inline-flex items-center gap-1">
        <StarIcon className="h-3 w-3" aria-hidden /> Hauptszene
      </span>
    </p>
  );

  if (!isDesktop) {
    return (
      <div className="space-y-3">
        {legend}
        <ul className="space-y-2">
          {data.scenes.map((scene) => (
            <li key={scene.id} className="space-y-2 rounded-xl border border-border bg-card p-3">
              <p className="flex items-baseline gap-2 text-sm">
                <span className="font-semibold tabular-nums">{sceneLabel(scene)}</span>
                <span className="truncate">{scene.title}</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {data.roles.map((role) => {
                  const state = stateOf(scene, role);
                  return (
                    <ToggleChip
                      key={role.id}
                      active={state !== "none"}
                      color={role.color}
                      onClick={() => void cycle(scene, role)}
                    >
                      {state === "featured" ? (
                        <StarIcon className="h-3.5 w-3.5" aria-label="Hauptszene" />
                      ) : null}
                      {role.name}
                    </ToggleChip>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const acts = data.acts
    .map((act) => ({ act, scenes: data.scenes.filter((scene) => scene.act === act.number) }))
    .filter((group) => group.scenes.length);

  return (
    <div className="space-y-3">
      {legend}
      <div className="w-fit max-w-full overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-max border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-card" />
              {acts.map(({ act, scenes }) => (
                <th
                  key={act.number}
                  colSpan={scenes.length}
                  scope="colgroup"
                  className="border-l border-border px-2 pt-2 text-left text-xs font-medium text-muted-foreground"
                >
                  Akt {act.number}
                  {act.title ? ` – ${act.title}` : ""}
                </th>
              ))}
              <th className="border-l border-border" />
            </tr>
            <tr className="border-b border-border">
              <th
                scope="col"
                className="sticky left-0 z-10 bg-card px-3 py-2 text-left text-xs font-medium text-muted-foreground"
              >
                Rolle
              </th>
              {data.scenes.map((scene, index) => (
                <th
                  key={scene.id}
                  scope="col"
                  title={scene.title ?? undefined}
                  className={cn(
                    "w-10 px-1 py-2 text-center text-xs font-semibold tabular-nums",
                    (index === 0 || data.scenes[index - 1].act !== scene.act) &&
                      "border-l border-border",
                  )}
                >
                  {sceneLabel(scene)}
                </th>
              ))}
              <th
                scope="col"
                className="border-l border-border px-3 py-2 text-right text-xs font-medium text-muted-foreground"
              >
                Szenen
              </th>
            </tr>
          </thead>
          <tbody>
            {data.roles.map((role) => {
              const count = data.scenes.filter((scene) => stateOf(scene, role) !== "none").length;
              return (
                <tr key={role.id} className="border-b border-border/60 last:border-b-0">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 max-w-48 bg-card px-3 py-1 text-left font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: role.color ?? "var(--muted-foreground)" }}
                      />
                      <span className="truncate">{role.name}</span>
                    </span>
                  </th>
                  {data.scenes.map((scene, index) => {
                    const state = stateOf(scene, role);
                    return (
                      <td
                        key={scene.id}
                        className={cn(
                          "p-0.5 text-center",
                          (index === 0 || data.scenes[index - 1].act !== scene.act) &&
                            "border-l border-border",
                        )}
                      >
                        <button
                          type="button"
                          aria-label={`${role.name} in Szene ${sceneLabel(scene)}: ${STATE_LABEL[state]}`}
                          onClick={() => void cycle(scene, role)}
                          className="flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:ring-1 hover:ring-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          style={
                            state === "none" ? undefined : { backgroundColor: roleTint(role, 55) }
                          }
                        >
                          {state === "featured" ? <StarIcon className="h-4 w-4" /> : null}
                        </button>
                      </td>
                    );
                  })}
                  <td className="border-l border-border px-3 text-right tabular-nums text-muted-foreground">
                    {count}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-border">
              <th
                scope="row"
                className="sticky left-0 z-10 bg-card px-3 py-2 text-left text-xs font-medium text-muted-foreground"
              >
                Rollen je Szene
              </th>
              {data.scenes.map((scene, index) => (
                <td
                  key={scene.id}
                  className={cn(
                    "py-2 text-center text-xs tabular-nums text-muted-foreground",
                    (index === 0 || data.scenes[index - 1].act !== scene.act) &&
                      "border-l border-border",
                  )}
                >
                  {data.roles.filter((role) => stateOf(scene, role) !== "none").length}
                </td>
              ))}
              <td className="border-l border-border" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

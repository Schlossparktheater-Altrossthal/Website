"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { ArrowLeftIcon } from "@/components/ui/action-icons";
import { AsyncButton } from "@/components/ui/async-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import type { ProductionActionResult } from "@/lib/produktionen/actions-helpers";
import type { TakeoverData } from "@/lib/skript/takeover";
import type { AppearanceChange } from "@/lib/skript/takeover-plan";

import {
  applyAppearanceTakeoverAction,
  applyRoleTakeoverAction,
  applySceneTakeoverAction,
} from "../../actions/skript-uebernahme";
import { inputClass } from "../ui";

const BASE = "/mitglieder/produktionen/stueck?ansicht=skript";
const FIELD_LABELS = { title: "Titel", durationMinutes: "Dauer (Min.)" } as const;

function useApply() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const apply = async (task: () => Promise<ProductionActionResult>) => {
    setPending(true);
    try {
      const result = await task();
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message ?? "Übernommen");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  };
  return [pending, apply] as const;
}

/** Übernahme-Assistent „Ins Stück übernehmen“ (docs/Plan/skript-uebernahme-plan.md, Phase 7). */
export function ScriptTakeover({ data }: { data: TakeoverData }) {
  return (
    <div className="space-y-4">
      <Link
        href={BASE}
        className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon aria-hidden /> Alle Fassungen
      </Link>
      <div className="rounded-lg border border-border bg-muted p-4 text-sm">
        <p className="font-medium">Ins Stück übernehmen · {data.version.label}</p>
        <p className="text-muted-foreground">
          Drei Schritte nacheinander: Szenen, Rollen, Auftritte. Nichts wird ohne Haken übernommen,
          im Stück wird nichts gelöscht. Von Hand geänderte Felder sind nicht vorausgewählt.
        </p>
      </div>
      {/* Neu laden nach dem Übernehmen setzt die Auswahl über den key zurück. */}
      <SceneStep
        key={data.scenes.map((s) => `${s.sceneKey}:${s.status}:${s.fields.length}`).join()}
        data={data}
      />
      <RoleStep
        key={data.roles.map((r) => `${r.id}:${r.characterIds.length}:${r.linked}`).join()}
        data={data}
      />
      <AppearanceStep
        key={`${data.includeMembers}:${data.appearances.add.length}:${data.appearances.remove.length}`}
        data={data}
      />
    </div>
  );
}

function SceneStep({ data }: { data: TakeoverData }) {
  const [pending, apply] = useApply();
  const initial = React.useMemo(
    () =>
      Object.fromEntries(
        data.scenes.map((scene) => [
          scene.sceneKey,
          {
            target:
              scene.status === "linked"
                ? scene.sceneId!
                : scene.status === "ignored"
                  ? "ignore"
                  : (scene.suggestionId ?? "new"),
            fields: scene.fields.filter((f) => f.preselect).map((f) => f.field),
          },
        ]),
      ),
    [data.scenes],
  );
  const [choice, setChoice] = React.useState(initial);
  const open = data.scenes.filter((s) => s.status === "new" || s.fields.length);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          1 · Szenen{" "}
          <span className="text-muted-foreground">
            ({data.scenes.filter((s) => s.status === "linked").length} von {data.scenes.length}{" "}
            verknüpft)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.scenes.map((scene) => {
          const current = choice[scene.sceneKey];
          if (!current) return null;
          return (
            <div key={scene.sceneKey} className="space-y-2 rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 break-words text-sm font-medium">
                  {scene.scriptTitle}
                </span>
                <Badge
                  size="sm"
                  variant={
                    scene.status === "new" ? "warning" : scene.fields.length ? "info" : "muted"
                  }
                >
                  {scene.status === "new"
                    ? "neu"
                    : scene.status === "ignored"
                      ? "ignoriert"
                      : scene.fields.length
                        ? "geändert"
                        : "aktuell"}
                </Badge>
              </div>
              <select
                className={inputClass}
                aria-label={`Ziel für ${scene.scriptTitle}`}
                value={current.target}
                onChange={(e) =>
                  setChoice((c) => ({
                    ...c,
                    [scene.sceneKey]: { ...current, target: e.target.value },
                  }))
                }
              >
                <option value="new">
                  Neu anlegen: „{scene.title}“ ({scene.durationMinutes} Min.)
                </option>
                <option value="ignore">Nicht übernehmen</option>
                {data.showScenes.map((s) => (
                  <option key={s.id} value={s.id}>
                    → {s.label}
                  </option>
                ))}
              </select>
              {scene.fields.map((field) => (
                <label key={field.field} className="flex min-h-11 items-start gap-3 text-sm">
                  <Checkbox
                    className="mt-0.5"
                    checked={current.fields.includes(field.field)}
                    onCheckedChange={(checked) =>
                      setChoice((c) => ({
                        ...c,
                        [scene.sceneKey]: {
                          ...current,
                          fields: checked
                            ? [...current.fields, field.field]
                            : current.fields.filter((f) => f !== field.field),
                        },
                      }))
                    }
                  />
                  <span className="min-w-0">
                    {FIELD_LABELS[field.field]}: {String(field.from ?? "–")} → {String(field.to)}
                    {field.handEdited ? (
                      <span className="block text-xs text-warning">im Stück von Hand geändert</span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          );
        })}
        <AsyncButton
          isLoading={pending}
          disabled={!data.scenes.length}
          onClick={() =>
            apply(() =>
              applySceneTakeoverAction(
                data.showId,
                data.scenes.map((s) => ({ sceneKey: s.sceneKey, ...choice[s.sceneKey] })),
              ),
            )
          }
        >
          Szenen übernehmen{open.length ? ` (${open.length} offen)` : ""}
        </AsyncButton>
      </CardContent>
    </Card>
  );
}

function RoleStep({ data }: { data: TakeoverData }) {
  const [pending, apply] = useApply();
  const names = new Map(data.characters.map((c) => [c.id, c.name]));
  const open = data.roles.filter((r) => !r.characterIds.length && !r.linked);
  const initial = React.useMemo(
    () =>
      Object.fromEntries(
        data.roles
          .filter((r) => !r.characterIds.length && !r.linked)
          .map((r) => [r.id, r.kind === "group" ? "none" : "new"]),
      ),
    [data.roles],
  );
  const [choice, setChoice] = React.useState<Record<string, string>>(initial);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          2 · Rollen <span className="text-muted-foreground">({open.length} offen)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.roles.map((role) => {
          const linkedNames = role.characterIds.map((id) => names.get(id)).filter(Boolean);
          if (linkedNames.length || role.linked) {
            return (
              <p key={role.id} className="text-sm">
                <span className="font-medium">{role.name}</span>{" "}
                <span className="text-muted-foreground">
                  → {linkedNames.length ? linkedNames.join(", ") : "bewusst ohne Stück-Rolle"}
                  {role.linked ? "" : " (per Name)"}
                </span>
              </p>
            );
          }
          return (
            <label key={role.id} className="block space-y-1">
              <span className="text-sm font-medium">
                {role.name}{" "}
                <span className="font-normal text-muted-foreground">
                  · {role.kind === "group" ? "Gruppe" : `${role.lines} Repliken`}
                </span>
              </span>
              <select
                className={inputClass}
                value={choice[role.id] ?? "new"}
                onChange={(e) => setChoice((c) => ({ ...c, [role.id]: e.target.value }))}
              >
                <option value="new">Neu anlegen: „{role.suggestedName}“</option>
                <option value="none">Nicht ins Stück</option>
                {data.characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    → {c.name}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
        <p className="text-xs text-muted-foreground">
          Feiner (mehrere Stück-Rollen, Zusammenführen, Gruppen) unter{" "}
          <Link href={`${BASE}&bereich=rollen`} className="text-primary underline">
            Rollen zuordnen
          </Link>
          .
        </p>
        <AsyncButton
          isLoading={pending}
          disabled={!open.length}
          onClick={() =>
            apply(() =>
              applyRoleTakeoverAction(
                data.showId,
                open.map((r) => ({ scriptRoleId: r.id, target: choice[r.id] ?? "new" })),
              ),
            )
          }
        >
          Rollen übernehmen
        </AsyncButton>
      </CardContent>
    </Card>
  );
}

function AppearanceStep({ data }: { data: TakeoverData }) {
  const router = useRouter();
  const [pending, apply] = useApply();
  const key = (c: AppearanceChange) => `${c.sceneId}|${c.characterId}`;
  const [added, setAdded] = React.useState(() => new Set(data.appearances.add.map(key)));
  const [removed, setRemoved] = React.useState(() => new Set<string>());
  const scenes = new Map(data.showScenes.map((s) => [s.id, s.label]));
  const names = new Map(data.characters.map((c) => [c.id, c.name]));
  const toggle = (set: Set<string>, value: string) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };
  const list = (
    items: AppearanceChange[],
    selected: Set<string>,
    onToggle: (k: string) => void,
  ) => (
    <ul className="space-y-1">
      {items.map((c) => (
        <li key={key(c)}>
          <label className="flex min-h-10 items-center gap-3 text-sm">
            <Checkbox checked={selected.has(key(c))} onCheckedChange={() => onToggle(key(c))} />
            <span className="min-w-0 break-words">
              {scenes.get(c.sceneId) ?? "?"} · {names.get(c.characterId) ?? "?"}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>3 · Auftritte</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-medium">Gruppen als Auftritt zählen</span>
            <span className="block text-xs text-muted-foreground">
              Wer bei „Alle“ mitspricht, steht auch in der Szene
            </span>
          </span>
          <Switch
            checked={data.includeMembers}
            onCheckedChange={(on) =>
              router.replace(`${BASE}&bereich=uebernahme${on ? "&mitglieder=1" : ""}`)
            }
          />
        </label>
        {data.appearances.add.length ? (
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Neu laut Skript ({data.appearances.add.length})</h3>
            {list(data.appearances.add, added, (k) => setAdded((s) => toggle(s, k)))}
          </section>
        ) : null}
        {data.appearances.remove.length ? (
          <section className="space-y-2">
            <h3 className="text-sm font-medium">
              Nicht mehr im Skript ({data.appearances.remove.length})
            </h3>
            <p className="text-xs text-muted-foreground">
              Stammen aus einer früheren Übernahme. Nur angehakte werden entfernt.
            </p>
            {list(data.appearances.remove, removed, (k) => setRemoved((s) => toggle(s, k)))}
          </section>
        ) : null}
        {!data.appearances.add.length && !data.appearances.remove.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Auftritte sind auf dem Stand der Fassung (für verknüpfte Szenen und Rollen).
          </p>
        ) : (
          <AsyncButton
            isLoading={pending}
            disabled={!added.size && !removed.size}
            onClick={() =>
              apply(() =>
                applyAppearanceTakeoverAction(data.showId, {
                  add: data.appearances.add.filter((c) => added.has(key(c))),
                  remove: data.appearances.remove.filter((c) => removed.has(key(c))),
                  includeMembers: data.includeMembers,
                }),
              )
            }
          >
            Auftritte übernehmen
          </AsyncButton>
        )}
      </CardContent>
    </Card>
  );
}

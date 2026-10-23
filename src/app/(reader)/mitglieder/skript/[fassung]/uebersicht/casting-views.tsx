"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  ROLE_TIER_LABELS,
  bundleConflicts,
  compatible,
  minimumCast,
  sceneDistance,
  suggestBundles,
  type CastingModel,
  type CastingRole,
  type RoleTier,
} from "@/lib/skript/casting";
import { sceneShortLabel } from "@/lib/skript/export-options";
import { formatDuration } from "@/lib/skript/stats";
import { cn } from "@/lib/utils";

/** Szenenspiegel und Doppelbesetzung (docs/Plan/szenenspiegel-plan.md). */

const TIERS: RoleTier[] = ["main", "supporting", "small", "ensemble"];

type Width = "equal" | "duration";

function columns(model: CastingModel, width: Width) {
  return model.scenes
    .map((s) => (width === "duration" ? `${Math.max(30, s.seconds)}fr` : "1fr"))
    .join(" ");
}

/** Szenenleiste einer Rolle: Balken, die bei aufeinanderfolgenden Szenen verschmelzen. */
function Strip({
  model,
  role,
  width,
  activeScene,
  className,
  tone = "primary",
}: {
  model: CastingModel;
  role: CastingRole;
  width: Width;
  activeScene: number | null;
  className?: string;
  tone?: "primary" | "muted" | "conflict";
}) {
  return (
    <div
      className={cn("grid h-5", className)}
      style={{ gridTemplateColumns: columns(model, width) }}
      aria-hidden
    >
      {model.scenes.map((scene, i) => {
        const p = role.presence.get(i);
        const prev = role.presence.has(i - 1);
        const next = role.presence.has(i + 1);
        return (
          <div
            key={scene.id}
            className={cn(
              "relative h-full",
              scene.part && i > 0 && "border-l-2 border-border",
              activeScene === i && "bg-primary/10",
            )}
          >
            {p ? (
              <div
                className={cn(
                  "absolute inset-y-1",
                  prev ? "left-0" : "left-px rounded-l-full",
                  next ? "right-0" : "right-px rounded-r-full",
                  tone === "conflict"
                    ? "bg-destructive"
                    : tone === "muted"
                      ? "bg-muted-foreground/40"
                      : p === "speaks"
                        ? "bg-primary"
                        : "bg-primary/35",
                )}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function SceneAxis({
  model,
  width,
  activeScene,
  onScene,
}: {
  model: CastingModel;
  width: Width;
  activeScene: number | null;
  onScene: (i: number | null) => void;
}) {
  return (
    <div className="grid" style={{ gridTemplateColumns: columns(model, width) }}>
      {model.scenes.map((scene, i) => (
        <button
          key={scene.id}
          type="button"
          title={scene.title}
          aria-label={`Szene ${scene.title}`}
          aria-pressed={activeScene === i}
          onClick={() => onScene(activeScene === i ? null : i)}
          className={cn(
            "min-h-9 overflow-hidden px-0 text-center text-[10px] tabular-nums text-muted-foreground sm:text-xs",
            scene.part && i > 0 && "border-l-2 border-border",
            // Schmal (Handy): nur jede dritte Nummer, sonst überlappen sie.
            i % 3 !== 0 && activeScene !== i && "max-sm:text-transparent",
            activeScene === i && "rounded-t bg-primary/10 font-semibold text-foreground",
          )}
        >
          {sceneShortLabel(scene.title, i)}
        </button>
      ))}
    </div>
  );
}

export function SceneMirror({
  model,
  mine,
  minGap,
}: {
  model: CastingModel;
  mine: Set<string>;
  minGap: number;
}) {
  const [width, setWidth] = React.useState<Width>("equal");
  const [open, setOpen] = React.useState<Set<RoleTier>>(new Set(["main", "supporting"]));
  const [focus, setFocus] = React.useState<string | null>(null);
  const [activeScene, setActiveScene] = React.useState<number | null>(null);
  const focused = model.roles.find((r) => r.id === focus) ?? null;
  const scene = activeScene != null ? model.scenes[activeScene] : null;

  const toneFor = (role: CastingRole) => {
    if (!focused || role === focused) return "primary" as const;
    if (role.tier === "ensemble") return "muted" as const;
    return sceneDistance(role, focused) === 0 ? ("conflict" as const) : ("primary" as const);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl<Width>
          aria-label="Szenenbreite"
          size="sm"
          value={width}
          onValueChange={setWidth}
          options={[
            { value: "equal", label: "Gleich breit" },
            { value: "duration", label: "Nach Dauer" },
          ]}
        />
        <p className="text-xs text-muted-foreground">
          <span className="mr-1 inline-block h-2 w-4 rounded-full bg-primary align-middle" />
          spricht
          <span className="ml-3 mr-1 inline-block h-2 w-4 rounded-full bg-primary/35 align-middle" />
          nur genannt · Rolle oder Szene antippen
        </p>
      </div>

      {focused || scene ? (
        <div className="rounded-md border border-primary/40 bg-primary/5 p-3 text-sm">
          {focused ? (
            <FocusInfo
              model={model}
              role={focused}
              minGap={minGap}
              onClose={() => setFocus(null)}
            />
          ) : null}
          {scene && activeScene != null ? (
            <div className={cn(focused && "mt-3 border-t border-border/60 pt-3")}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{scene.title}</p>
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline"
                  onClick={() => setActiveScene(null)}
                >
                  schließen
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDuration({ seconds: scene.seconds, estimated: true })}
              </p>
              <p className="mt-1">
                {model.roles
                  .filter((r) => r.presence.has(activeScene))
                  .map(
                    (r) =>
                      r.name + (r.presence.get(activeScene) === "mentioned" ? " (genannt)" : ""),
                  )
                  .join(", ")}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-md border border-border/60">
        <div className="sticky top-12 z-10 grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-2 border-b border-border/60 bg-muted/90 px-2 backdrop-blur sm:grid-cols-[11rem_minmax(0,1fr)]">
          <span className="self-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Rolle
          </span>
          <SceneAxis
            model={model}
            width={width}
            activeScene={activeScene}
            onScene={setActiveScene}
          />
        </div>
        {TIERS.map((tier) => {
          const roles = model.roles.filter((r) => r.tier === tier);
          if (!roles.length) return null;
          const expanded = open.has(tier);
          return (
            <section key={tier} className="border-b border-border/60 last:border-b-0">
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() =>
                  setOpen((prev) => {
                    const next = new Set(prev);
                    if (next.has(tier)) next.delete(tier);
                    else next.add(tier);
                    return next;
                  })
                }
                className="flex min-h-10 w-full items-center gap-2 bg-muted/40 px-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                <span aria-hidden>{expanded ? "▾" : "▸"}</span>
                {ROLE_TIER_LABELS[tier]} · {roles.length}
              </button>
              {expanded
                ? roles.map((role) => {
                    const tone = toneFor(role);
                    const fits =
                      focused &&
                      role !== focused &&
                      role.tier !== "ensemble" &&
                      compatible(role, focused, minGap);
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => setFocus(focus === role.id ? null : role.id)}
                        aria-pressed={focus === role.id}
                        className={cn(
                          "grid w-full grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-x-2 px-2 py-1 text-left hover:bg-muted/50 sm:grid-cols-[11rem_minmax(0,1fr)]",
                          mine.has(role.id) && "bg-primary/10",
                          focus === role.id && "bg-primary/15",
                          focused && tone === "conflict" && "opacity-60",
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-1 text-sm">
                          <span className={cn("truncate", focus === role.id && "font-semibold")}>
                            {role.name}
                          </span>
                          {fits ? (
                            <span
                              className="shrink-0 text-xs text-emerald-600"
                              title="kombinierbar"
                            >
                              ✓
                            </span>
                          ) : null}
                        </span>
                        <Strip
                          model={model}
                          role={role}
                          width={width}
                          activeScene={activeScene}
                          tone={tone}
                        />
                      </button>
                    );
                  })
                : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function FocusInfo({
  model,
  role,
  minGap,
  onClose,
}: {
  model: CastingModel;
  role: CastingRole;
  minGap: number;
  onClose: () => void;
}) {
  const others = model.roles.filter(
    (r) => r !== role && r.tier !== "ensemble" && r.tier !== "main",
  );
  const fits = others.filter((r) => compatible(r, role, minGap));
  const tight = others.filter((r) => sceneDistance(r, role) > 0 && !compatible(r, role, minGap));
  return (
    <div className="space-y-1">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium">
          {role.name} · {role.presence.size} {role.presence.size === 1 ? "Szene" : "Szenen"}
        </p>
        <button type="button" className="text-xs text-muted-foreground underline" onClick={onClose}>
          schließen
        </button>
      </div>
      {role.tier === "ensemble" ? (
        <p className="text-muted-foreground">
          Gruppe – zählt bei der Doppelbesetzung nicht als Person.
        </p>
      ) : (
        <>
          <p>
            <span className="text-muted-foreground">Kombinierbar mit: </span>
            {fits.length ? fits.map((r) => r.name).join(", ") : "keiner Neben- oder kleinen Rolle"}
          </p>
          {tight.length ? (
            <p className="text-xs text-muted-foreground">
              Zu knapp zum Umziehen: {tight.map((r) => r.name).join(", ")}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">Rot = steht in derselben Szene.</p>
        </>
      )}
    </div>
  );
}

const GAP_LABELS = ["kein Puffer", "1 Szene", "2 Szenen"] as const;

export function useMinGap(versionId: string) {
  const key = `skript-casting-gap:${versionId}`;
  const [gap, setGap] = React.useState(1);
  React.useEffect(() => {
    const stored = Number(localStorage.getItem(key));
    // Gespeicherter Wert erst nach der Hydration (localStorage gibt es nur im Browser).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored >= 0 && stored <= 2 && localStorage.getItem(key) != null) setGap(stored);
  }, [key]);
  return [
    gap,
    (value: number) => {
      setGap(value);
      localStorage.setItem(key, String(value));
    },
  ] as const;
}

/** Eigene Bündel je Fassung im Browser; ohne Eintrag gilt der Vorschlag. */
function useBundles(versionId: string, model: CastingModel, minGap: number) {
  const key = `skript-casting-bundles:${versionId}`;
  const suggestion = React.useMemo(
    () => suggestBundles(model, minGap).map((b) => b.roleIds),
    [model, minGap],
  );
  const [custom, setCustom] = React.useState<string[][] | null>(null);
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCustom(raw ? (JSON.parse(raw) as string[][]) : null);
    } catch {
      setCustom(null);
    }
  }, [key]);
  const save = (value: string[][] | null) => {
    setCustom(value);
    if (value) localStorage.setItem(key, JSON.stringify(value));
    else localStorage.removeItem(key);
  };
  // Neue Rollen (z. B. nach Neuimport) landen als eigene Person, verschwundene fallen weg.
  const bundles = React.useMemo(() => {
    if (!custom) return suggestion;
    const known = new Set(model.roles.filter((r) => r.tier !== "ensemble").map((r) => r.id));
    const kept = custom.map((b) => b.filter((id) => known.has(id))).filter((b) => b.length);
    const seen = new Set(kept.flat());
    return [...kept, ...[...known].filter((id) => !seen.has(id)).map((id) => [id])];
  }, [custom, suggestion, model.roles]);
  return { bundles, isCustom: custom != null, save };
}

export function DoubleCasting({
  versionId,
  model,
  minGap,
  onMinGap,
  onBundles,
}: {
  versionId: string;
  model: CastingModel;
  minGap: number;
  onMinGap: (gap: number) => void;
  /** Für den CSV-Export der Übersicht. */
  onBundles: (bundles: string[][]) => void;
}) {
  const { bundles, isCustom, save } = useBundles(versionId, model, minGap);
  const byId = React.useMemo(() => new Map(model.roles.map((r) => [r.id, r])), [model.roles]);
  const people = model.roles.filter((r) => r.tier !== "ensemble");
  const minimum = minimumCast(model);
  React.useEffect(() => onBundles(bundles), [bundles, onBundles]);

  const move = (roleId: string, target: number) => {
    const next = bundles.map((b) => b.filter((id) => id !== roleId));
    if (target >= next.length) next.push([roleId]);
    else next[target].push(roleId);
    save(next.filter((b) => b.length));
  };

  const ordered = bundles
    .map((roleIds, index) => ({ roleIds, index }))
    .sort((a, b) => {
      const main = (x: string[]) => (x.some((id) => byId.get(id)?.tier === "main") ? 0 : 1);
      return main(a.roleIds) - main(b.roleIds);
    });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center sm:max-w-md">
        <Tile label="Rollen (ohne Gruppen)" value={people.length} />
        <Tile label="Mindestens (volle Szene)" value={minimum} />
        <Tile label={isCustom ? "Eigene Aufteilung" : "Vorschlag"} value={bundles.length} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Umziehpuffer</span>
        <SegmentedControl<string>
          aria-label="Umziehpuffer zwischen zwei Rollen"
          size="sm"
          value={String(minGap)}
          onValueChange={(v) => onMinGap(Number(v))}
          options={GAP_LABELS.map((label, i) => ({ value: String(i), label }))}
        />
        {isCustom ? (
          <Button variant="outline" size="sm" onClick={() => save(null)}>
            Vorschlag wiederherstellen
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Rollen, die nie zusammen auf der Bühne stehen (auch nicht „genannt“), kann eine Person
        spielen. Hauptrollen bleiben einzeln, Gruppen wie „Alle“ oder „Chor“ zählen nicht. Über
        „Person“ an einer Rolle selbst umsortieren – die Aufteilung bleibt in diesem Browser
        gespeichert.
      </p>

      <ol className="space-y-2">
        {ordered.map(({ roleIds }, position) => {
          const conflicts = bundleConflicts(model, roleIds, minGap);
          const bad = new Set(conflicts.flatMap((c) => [c.a, c.b]));
          const scenes = new Set(
            roleIds.flatMap((id) => [...(byId.get(id)?.presence.keys() ?? [])]),
          );
          return (
            <li
              key={roleIds.join("|")}
              className={cn(
                "rounded-md border p-3",
                conflicts.length ? "border-destructive/60" : "border-border/60",
              )}
            >
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold">Person {position + 1}</p>
                <p className="text-xs text-muted-foreground">
                  {scenes.size} von {model.scenes.length} Szenen
                </p>
              </div>
              <ul className="space-y-1">
                {roleIds.map((id) => {
                  const role = byId.get(id);
                  if (!role) return null;
                  return (
                    <li
                      key={id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5 sm:grid-cols-[11rem_minmax(0,1fr)_auto]"
                    >
                      <span
                        className={cn(
                          "truncate text-sm",
                          bad.has(id) && "font-medium text-destructive",
                        )}
                      >
                        {role.name}
                      </span>
                      <Strip
                        model={model}
                        role={role}
                        width="equal"
                        activeScene={null}
                        tone={bad.has(id) ? "conflict" : "primary"}
                        className="max-sm:order-last max-sm:col-span-2"
                      />
                      <select
                        aria-label={`${role.name} einer anderen Person geben`}
                        className="h-8 max-w-[6.5rem] rounded-md border border-input bg-background px-1 text-xs"
                        value={position}
                        onChange={(event) => {
                          const to = Number(event.target.value);
                          move(id, to === -1 ? bundles.length : ordered[to].index);
                        }}
                      >
                        {ordered.map((_, p) => (
                          <option key={p} value={p}>
                            Person {p + 1}
                          </option>
                        ))}
                        <option value={-1}>Neue Person</option>
                      </select>
                    </li>
                  );
                })}
              </ul>
              {conflicts.length ? (
                <p className="mt-2 text-xs text-destructive">
                  {conflicts
                    .map(
                      (c) =>
                        `${byId.get(c.a)?.name} + ${byId.get(c.b)?.name}: ${
                          c.distance === 0
                            ? "gleiche Szene"
                            : c.distance === 1
                              ? "direkt hintereinander"
                              : `nur ${c.distance - 1} Szene dazwischen`
                        }`,
                    )
                    .join(" · ")}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border/60 px-2 py-2">
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

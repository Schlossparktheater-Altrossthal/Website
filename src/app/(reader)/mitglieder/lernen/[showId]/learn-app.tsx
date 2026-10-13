"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookOpenTextIcon,
  CalendarIcon,
  ChevronRightIcon,
  MinusIcon,
  PlusIcon,
  SettingsIcon,
  TrophyIcon,
  UsersIcon,
  WifiOffIcon,
} from "@/components/ui/action-icons";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import {
  SECONDS_PER_ITEM,
  confidence,
  dayKey,
  moreQueue,
  sceneProgress,
  summarize,
  todayQueue,
  weekDays,
  type QueueInput,
} from "@/lib/skript/learn/plan";
import { STAGE_LABEL, type LearnRating, type Stage } from "@/lib/skript/learn/schedule";
import type { LearnPageData } from "@/lib/skript/learn/service";
import { cn } from "@/lib/utils";

import { SKRIPT_PATH } from "../../skript/shared";
import { resetRoleAction, setWeeklyDaysAction } from "./actions";
import { Drill } from "./drill";
import { SceneFlow } from "./flow";
import {
  buildUnits,
  itemsToUnits,
  useLearnSettings,
  useLearnStore,
  useTokenized,
  type ReviewMeta,
  type Unit,
} from "./model";

type View =
  | { kind: "dashboard" }
  | { kind: "flow"; sceneId: string }
  | { kind: "drill"; units: Unit[]; title: string };

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/** Lernmodus: Dashboard, Szenenfluss und Abfrage (docs/Plan/lernmodus-plan.md). */
export function LearnApp({ data }: { data: LearnPageData }) {
  const { reader } = data;
  const showId = reader.version.showId;
  const [settings, updateSettings] = useLearnSettings(showId, reader.ownRoleIds);
  const store = useLearnStore(data);
  const tokenized = useTokenized(reader);
  const [view, setViewState] = React.useState<View>({ kind: "dashboard" });
  const [panel, setPanel] = React.useState<"roles" | "settings" | null>(null);
  const [weeklyDays, setWeeklyDays] = React.useState(data.weeklyDays);

  const roleIds = React.useMemo(
    () => settings.roleIds.filter((id) => reader.roles.some((role) => role.id === id)),
    [settings.roleIds, reader.roles],
  );
  const { items, units, byId } = React.useMemo(
    () => buildUnits(reader, tokenized, roleIds),
    [reader, tokenized, roleIds],
  );
  const rehearsals = React.useMemo(
    () => new Map(data.rehearsals.map((entry) => [entry.sceneId, entry.start])),
    [data.rehearsals],
  );
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const input: QueueInput = React.useMemo(
    () => ({ items, cards: store.cards, rehearsals, now }),
    [items, store.cards, rehearsals, now],
  );

  // Zurück-Taste des Telefons führt aus Fluss/Abfrage zum Dashboard.
  const setView = React.useCallback((next: View) => {
    if (next.kind !== "dashboard") window.history.pushState({ lernen: next.kind }, "");
    setViewState(next);
    window.scrollTo({ top: 0 });
  }, []);
  React.useEffect(() => {
    const onPop = () => setViewState({ kind: "dashboard" });
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const exit = React.useCallback(() => {
    if (window.history.state?.lernen) window.history.back();
    else setViewState({ kind: "dashboard" });
  }, []);

  // Meilenstein: Szene sitzt komplett.
  const solidScenes = React.useRef<Set<string> | null>(null);
  const progress = React.useMemo(() => sceneProgress(input), [input]);
  React.useEffect(() => {
    const solid = new Set(
      progress.filter((entry) => entry.total && entry.solid === entry.total).map((e) => e.sceneId),
    );
    if (solidScenes.current) {
      for (const id of solid) {
        if (!solidScenes.current.has(id)) {
          const title = reader.scenes.find((scene) => scene.id === id)?.title ?? "Szene";
          toast.success(`${title} sitzt!`, { description: "Alle Stellen sind fest im Kopf. ✨" });
        }
      }
    }
    solidScenes.current = solid;
  }, [progress, reader.scenes]);

  const commit = React.useCallback(
    (unit: Unit, rating: LearnRating, meta: ReviewMeta) => store.review(unit, rating, meta),
    [store],
  );

  const roleNames = reader.roles
    .filter((role) => roleIds.includes(role.id))
    .map((role) => role.name)
    .join(", ");

  if (view.kind === "flow") {
    const sceneIds = reader.scenes
      .map((scene) => scene.id)
      .filter((id) => units.some((unit) => unit.block.sceneId === id));
    const position = sceneIds.indexOf(view.sceneId);
    const nextScene = sceneIds[position + 1];
    return (
      <SceneFlow
        key={view.sceneId}
        reader={reader}
        tokenized={tokenized}
        units={units}
        sceneId={view.sceneId}
        cards={store.cards}
        settings={settings}
        onCommit={commit}
        onExit={exit}
        onNextScene={
          nextScene
            ? () => {
                window.scrollTo({ top: 0 });
                setViewState({ kind: "flow", sceneId: nextScene });
              }
            : null
        }
      />
    );
  }
  if (view.kind === "drill") {
    return (
      <Drill
        reader={reader}
        tokenized={tokenized}
        initial={view.units}
        cards={store.cards}
        settings={settings}
        title={view.title}
        onCommit={commit}
        onExit={exit}
        onMore={(seen) => {
          const exclude = new Set(
            items
              .filter((item) => seen.has(`${item.lineageId}|${item.chunk}`))
              .map((item) => item.key),
          );
          return itemsToUnits(moreQueue(input, exclude), byId);
        }}
      />
    );
  }

  return (
    <>
      <Dashboard
        data={data}
        input={input}
        units={units}
        byId={byId}
        roleNames={roleNames}
        hasRoles={roleIds.length > 0}
        weeklyDays={weeklyDays}
        reviewTimes={store.reviewTimes}
        pending={store.pending}
        offline={store.offline}
        onWeeklyDays={(days) => {
          setWeeklyDays(days);
          void setWeeklyDaysAction(showId, days);
        }}
        onFlow={(sceneId) => setView({ kind: "flow", sceneId })}
        onDrill={(drillUnits, title) => setView({ kind: "drill", units: drillUnits, title })}
        onRoles={() => setPanel("roles")}
        onSettings={() => setPanel("settings")}
      />
      <RolePicker
        open={panel === "roles"}
        onOpenChange={(open) => setPanel(open ? "roles" : null)}
        roles={reader.roles}
        ownRoleIds={reader.ownRoleIds}
        selected={roleIds}
        onChange={(ids) => updateSettings({ roleIds: ids })}
      />
      <LearnSettingsSheet
        open={panel === "settings"}
        onOpenChange={(open) => setPanel(open ? "settings" : null)}
        settings={settings}
        onChange={updateSettings}
        roles={reader.roles.filter((role) => roleIds.includes(role.id))}
        onReset={async (roleId) => {
          const result = await resetRoleAction(showId, roleId);
          if (result.ok) {
            store.resetRoleLocal(roleId);
            toast.success("Lernstand zurückgesetzt");
          } else toast.error(result.error);
        }}
      />
    </>
  );
}

function Dashboard({
  data,
  input,
  units,
  byId,
  roleNames,
  hasRoles,
  weeklyDays,
  reviewTimes,
  pending,
  offline,
  onWeeklyDays,
  onFlow,
  onDrill,
  onRoles,
  onSettings,
}: {
  data: LearnPageData;
  input: QueueInput;
  units: Unit[];
  byId: ReadonlyMap<string, Unit>;
  roleNames: string;
  hasRoles: boolean;
  weeklyDays: number;
  reviewTimes: string[];
  pending: number;
  offline: boolean;
  onWeeklyDays: (days: number) => void;
  onFlow: (sceneId: string) => void;
  onDrill: (units: Unit[], title: string) => void;
  onRoles: () => void;
  onSettings: () => void;
}) {
  const { reader } = data;
  const summary = React.useMemo(() => summarize(input), [input]);
  const today = React.useMemo(() => itemsToUnits(todayQueue(input), byId), [input, byId]);
  const progress = React.useMemo(() => sceneProgress(input), [input]);
  const progressByScene = new Map(progress.map((entry) => [entry.sceneId, entry]));
  const totals = progress.reduce(
    (sum, entry) => ({
      total: sum.total + entry.total,
      solid: sum.solid + entry.solid,
      learning: sum.learning + entry.learning,
    }),
    { total: 0, solid: 0, learning: 0 },
  );
  const scenesWithText = reader.scenes.filter((scene) => progressByScene.has(scene.id));
  const solidScenes = scenesWithText.filter((scene) => {
    const entry = progressByScene.get(scene.id);
    return entry && entry.solid === entry.total;
  }).length;

  // Szene zum Weitermachen: erste mit offenen oder fälligen Stellen.
  const continueScene =
    (today[0]?.block.sceneId ??
      scenesWithText.find((scene) => {
        const entry = progressByScene.get(scene.id);
        return entry && entry.solid < entry.total;
      })?.id) ||
    scenesWithText[0]?.id;

  const studyDays = React.useMemo(
    () => new Set(reviewTimes.map((time) => dayKey(new Date(time)))),
    [reviewTimes],
  );
  const week = weekDays(studyDays, input.now);
  const weekCount = week.filter(Boolean).length;
  const todayIndex = (input.now.getDay() + 6) % 7;
  const changedUnits = itemsToUnits(summary.changed, byId);
  const minutes = Math.max(1, Math.round((today.length * SECONDS_PER_ITEM) / 60));

  return (
    <div className="min-h-dvh pb-12">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-12 max-w-3xl items-center gap-1 px-1">
          <Button asChild variant="ghost" size="icon" aria-label="Zurück zum Skript">
            <Link href={SKRIPT_PATH}>
              <ArrowLeftIcon aria-hidden />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-medium">Text lernen</h1>
            <p className="truncate text-xs text-muted-foreground">
              {reader.version.showTitle} · {reader.version.label}
            </p>
          </div>
          {offline || pending > 0 ? (
            <span
              className="flex items-center gap-1 px-1 text-xs text-muted-foreground"
              title="Wird gespeichert, sobald wieder Netz da ist"
            >
              {offline ? <WifiOffIcon className="h-4 w-4" aria-hidden /> : null}
              {pending > 0 ? `${pending} offen` : "offline"}
            </span>
          ) : null}
          <Button asChild variant="ghost" size="icon" aria-label="Im Leser öffnen">
            <Link href={`/mitglieder/skript/${reader.version.id}`}>
              <BookOpenTextIcon aria-hidden />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" aria-label="Lern-Einstellungen" onClick={onSettings}>
            <SettingsIcon aria-hidden />
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 pt-4">
        <button
          type="button"
          onClick={onRoles}
          className="flex min-h-11 w-full items-center gap-3 border border-border px-3 py-2 text-left hover:bg-muted"
          data-testid="lernen-rollen"
        >
          <UsersIcon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-muted-foreground">Du lernst</span>
            <span className="block truncate font-medium">
              {roleNames || "Noch keine Rolle gewählt"}
            </span>
          </span>
          <ChevronRightIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
        </button>

        {!hasRoles ? (
          <section className="border border-dashed border-border px-4 py-10 text-center">
            <p className="font-medium">Welche Rolle möchtest du lernen?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Du kannst jede Rolle wählen – auch mehrere, auch fremde.
            </p>
            <Button className="mt-4" onClick={onRoles}>
              Rolle wählen
            </Button>
          </section>
        ) : (
          <>
            <section className="bg-primary/10 px-4 py-5" data-testid="lernen-heute">
              {changedUnits.length ? (
                <p className="mb-3 border-l-[3px] border-amber-500 bg-amber-400/15 px-3 py-2 text-sm">
                  In der neuen Fassung haben sich{" "}
                  <strong>
                    {changedUnits.length} {changedUnits.length === 1 ? "Stelle" : "Stellen"}
                  </strong>{" "}
                  deines Texts geändert – die kommen zuerst dran.
                </p>
              ) : null}
              {today.length ? (
                <>
                  <p className="text-sm text-muted-foreground">Heute dran</p>
                  <p className="mt-0.5 text-3xl font-semibold tabular-nums">
                    {today.length}{" "}
                    <span className="text-base font-normal text-muted-foreground">
                      {today.length === 1 ? "Stelle" : "Stellen"} · ca. {minutes} min
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[
                      changedUnits.length ? `${changedUnits.length} geändert` : null,
                      summary.due.length
                        ? `${itemsToUnits(summary.due, byId).length} zum Wiederholen`
                        : null,
                      `${today.length - changedUnits.length - itemsToUnits(summary.due, byId).length} neu`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Button
                      size="lg"
                      className="sm:flex-1"
                      onClick={() => onDrill(today, "Tagesabfrage")}
                    >
                      Abfrage starten <ArrowRightIcon aria-hidden />
                    </Button>
                    {continueScene ? (
                      <Button
                        size="lg"
                        variant="outline"
                        className="sm:flex-1"
                        onClick={() => onFlow(continueScene)}
                      >
                        Szene durchspielen
                      </Button>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-lg font-semibold">Für heute alles erledigt ✓</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Lust auf mehr? Neue Stellen oder eine Szene im Fluss gehen immer.
                  </p>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Button
                      size="lg"
                      className="sm:flex-1"
                      onClick={() =>
                        onDrill(itemsToUnits(moreQueue(input, new Set()), byId), "Mehr lernen")
                      }
                    >
                      Mehr lernen
                    </Button>
                    {continueScene ? (
                      <Button
                        size="lg"
                        variant="outline"
                        className="sm:flex-1"
                        onClick={() => onFlow(continueScene)}
                      >
                        Szene durchspielen
                      </Button>
                    ) : null}
                  </div>
                </>
              )}
            </section>

            <section
              aria-labelledby="lernen-woche"
              className="flex flex-wrap items-center gap-x-4 gap-y-2"
            >
              <div className="min-w-0 flex-1">
                <h2 id="lernen-woche" className="text-sm font-medium">
                  Wochenziel: {weekCount} von {weeklyDays} Tagen
                  {weekCount >= weeklyDays ? " 🎯" : ""}
                </h2>
                <div className="mt-2 flex gap-1.5">
                  {week.map((studied, index) => (
                    <div key={WEEKDAYS[index]} className="flex flex-col items-center gap-0.5">
                      <span
                        className={cn(
                          "h-7 w-7 border",
                          studied ? "border-primary bg-primary" : "border-border",
                          index === todayIndex && !studied && "border-primary",
                        )}
                        aria-label={`${WEEKDAYS[index]}: ${studied ? "gelernt" : "nicht gelernt"}`}
                      />
                      <span className="text-[10px] text-muted-foreground">{WEEKDAYS[index]}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1" aria-label="Wochenziel ändern">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Weniger Tage"
                  disabled={weeklyDays <= 1}
                  onClick={() => onWeeklyDays(weeklyDays - 1)}
                >
                  <MinusIcon aria-hidden />
                </Button>
                <span className="w-8 text-center text-sm tabular-nums">{weeklyDays}</span>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Mehr Tage"
                  disabled={weeklyDays >= 7}
                  onClick={() => onWeeklyDays(weeklyDays + 1)}
                >
                  <PlusIcon aria-hidden />
                </Button>
              </div>
            </section>

            {data.rehearsals.some((entry) => progressByScene.has(entry.sceneId)) ? (
              <section aria-labelledby="lernen-proben">
                <h2 id="lernen-proben" className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <CalendarIcon className="h-4 w-4" aria-hidden /> Nächste Proben
                </h2>
                <ul className="divide-y divide-border/60 border-y border-border/60">
                  {data.rehearsals
                    .filter((entry) => progressByScene.has(entry.sceneId))
                    .slice(0, 5)
                    .map((entry) => {
                      const scene = reader.scenes.find(
                        (candidate) => candidate.id === entry.sceneId,
                      );
                      const sure = Math.round(
                        confidence(progressByScene.get(entry.sceneId)!) * 100,
                      );
                      return (
                        <li key={entry.sceneId}>
                          <button
                            type="button"
                            onClick={() => onFlow(entry.sceneId)}
                            className="flex min-h-12 w-full items-center gap-3 py-2 text-left hover:bg-muted"
                          >
                            <span className="w-16 shrink-0 text-xs text-muted-foreground">
                              {new Date(entry.start).toLocaleDateString("de-DE", {
                                weekday: "short",
                                day: "numeric",
                                month: "numeric",
                              })}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-sm">{scene?.title}</span>
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {sure} %
                            </span>
                            <ChevronRightIcon
                              className="h-4 w-4 text-muted-foreground"
                              aria-hidden
                            />
                          </button>
                        </li>
                      );
                    })}
                </ul>
              </section>
            ) : null}

            <section aria-labelledby="lernen-szenen">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h2 id="lernen-szenen" className="text-sm font-medium">
                  Szenen
                </h2>
                <span className="text-xs text-muted-foreground">
                  <Legend className="bg-emerald-500" /> sitzt <Legend className="bg-amber-500" />{" "}
                  lernend <Legend className="bg-muted-foreground/25" /> neu
                </span>
              </div>
              <ul className="divide-y divide-border/60 border-y border-border/60">
                {scenesWithText.map((scene) => {
                  const entry = progressByScene.get(scene.id)!;
                  const rehearsal = input.rehearsals.get(scene.id);
                  return (
                    <li key={scene.id}>
                      <button
                        type="button"
                        onClick={() => onFlow(scene.id)}
                        className="w-full py-2.5 text-left hover:bg-muted"
                        data-testid="lernen-szene"
                      >
                        <span className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm">{scene.title}</span>
                          {entry.changed ? (
                            <span className="shrink-0 rounded-sm bg-amber-400/25 px-1.5 text-[11px] text-amber-800 dark:text-amber-300">
                              {entry.changed} geändert
                            </span>
                          ) : null}
                          {rehearsal ? (
                            <CalendarIcon
                              className="h-3.5 w-3.5 shrink-0 text-primary"
                              aria-label="Wird bald geprobt"
                            />
                          ) : null}
                          {entry.solid === entry.total ? (
                            <TrophyIcon
                              className="h-3.5 w-3.5 shrink-0 text-emerald-600"
                              aria-label="Sitzt"
                            />
                          ) : null}
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {entry.solid}/{entry.total}
                          </span>
                        </span>
                        <span className="mt-1.5 flex h-1.5 overflow-hidden bg-muted-foreground/15">
                          <span
                            className="bg-emerald-500"
                            style={{ width: `${(entry.solid / entry.total) * 100}%` }}
                          />
                          <span
                            className="bg-amber-500"
                            style={{ width: `${(entry.learning / entry.total) * 100}%` }}
                          />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section
              aria-labelledby="lernen-meilensteine"
              className="grid grid-cols-3 gap-2 text-center"
            >
              <h2 id="lernen-meilensteine" className="sr-only">
                Fortschritt
              </h2>
              <Milestone value={`${solidScenes}/${scenesWithText.length}`} label="Szenen sitzen" />
              <Milestone
                value={`${totals.total ? Math.round(((totals.solid + totals.learning / 2) / totals.total) * 100) : 0} %`}
                label="Textsicherheit"
              />
              <Milestone value={String(units.length)} label="Stellen gesamt" />
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Legend({ className }: { className: string }) {
  return <span className={cn("ml-1.5 inline-block h-2 w-2 align-middle", className)} aria-hidden />;
}

function Milestone({ value, label }: { value: string; label: string }) {
  return (
    <div className="border border-border px-2 py-3">
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function RolePicker({
  open,
  onOpenChange,
  roles,
  ownRoleIds,
  selected,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: LearnPageData["reader"]["roles"];
  ownRoleIds: string[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const sorted = [...roles].sort(
    (a, b) => Number(ownRoleIds.includes(b.id)) - Number(ownRoleIds.includes(a.id)),
  );
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Rollen lernen"
      description="Jede Rolle ist wählbar – deine eigene ist vorausgewählt."
      showDescription
    >
      <ul className="divide-y divide-border/60">
        {sorted.map((role) => {
          const checked = selected.includes(role.id);
          return (
            <li key={role.id}>
              <label className="flex min-h-12 cursor-pointer items-center gap-3 py-2">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(value) =>
                    onChange(
                      value ? [...selected, role.id] : selected.filter((id) => id !== role.id),
                    )
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">
                    {role.name}
                    {ownRoleIds.includes(role.id) ? (
                      <span className="ml-2 text-xs font-normal text-primary">deine Rolle</span>
                    ) : null}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {role.lines} Repliken · {role.words} Wörter · {role.sceneIds.length} Szenen
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </BottomSheet>
  );
}

function LearnSettingsSheet({
  open,
  onOpenChange,
  settings,
  onChange,
  roles,
  onReset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: ReturnType<typeof useLearnSettings>[0];
  onChange: ReturnType<typeof useLearnSettings>[1];
  roles: LearnPageData["reader"]["roles"];
  onReset: (roleId: string) => Promise<void>;
}) {
  const [confirm, setConfirm] = React.useState<{ id: string; name: string } | null>(null);
  const stages: ("auto" | Stage)[] = ["auto", "full", "cloze", "initials", "hidden"];
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Lern-Einstellungen"
      description="Wie der Text verdeckt wird"
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <p className="text-sm font-medium">Verdecken</p>
          <div className="flex flex-col gap-1">
            {stages.map((stage) => (
              <label key={stage} className="flex min-h-10 cursor-pointer items-center gap-3">
                <input
                  type="radio"
                  name="lernen-stufe"
                  className="h-4 w-4 accent-[var(--primary)]"
                  checked={settings.stage === stage}
                  onChange={() => onChange({ stage })}
                />
                <span className="text-sm">
                  {stage === "auto" ? "Automatisch (nach Lernstand)" : STAGE_LABEL[stage]}
                  {stage === "full" ? (
                    <span className="block text-xs text-muted-foreground">
                      Nur lesen, wird nicht bewertet
                    </span>
                  ) : null}
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Schriftgröße</p>
          <SegmentedControl
            aria-label="Schriftgröße"
            value={String(settings.fontSize)}
            onValueChange={(value) => onChange({ fontSize: Number(value) })}
            options={["0", "1", "2", "3"].map((value, index) => ({
              value,
              label: <span style={{ fontSize: `${0.8 + index * 0.12}rem` }}>A</span>,
              ariaLabel: `Stufe ${index + 1}`,
            }))}
          />
        </div>
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-medium">Fremde Repliken vorlesen</span>
            <span className="block text-xs text-muted-foreground">
              Im Szenenfluss, mit der Stimme des Geräts
            </span>
          </span>
          <Switch checked={settings.speak} onCheckedChange={(speak) => onChange({ speak })} />
        </label>
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-medium">Tippmodus</span>
            <span className="block text-xs text-muted-foreground">
              Anfangsbuchstaben auf der Tastatur tippen – Fehler zählen wie Aufdecken
            </span>
          </span>
          <Switch checked={settings.typing} onCheckedChange={(typing) => onChange({ typing })} />
        </label>
        {roles.length ? (
          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-sm font-medium">Lernstand zurücksetzen</p>
            <div className="flex flex-wrap gap-2">
              {roles.map((role) => (
                <Button key={role.id} variant="outline" size="sm" onClick={() => setConfirm(role)}>
                  {role.name}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(value) => !value && setConfirm(null)}
        title="Lernstand zurücksetzen?"
        description={`Alles Gelernte für „${confirm?.name ?? ""}“ wird gelöscht und beginnt von vorn.`}
        confirmLabel="Zurücksetzen"
        cancelLabel="Abbrechen"
        variant="destructive"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) void onReset(confirm.id);
          setConfirm(null);
        }}
      />
    </BottomSheet>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BarChart3Icon,
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
import { ProgressRing } from "@/components/ui/progress-ring";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { milestones } from "@/lib/skript/learn/insights";
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
import {
  STAGE_LABEL,
  inFinalSpurt,
  type LearnRating,
  type Stage,
} from "@/lib/skript/learn/schedule";
import type { LearnPageData } from "@/lib/skript/learn/service";
import { cn } from "@/lib/utils";

import { SKRIPT_PATH, readStored, writeStored } from "../../skript/shared";
import { resetRoleAction, setWeeklyDaysAction } from "./actions";
import { Celebration } from "./celebrate";
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
import { LearnStats } from "./stats";

type View =
  | { kind: "dashboard" }
  | { kind: "flow"; sceneId: string }
  | { kind: "drill"; units: Unit[]; title: string }
  | { kind: "stats" };

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
    () => buildUnits(reader, tokenized, roleIds, settings.groups ?? true),
    [reader, tokenized, roleIds, settings.groups],
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

  // Offline: Seite beim Öffnen in den Cache des Service Workers legen (auch wenn sie per
  // Client-Navigation geöffnet wurde) und den Titel für die Offline-Seite merken.
  const [offlineReady, setOfflineReady] = React.useState(false);
  React.useEffect(() => {
    const path = window.location.pathname;
    const titles = readStored<Record<string, string>>("lernen-offline-titel") ?? {};
    writeStored("lernen-offline-titel", { ...titles, [path]: reader.version.showTitle });
    if (!("caches" in window)) return;
    if (!navigator.onLine) {
      void caches.match(path, { cacheName: "lernen-pages" }).then((hit) => setOfflineReady(!!hit));
      return;
    }
    caches
      .open("lernen-pages")
      .then((cache) => cache.add(new Request(path, { credentials: "same-origin" })))
      .then(() => setOfflineReady(true))
      .catch((error) => console.warn("[lernen] Offline-Kopie nicht gespeichert", error));
  }, [reader.version.showTitle]);

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

  // Meilenstein: Szene sitzt komplett → kurze Feier (Vorhang auf).
  const [celebrate, setCelebrate] = React.useState<{ title: string; description: string } | null>(
    null,
  );
  const endCelebration = React.useCallback(() => setCelebrate(null), []);
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
          setCelebrate({
            title: `${title} sitzt!`,
            description: "Alle deine Stellen sind fest im Kopf.",
          });
        }
      }
    }
    solidScenes.current = solid;
  }, [progress, reader.scenes]);

  const commit = React.useCallback(
    (unit: Unit, rating: LearnRating, meta: ReviewMeta) => store.review(unit, rating, meta),
    [store],
  );

  const sureNow = React.useMemo(() => confidence(input), [input]);

  // Neu erreichte Meilensteine feiern; beim allerersten Laden nur merken (keine Feier für Altes).
  const badges = React.useMemo(
    () => milestones(input, store.history, weeklyDays),
    [input, store.history, weeklyDays],
  );
  React.useEffect(() => {
    const key = `lernen-meilensteine:${showId}:${[...roleIds].sort().join(",")}`;
    const known = readStored<string[]>(key);
    const achieved = badges.filter((badge) => badge.achieved);
    const fresh = known ? achieved.filter((badge) => !known.includes(badge.id)) : [];
    if (!known || fresh.length) {
      writeStored(key, [...new Set([...(known ?? []), ...achieved.map((badge) => badge.id)])]);
    }
    const latest = fresh.at(-1);
    if (latest) setCelebrate({ title: latest.label, description: latest.detail });
  }, [badges, showId, roleIds]);

  const celebration = (
    <AnimatePresence>
      {celebrate ? (
        <Celebration
          key={celebrate.title}
          title={celebrate.title}
          description={celebrate.description}
          onDone={endCelebration}
        />
      ) : null}
    </AnimatePresence>
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
      <>
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
        {celebration}
      </>
    );
  }
  if (view.kind === "drill") {
    return (
      <>
        <Drill
          reader={reader}
          tokenized={tokenized}
          initial={view.units}
          cards={store.cards}
          settings={settings}
          title={view.title}
          sureNow={sureNow}
          premiere={data.premiereAt}
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
        {celebration}
      </>
    );
  }
  if (view.kind === "stats") {
    return (
      <LearnStats
        reader={reader}
        tokenized={tokenized}
        input={input}
        history={store.history}
        byId={byId}
        weeklyDays={weeklyDays}
        onExit={exit}
        onDrill={(drillUnits, title) => setView({ kind: "drill", units: drillUnits, title })}
        onFlow={(sceneId) => setView({ kind: "flow", sceneId })}
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
          // Ohne Netz später nachholen (einmal, mit dem zuletzt gewählten Wert).
          const save = () =>
            setWeeklyDaysAction(showId, days).catch(() =>
              window.addEventListener("online", () => void save(), { once: true }),
            );
          void save();
        }}
        onFlow={(sceneId) => setView({ kind: "flow", sceneId })}
        onDrill={(drillUnits, title) => setView({ kind: "drill", units: drillUnits, title })}
        onRoles={() => setPanel("roles")}
        onSettings={() => setPanel("settings")}
        onStats={() => setView({ kind: "stats" })}
      />
      {celebration}
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
        offlineReady={offlineReady}
        onReset={async (roleId) => {
          const result = await resetRoleAction(showId, roleId).catch(() => ({
            ok: false as const,
            error: "Zurücksetzen geht nur mit Verbindung.",
          }));
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
  onStats,
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
  onStats: () => void;
}) {
  const { reader } = data;
  const summary = React.useMemo(() => summarize(input), [input]);
  const today = React.useMemo(() => itemsToUnits(todayQueue(input), byId), [input, byId]);
  const progress = React.useMemo(() => sceneProgress(input), [input]);
  const progressByScene = new Map(progress.map((entry) => [entry.sceneId, entry]));
  const sureNow = React.useMemo(() => confidence(input), [input]);
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
  const upcoming = data.rehearsals.find((entry) => progressByScene.has(entry.sceneId));
  const nextRehearsal = upcoming
    ? {
        sceneId: upcoming.sceneId,
        start: upcoming.start,
        title: reader.scenes.find((scene) => scene.id === upcoming.sceneId)?.title ?? "",
        sure: confidence(
          input,
          new Date(Math.max(Date.parse(upcoming.start), input.now.getTime())),
          upcoming.sceneId,
        ),
      }
    : null;

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
              {inFinalSpurt(data.premiereAt, input.now) ? (
                <p
                  className="mb-3 border-l-[3px] border-primary bg-primary/10 px-3 py-2 text-sm"
                  data-testid="lernen-endspurt"
                >
                  <strong>Endspurt:</strong> Premiere {daysUntil(data.premiereAt!, input.now)} –
                  Wiederholungen kommen jetzt öfter, damit der Text am Abend sicher sitzt.
                </p>
              ) : null}
              {changedUnits.length ? (
                <p className="mb-3 border-l-[3px] border-warning bg-warning/10 px-3 py-2 text-sm">
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

            <Overview
              sure={sureNow}
              solidScenes={solidScenes}
              scenes={scenesWithText.length}
              next={nextRehearsal}
              now={input.now}
              onStats={onStats}
              onFlow={onFlow}
            />

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
                      // Prognose: wie sicher die Szene am Probentag sitzt, wenn bis dahin nichts geübt wird.
                      const sure = Math.round(
                        confidence(
                          input,
                          new Date(Math.max(Date.parse(entry.start), input.now.getTime())),
                          entry.sceneId,
                        ) * 100,
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
                            <span
                              className={cn(
                                "text-xs tabular-nums",
                                sure >= 90
                                  ? "text-success"
                                  : sure >= 60
                                    ? "text-muted-foreground"
                                    : "text-warning",
                              )}
                              title="Voraussichtliche Textsicherheit am Probentag"
                            >
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
                  <Legend className="bg-success" /> sitzt <Legend className="bg-warning" /> lernend{" "}
                  <Legend className="bg-muted-foreground/25" /> neu
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
                            <span className="shrink-0 rounded-sm bg-warning/20 px-1.5 text-[11px] text-warning">
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
                              className="h-3.5 w-3.5 shrink-0 text-success"
                              aria-label="Sitzt"
                            />
                          ) : null}
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                            {entry.solid} von {entry.total} sitzen
                            {entry.due ? (
                              <span className="font-medium text-primary">
                                {" "}
                                · {entry.due} fällig
                              </span>
                            ) : null}
                          </span>
                        </span>
                        <span className="mt-1.5 flex h-1.5 overflow-hidden bg-muted-foreground/15">
                          <span
                            className="bg-success"
                            style={{ width: `${(entry.solid / entry.total) * 100}%` }}
                          />
                          <span
                            className="bg-warning"
                            style={{ width: `${(entry.learning / entry.total) * 100}%` }}
                          />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
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

function daysUntil(start: string, now: Date) {
  const day = (date: Date) => {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy.getTime();
  };
  const days = Math.round((day(new Date(start)) - day(now)) / 86_400_000);
  if (days <= 0) return "heute";
  if (days === 1) return "morgen";
  return `in ${days} Tagen`;
}

/** Gesamtstand: Textsicherheit, Szenen, nächste Probe mit Prognose, Zugang zur Statistik. */
function Overview({
  sure,
  solidScenes,
  scenes,
  next,
  now,
  onStats,
  onFlow,
}: {
  sure: number;
  solidScenes: number;
  scenes: number;
  next: { sceneId: string; start: string; title: string; sure: number } | null;
  now: Date;
  onStats: () => void;
  onFlow: (sceneId: string) => void;
}) {
  const percent = Math.round(sure * 100);
  const nextPercent = next ? Math.round(next.sure * 100) : 0;
  return (
    <section aria-label="Gesamtstand" className="flex flex-col gap-3 sm:flex-row">
      <button
        type="button"
        onClick={onStats}
        className="flex min-h-20 flex-1 items-center gap-3 border border-border px-3 py-2 text-left hover:bg-muted"
        data-testid="lernen-ueberblick"
      >
        <ProgressRing
          value={percent}
          max={100}
          size={56}
          strokeWidth={5}
          label={`${percent} %`}
          className="text-sm"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">Textsicherheit</span>
          <span className="block text-xs text-muted-foreground">
            {solidScenes} von {scenes} Szenen sitzen
          </span>
        </span>
        <span className="flex items-center gap-1 text-xs text-primary">
          <BarChart3Icon className="h-4 w-4" /> Statistik
        </span>
      </button>
      {next ? (
        <button
          type="button"
          onClick={() => onFlow(next.sceneId)}
          className="flex min-h-20 flex-1 items-center gap-3 border border-border px-3 py-2 text-left hover:bg-muted"
        >
          <CalendarIcon className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Probe {daysUntil(next.start, now)}</span>
            <span className="block truncate text-xs text-muted-foreground">{next.title}</span>
          </span>
          <span
            className={cn(
              "text-right text-xs",
              nextPercent >= 90
                ? "text-success"
                : nextPercent >= 60
                  ? "text-muted-foreground"
                  : "text-warning",
            )}
          >
            <span className="block text-base font-semibold tabular-nums">{nextPercent} %</span>
            zur Probe
          </span>
        </button>
      ) : null}
    </section>
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
  offlineReady,
  onReset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: ReturnType<typeof useLearnSettings>[0];
  onChange: ReturnType<typeof useLearnSettings>[1];
  roles: LearnPageData["reader"]["roles"];
  offlineReady: boolean;
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
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-medium">Gruppenpassagen mitlernen</span>
            <span className="block text-xs text-muted-foreground">
              Repliken wie „Alle“ oder „Chor“, bei denen du mitsprichst
            </span>
          </span>
          <Switch
            checked={settings.groups ?? true}
            onCheckedChange={(groups) => onChange({ groups })}
          />
        </label>
        <div className="rounded-lg border border-border bg-muted px-3 py-2 text-sm">
          <p className="font-medium">
            {offlineReady ? "Offline nutzbar ✓" : "Offline noch nicht bereit"}
          </p>
          <p className="text-xs text-muted-foreground">
            {offlineReady
              ? "Diese Seite geht auch ohne Netz (z. B. im Zug). Bewertungen werden nachgereicht, sobald wieder Verbindung da ist."
              : "Einmal mit Verbindung öffnen, dann geht Lernen auch ohne Netz."}
          </p>
        </div>
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

"use client";

import * as React from "react";

import { ArrowLeftIcon, EyeIcon, SparklesIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import type { TokenizedBlock } from "@/lib/skript/learn/chunks";
import type { StoredCard } from "@/lib/skript/learn/plan";
import {
  applyReview,
  capRating,
  previewIntervals,
  type LearnRating,
} from "@/lib/skript/learn/schedule";
import { State } from "ts-fsrs";
import type { ScriptReaderData } from "@/lib/skript/reader";
import { splitTail } from "@/lib/skript/reader-logic";
import { cn } from "@/lib/utils";

import { FONT_SIZES } from "../../skript/shared";
import { CountUp, RatingFlash, useRatingFlash } from "./celebrate";
import { ChangeDiff } from "./change-diff";
import { MaskedBlockText, useHold } from "./masked";
import { unitCard, type LearnSettings, type ReviewMeta, type Unit } from "./model";
import {
  BigButton,
  RevealButtons,
  plainText,
  RatingButtons,
  unitStage,
  usePractice,
  useLearnKeys,
  useSwipeLeft,
  useWakeLock,
} from "./practice";
import { isSpoken } from "@/lib/skript/types";

/** Nach „Nochmal“ (oder solange noch im Lernschritt) kommt der Abschnitt so viele Karten später wieder. */
const AGAIN_GAP = 4;
/** Höchstens so oft je Runde, damit eine schwierige Stelle die Runde nicht blockiert. */
const MAX_SHOWINGS = 3;

/**
 * Abfrage im Stil von Lernkarten: Stichwort groß, eigener Abschnitt verdeckt. Aufsagen, dann
 * „Aufdecken & prüfen“ und selbst bewerten (Vorschlag aus den Tipps hervorgehoben).
 */
export function Drill({
  reader,
  tokenized,
  initial,
  cards,
  settings,
  title,
  sureNow,
  premiere,
  onCommit,
  onExit,
  onMore,
}: {
  reader: ScriptReaderData;
  tokenized: ReadonlyMap<string, TokenizedBlock>;
  initial: readonly Unit[];
  cards: ReadonlyMap<string, StoredCard>;
  settings: LearnSettings;
  title: string;
  /** Aktuelle Textsicherheit (0–1), für den Zuwachs am Rundenende. */
  sureNow: number;
  /** Premiere (ISO) – Endspurt-Regeln wie beim Speichern. */
  premiere: string | null;
  onCommit: (unit: Unit, rating: LearnRating, meta: ReviewMeta) => void;
  onExit: () => void;
  /** Weitere Abschnitte nach dem Ende („Mehr lernen“, L5); leer = nichts mehr da. */
  onMore: (seen: ReadonlySet<string>) => Unit[];
}) {
  useWakeLock(true);
  const [queue, setQueue] = React.useState<Unit[]>(() => [...initial]);
  const [index, setIndex] = React.useState(0);
  const [done, setDone] = React.useState(0);
  const flash = useRatingFlash();
  // Für die Zusammenfassung am Ende.
  const [sureAtStart] = React.useState(sureNow);
  const [tally, setTally] = React.useState({
    knew: 0,
    seen: new Set<string>(),
    fresh: new Set<string>(),
  });
  const unit = queue[index] ?? null;
  const finished = !unit;

  const stageRef = React.useRef(new Map<string, ReturnType<typeof unitStage>>());
  const stageInfo = React.useMemo(() => {
    if (!unit) return { stage: "hidden" as const, seed: 0, changed: false };
    const key = `${unit.id}#${index}`;
    const known = stageRef.current.get(key);
    if (known) return known;
    const info = unitStage(unit, cards, settings.stage === "full" ? "auto" : settings.stage);
    stageRef.current.set(key, info);
    return info;
  }, [unit, index, cards, settings.stage]);
  const tokens = unit ? tokenized.get(unit.block.id) : undefined;
  const practice = usePractice(unit, tokens, stageInfo.stage, stageInfo.seed, index);
  // Die Abfrage verdeckt immer etwas (Volltext gilt hier als automatisch).
  const stage = stageInfo.stage === "full" ? "hidden" : stageInfo.stage;
  const suggestion = practice.result();

  // Geprüft (ganz aufgedeckt oder im Tippmodus fertig) → selbst bewerten.
  const phase: "ask" | "rate" = practice.progress.whole || practice.solved ? "rate" : "ask";
  const [showDiff, setShowDiff] = React.useState(false);
  const [diffIndex, setDiffIndex] = React.useState(index);
  if (diffIndex !== index) {
    setDiffIndex(index);
    setShowDiff(false);
  }

  const intervals = React.useMemo(() => {
    if (!unit) return null;
    return previewIntervals(unitCard(unit, cards).card, new Date(), {
      changed: stageInfo.changed,
      stage,
      premiere,
    });
  }, [unit, cards, stageInfo.changed, stage, premiere]);

  // Noch im Lernschritt (neu, „Nochmal“) → in dieser Runde wiederholen statt erst beim nächsten Mal.
  const requeue = (target: Unit, position: number) =>
    setQueue((current) => {
      if (current.filter((entry) => entry.id === target.id).length >= MAX_SHOWINGS) return current;
      const next = [...current];
      next.splice(Math.min(next.length, position + 1 + AGAIN_GAP), 0, target);
      return next;
    });
  const stillLearning = (target: Unit, rating: LearnRating) => {
    if (rating === 1) return true;
    const { card, changed } = unitCard(target, cards);
    return (
      applyReview(card, rating, new Date(), { changed, stage, premiere }).state !== State.Review
    );
  };

  const advance = (rating: LearnRating) => {
    if (!unit) return;
    flash.show(rating);
    const isNew = !unitCard(unit, cards).card;
    setTally((current) => ({
      knew: current.knew + (rating >= 2 ? 1 : 0),
      seen: new Set(current.seen).add(unit.id),
      fresh: isNew ? new Set(current.fresh).add(unit.id) : current.fresh,
    }));
    if (stillLearning(unit, rating)) requeue(unit, index);
    setIndex((current) => current + 1);
    setDone((count) => count + 1);
  };

  const rate = (wanted: LearnRating) => {
    if (!unit) return;
    const rating = capRating(wanted, stage);
    onCommit(unit, rating, {
      auto: rating === suggestion.rating,
      revealed: suggestion.revealed,
      mode: "drill",
      stage,
    });
    advance(rating);
  };

  const more = () => {
    const seen = new Set(queue.map((entry) => entry.id));
    const extra = onMore(seen);
    if (!extra.length) return;
    setQueue((current) => [...current, ...extra]);
  };
  const [noMore, setNoMore] = React.useState(false);

  useLearnKeys({
    enabled: !finished,
    onNext: phase === "ask" ? practice.revealAll : () => rate(suggestion.rating),
    onRevealAll: practice.revealAll,
    onRevealNext: practice.revealNext,
    onLetter: settings.typing && phase === "ask" ? practice.typeKey : undefined,
    onRate: phase === "rate" ? rate : undefined,
  });
  const hold = useHold(practice.revealAll, !finished && phase === "ask");
  const swipe = useSwipeLeft(() =>
    phase === "ask" ? practice.revealAll() : rate(suggestion.rating),
  );

  // Kontext: vorige Replik (Stichwort betont) oder der eigene Abschnitt davor.
  const context = ((): { speaker: string | null; text: string; own: boolean } | null => {
    if (!unit) return null;
    if (unit.chunk > 0) return { speaker: unit.block.speaker, text: "", own: true };
    for (let i = unit.blockIndex - 1; i >= 0; i--) {
      const block = reader.blocks[i];
      if (block.sceneId !== unit.block.sceneId) break;
      if (!isSpoken(block.kind)) continue;
      return { speaker: block.speaker, text: plainText(block.parts), own: false };
    }
    return { speaker: null, text: "", own: false };
  })();
  const scene = unit ? reader.scenes.find((entry) => entry.id === unit.block.sceneId) : null;
  const [head, tail] = context?.text ? splitTail(context.text) : ["", ""];

  return (
    <div className="flex min-h-dvh flex-col" {...swipe}>
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-12 max-w-2xl items-center gap-1 px-1">
          <Button variant="ghost" size="icon" aria-label="Zurück zur Übersicht" onClick={onExit}>
            <ArrowLeftIcon aria-hidden />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{title}</p>
            <p className="truncate text-xs text-muted-foreground">{scene?.title ?? ""}</p>
          </div>
          <span className="px-2 text-xs tabular-nums text-muted-foreground" aria-live="polite">
            {done}/{queue.length}
          </span>
        </div>
        <div className="h-0.5 bg-muted">
          <div
            className="h-full bg-primary transition-[width]"
            style={{ width: `${queue.length ? (done / queue.length) * 100 : 100}%` }}
          />
        </div>
      </header>

      {finished ? (
        <main
          className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 text-center"
          data-testid="lernen-abfrage-fertig"
        >
          <SparklesIcon className="h-10 w-10 text-primary" aria-hidden />
          <h2 className="mt-3 text-xl font-semibold">Geschafft!</h2>
          <div className="mt-5 grid w-full grid-cols-3 gap-2" data-testid="lernen-zusammenfassung">
            <SummaryValue label={tally.seen.size === 1 ? "Stelle geübt" : "Stellen geübt"}>
              <CountUp value={tally.seen.size} />
            </SummaryValue>
            <SummaryValue label={`gewusst (${done} Abfragen)`}>
              <CountUp
                value={done ? (tally.knew / done) * 100 : 0}
                format={(value) => `${Math.round(value)} %`}
              />
            </SummaryValue>
            <SummaryValue label="Textsicherheit">
              <CountUp
                value={Math.max(0, (sureNow - sureAtStart) * 100)}
                format={(value) => `+${value < 10 ? value.toFixed(1) : Math.round(value)} %`}
              />
            </SummaryValue>
          </div>
          {tally.fresh.size ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {tally.fresh.size} {tally.fresh.size === 1 ? "neue Stelle" : "neue Stellen"}{" "}
              angefangen.
            </p>
          ) : null}
          <p className="mt-1 text-sm text-muted-foreground">Lust auf mehr?</p>
          <div className="mt-6 flex w-full flex-col gap-2">
            {!noMore ? (
              <Button
                onClick={() => {
                  const before = queue.length;
                  more();
                  if (before === queue.length) setNoMore(true);
                }}
              >
                Mehr lernen
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Für diese Rolle ist gerade nichts weiter offen.
              </p>
            )}
            <Button variant="ghost" onClick={onExit}>
              Zur Übersicht
            </Button>
          </div>
        </main>
      ) : (
        <main
          className={cn(
            "mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-4 pb-48 pt-6",
            FONT_SIZES[settings.fontSize] ?? FONT_SIZES[1],
          )}
        >
          {context && (context.text || context.own) ? (
            <section className="text-muted-foreground">
              <p className="text-[0.75em] font-semibold uppercase tracking-wider">
                {context.own ? "Du davor" : (context.speaker ?? "Davor")}
              </p>
              {context.own && tokens && unit ? (
                <p className="leading-relaxed">
                  <MaskedBlockText
                    tokenized={tokens}
                    active={unit.chunk}
                    done={false}
                    stage="full"
                    seed={0}
                    progress={null}
                    typingTarget={null}
                    range="earlier"
                  />
                </p>
              ) : (
                <p className="leading-relaxed">
                  {head.length > 160 ? "… " + head.slice(-160).replace(/^\S*\s/, "") : head}
                  <strong className="font-semibold text-foreground">{tail}</strong>
                </p>
              )}
            </section>
          ) : (
            <p className="text-sm text-muted-foreground">Szenenanfang</p>
          )}

          {unit && tokens ? (
            <section
              {...hold.handlers}
              data-testid="lernen-karte"
              className="select-none border-l-[3px] border-primary bg-primary/5 px-3 py-3"
            >
              <p className="text-[0.75em] font-semibold uppercase tracking-wider text-primary">
                {unit.block.speaker}
                {stageInfo.changed ? (
                  <span className="ml-2 rounded-sm bg-warning/20 px-1 py-px normal-case tracking-normal text-warning">
                    Text geändert
                  </span>
                ) : null}
              </p>
              <p className="text-[1.1em] leading-relaxed">
                {unit.chunk > 0 ? <span className="text-muted-foreground">… </span> : null}
                <MaskedBlockText
                  tokenized={tokens}
                  active={unit.chunk}
                  done={false}
                  stage={stageInfo.stage}
                  seed={stageInfo.seed}
                  progress={practice.progress}
                  typingTarget={settings.typing && phase === "ask" ? practice.target : null}
                  onRevealWord={practice.revealWord}
                  range="active"
                />
              </p>
            </section>
          ) : null}
          {unit && stageInfo.changed ? (
            <ChangeDiff
              before={unitCard(unit, cards).card?.text}
              after={unit.items[0]?.text ?? ""}
              open={showDiff || phase === "rate"}
              onOpen={() => {
                practice.revealAll();
                setShowDiff(true);
              }}
            />
          ) : null}
        </main>
      )}

      <RatingFlash token={flash.token} rating={flash.rating} />
      {!finished ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <div className="mx-auto max-w-2xl space-y-1 px-3 py-2">
            {phase === "ask" ? (
              <div className="flex gap-2">
                <RevealButtons onNext={practice.revealNext} disabled={practice.target === null} />
                <BigButton onClick={practice.revealAll} title="Leertaste oder Text halten">
                  <EyeIcon aria-hidden /> Aufdecken & prüfen
                </BigButton>
              </div>
            ) : (
              <RatingButtons
                stage={stage}
                suggestion={suggestion.rating}
                tips={suggestion.tips}
                intervals={intervals}
                onRate={rate}
              />
            )}
            <p className="hidden text-center text-[11px] text-muted-foreground sm:block">
              {phase === "ask"
                ? `Laut aufsagen, dann Leertaste zum Prüfen · ↓ Tipp (ein Wort)${settings.typing ? " · Anfangsbuchstaben tippen" : ""}`
                : "Tasten 1–4 · Enter übernimmt den Vorschlag"}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SummaryValue({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border border-border px-2 py-3">
      <p className="text-xl font-semibold">{children}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

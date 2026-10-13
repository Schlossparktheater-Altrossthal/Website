"use client";

import * as React from "react";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  AudioLinesIcon,
  KeyboardIcon,
} from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import type { TokenizedBlock } from "@/lib/skript/learn/chunks";
import type { StoredCard } from "@/lib/skript/learn/plan";
import { STAGE_LABEL, type LearnRating } from "@/lib/skript/learn/schedule";
import type { ReaderBlock, ScriptReaderData } from "@/lib/skript/reader";
import { cn } from "@/lib/utils";

import { FONT_SIZES } from "../../skript/shared";
import { RatingFlash, useRatingFlash } from "./celebrate";
import { MaskedBlockText, useHold } from "./masked";
import {
  unitCard,
  useDeferredReview,
  type LearnSettings,
  type ReviewMeta,
  type Unit,
} from "./model";
import {
  BigButton,
  CorrectionBar,
  RATING_STYLE,
  RevealButtons,
  spokenText,
  unitStage,
  usePractice,
  useLearnKeys,
  useSpeech,
  useSwipeLeft,
  useWakeLock,
} from "./practice";

/** Kürzer angezeigt und nichts aufgedeckt = weitergeklickt, nicht abgefragt. */
const MIN_ANSWER_MS = 1500;

/**
 * Szenenfluss (docs/Plan/lernmodus-plan.md): Die Szene läuft wie im Leser, fremde Repliken
 * sichtbar (optional vorgelesen), eigene Abschnitte verdeckt; erst nach „Weiter“ erscheint der
 * Text bis zum nächsten eigenen Abschnitt.
 */
export function SceneFlow({
  reader,
  tokenized,
  units,
  sceneId,
  cards,
  settings,
  onCommit,
  onExit,
  onNextScene,
}: {
  reader: ScriptReaderData;
  tokenized: ReadonlyMap<string, TokenizedBlock>;
  units: readonly Unit[];
  sceneId: string;
  cards: ReadonlyMap<string, StoredCard>;
  settings: LearnSettings;
  onCommit: (unit: Unit, rating: LearnRating, meta: ReviewMeta) => void;
  onExit: () => void;
  onNextScene: (() => void) | null;
}) {
  useWakeLock(true);
  const scene = reader.scenes.find((entry) => entry.id === sceneId);
  const sceneBlocks = React.useMemo(
    () =>
      reader.blocks
        .map((block, index) => ({ block, index }))
        .filter((entry) => entry.block.sceneId === sceneId),
    [reader.blocks, sceneId],
  );
  const allUnits = React.useMemo(
    () => units.filter((unit) => unit.block.sceneId === sceneId),
    [units, sceneId],
  );
  const [only, setOnly] = React.useState<Set<string> | null>(null);
  const sceneUnits = React.useMemo(
    () => (only ? allUnits.filter((unit) => only.has(unit.id)) : allUnits),
    [allUnits, only],
  );
  const [step, setStep] = React.useState(0);
  const [results, setResults] = React.useState(() => new Map<string, LearnRating>());
  const deferred = useDeferredReview(onCommit);
  const flash = useRatingFlash();
  const speech = useSpeech(settings.speak);

  const unit = sceneUnits[step] ?? null;
  const finished = step >= sceneUnits.length;
  // Stufe beim Erreichen des Abschnitts festhalten, damit sie nach der Bewertung nicht springt.
  // Bewertet werden nur neue, fällige und geänderte Stellen; der Rest ist Übung im Zusammenhang
  // (sonst würde jedes Durchspielen nicht fällige Stellen vorzeitig „wiederholen“).
  // Fällig = fällig beim Öffnen der Szene (stabil während des Durchspielens).
  const [openedAt] = React.useState(() => Date.now());
  const stageRef = React.useRef(
    new Map<string, ReturnType<typeof unitStage> & { graded: boolean }>(),
  );
  const stageInfo = React.useMemo(() => {
    if (!unit) return { stage: "full" as const, seed: 0, changed: false, graded: false };
    const known = stageRef.current.get(unit.id);
    if (known) return known;
    const { card } = unitCard(unit, cards);
    const base = unitStage(unit, cards, settings.stage);
    const info = {
      ...base,
      graded: !card || base.changed || new Date(card.due).getTime() <= openedAt,
    };
    stageRef.current.set(unit.id, info);
    return info;
  }, [unit, cards, settings.stage, openedAt]);
  const shownAt = React.useRef(0);
  React.useEffect(() => {
    shownAt.current = Date.now();
  }, [step, only]);
  const unitTokens = unit ? tokenized.get(unit.block.id) : undefined;
  const practice = usePractice(unit, unitTokens, stageInfo.stage, stageInfo.seed);

  const visibleUntil = finished
    ? Number.POSITIVE_INFINITY
    : (unit?.blockIndex ?? Number.POSITIVE_INFINITY);
  const activeRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [step, only]);

  // Fremde Repliken bis zum nächsten eigenen Abschnitt vorlesen.
  const spokenUpTo = React.useRef(-1);
  React.useEffect(() => {
    if (!settings.speak || finished || !unit) return;
    const from = spokenUpTo.current;
    const lines = sceneBlocks
      .filter(
        ({ block, index }) =>
          index > from &&
          index < unit.blockIndex &&
          block.kind === "speech" &&
          !units.some((candidate) => candidate.block.id === block.id),
      )
      .map(({ block }) => ({ text: spokenText(block.parts), speaker: block.speaker }));
    spokenUpTo.current = unit.blockIndex;
    void speech.speak(lines);
  }, [settings.speak, finished, unit, sceneBlocks, units, speech]);

  const next = React.useCallback(() => {
    if (speech.speaking) {
      speech.stop();
      return;
    }
    if (!unit) return;
    if (stageInfo.stage !== "full") {
      const outcome = practice.result();
      // Blind weitergeklickt (kurz, nichts aufgedeckt oder getippt) ist keine Abfrage.
      const tried =
        Date.now() - shownAt.current >= MIN_ANSWER_MS ||
        outcome.revealed > 0 ||
        practice.progress.typed.size > 0;
      if (stageInfo.graded && tried) {
        deferred.propose(unit, outcome.rating, {
          auto: true,
          revealed: outcome.revealed,
          mode: "flow",
          stage: stageInfo.stage,
        });
        flash.show(outcome.rating);
      }
      setResults((current) => new Map(current).set(unit.id, outcome.rating));
    }
    setStep((current) => current + 1);
  }, [speech, unit, stageInfo, practice, deferred, flash]);

  // Tippmodus: nach dem letzten Wort automatisch weiter.
  React.useEffect(() => {
    if (!settings.typing || !practice.solved) return;
    const timer = window.setTimeout(next, 450);
    return () => window.clearTimeout(timer);
  }, [settings.typing, practice.solved, next]);

  const changeLast = (rating: LearnRating) => {
    deferred.change(rating);
    if (deferred.last) {
      const id = deferred.last.unit.id;
      setResults((current) => new Map(current).set(id, rating));
    }
  };

  useLearnKeys({
    enabled: !finished,
    onNext: next,
    onRevealAll: practice.revealAll,
    onRevealNext: practice.revealNext,
    onLetter: settings.typing && stageInfo.stage !== "full" ? practice.typeKey : undefined,
  });
  const hold = useHold(practice.revealAll, !finished && stageInfo.stage !== "full");
  const swipe = useSwipeLeft(next);

  const restartHard = () => {
    const hard = new Set([...results].filter(([, rating]) => rating <= 2).map(([id]) => id));
    deferred.settle();
    stageRef.current.clear();
    spokenUpTo.current = -1;
    setOnly(hard);
    setResults(new Map());
    setStep(0);
    window.scrollTo({ top: 0 });
  };

  const counts = [1, 2, 3, 4].map(
    (rating) => [...results.values()].filter((value) => value === rating).length,
  );

  return (
    <div className="min-h-dvh" {...swipe}>
      <header className="fixed inset-x-0 top-0 z-30 border-b border-border/60 bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex h-12 max-w-3xl items-center gap-1 px-1">
          <Button variant="ghost" size="icon" aria-label="Zurück zur Übersicht" onClick={onExit}>
            <ArrowLeftIcon aria-hidden />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{scene?.title ?? "Szene"}</p>
            <p className="truncate text-xs text-muted-foreground">
              Szenenfluss ·{" "}
              {settings.stage === "auto" ? "Stufe automatisch" : STAGE_LABEL[settings.stage]}
              {only ? " · nur schwierige Stellen" : ""}
            </p>
          </div>
          {settings.speak ? (
            <AudioLinesIcon
              className={cn("h-4 w-4", speech.speaking ? "text-primary" : "text-muted-foreground")}
              aria-label={speech.speaking ? "Liest vor" : "Vorlesen an"}
            />
          ) : null}
          {settings.typing ? (
            <KeyboardIcon className="h-4 w-4 text-muted-foreground" aria-label="Tippmodus an" />
          ) : null}
          <span className="px-2 text-xs tabular-nums text-muted-foreground" aria-live="polite">
            {Math.min(step + 1, sceneUnits.length)}/{sceneUnits.length}
          </span>
        </div>
        <div className="h-0.5 bg-muted">
          <div
            className="h-full bg-primary transition-[width]"
            style={{ width: `${sceneUnits.length ? (step / sceneUnits.length) * 100 : 100}%` }}
          />
        </div>
      </header>

      <article
        className={cn(
          "mx-auto max-w-3xl space-y-3 px-4 pb-44 pt-[calc(4rem+env(safe-area-inset-top))] leading-relaxed",
          FONT_SIZES[settings.fontSize] ?? FONT_SIZES[1],
        )}
      >
        {sceneBlocks
          .filter(({ index }) => index <= visibleUntil)
          .map(({ block }) => {
            const own = units.some((candidate) => candidate.block.id === block.id);
            const isCurrent = !finished && unit?.block.id === block.id;
            return (
              <FlowBlock
                key={block.id}
                block={block}
                own={own}
                tokens={tokenized.get(block.id)}
                current={isCurrent}
                containerRef={isCurrent ? activeRef : undefined}
                activeChunk={isCurrent && unit ? unit.chunk : null}
                done={!isCurrent}
                stage={isCurrent ? stageInfo.stage : "full"}
                seed={stageInfo.seed}
                progress={isCurrent ? practice.progress : null}
                typingTarget={isCurrent && settings.typing ? practice.target : null}
                onRevealWord={practice.revealWord}
                holdHandlers={isCurrent ? hold.handlers : undefined}
                ratings={allUnits
                  .filter((candidate) => candidate.block.id === block.id)
                  .map((candidate) => results.get(candidate.id))}
                changed={isCurrent && stageInfo.changed}
              />
            );
          })}

        {finished ? (
          <section
            className="mt-8 border-t border-border pt-6 text-center"
            data-testid="lernen-szene-fertig"
          >
            <p className="text-2xl" aria-hidden>
              {counts[0] + counts[1] === 0 ? "🎉" : "👏"}
            </p>
            <h2 className="mt-1 text-lg font-semibold">
              {sceneUnits.length ? "Szene geschafft" : "In dieser Szene hast du keinen Text"}
            </h2>
            {results.size ? (
              <p className="mt-1 text-sm text-muted-foreground">
                <span className={RATING_STYLE[3]}>{counts[2] + counts[3]} sicher</span> ·{" "}
                <span className={RATING_STYLE[2]}>{counts[1]} wackelig</span> ·{" "}
                <span className={RATING_STYLE[1]}>{counts[0]} vergessen</span>
              </p>
            ) : null}
            <div className="mx-auto mt-5 flex max-w-sm flex-col gap-2">
              {counts[0] + counts[1] > 0 ? (
                <Button onClick={restartHard}>Schwierige Stellen nochmal</Button>
              ) : null}
              {onNextScene ? (
                <Button
                  variant={counts[0] + counts[1] > 0 ? "outline" : "default"}
                  onClick={onNextScene}
                >
                  Nächste Szene <ArrowRightIcon aria-hidden />
                </Button>
              ) : null}
              <Button variant="ghost" onClick={onExit}>
                Zur Übersicht
              </Button>
            </div>
          </section>
        ) : null}
      </article>

      <RatingFlash token={flash.token} rating={flash.rating} />
      {!finished ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
          <div className="mx-auto max-w-3xl space-y-1 px-3 py-2">
            <CorrectionBar last={deferred.last} onChange={changeLast} />
            <div className="flex gap-2">
              {stageInfo.stage !== "full" ? (
                <RevealButtons
                  onNext={practice.revealNext}
                  onAll={practice.revealAll}
                  disabled={practice.progress.whole || practice.target === null}
                />
              ) : null}
              <BigButton onClick={next} title="Leertaste, Enter oder Pfeil nach rechts">
                {speech.speaking ? "Überspringen" : "Weiter"} <ArrowRightIcon aria-hidden />
              </BigButton>
            </div>
            <p className="hidden text-center text-[11px] text-muted-foreground sm:block">
              Wort antippen oder ↓ deckt ein Wort auf · Text halten oder ↑ deckt alles auf ·
              Leertaste weiter
              {settings.typing ? " · Anfangsbuchstaben tippen" : ""}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FlowBlock({
  block,
  own,
  tokens,
  current,
  containerRef,
  activeChunk,
  done,
  stage,
  seed,
  progress,
  typingTarget,
  onRevealWord,
  holdHandlers,
  ratings,
  changed,
}: {
  block: ReaderBlock;
  own: boolean;
  tokens: TokenizedBlock | undefined;
  current: boolean;
  containerRef?: React.Ref<HTMLDivElement>;
  activeChunk: number | null;
  done: boolean;
  stage: React.ComponentProps<typeof MaskedBlockText>["stage"];
  seed: number;
  progress: React.ComponentProps<typeof MaskedBlockText>["progress"];
  typingTarget: number | null;
  onRevealWord: (index: number) => void;
  holdHandlers?: Record<string, unknown>;
  ratings: (LearnRating | undefined)[];
  changed: boolean;
}) {
  if (block.kind === "direction") {
    const text = block.parts
      .filter((part) => part.kind !== "cue")
      .map((part) => part.text)
      .join(" ")
      .trim();
    if (!text) return null;
    return <p className="pl-4 text-[0.9em] italic text-muted-foreground">{text}</p>;
  }
  const worst = ratings.reduce<LearnRating | undefined>(
    (min, rating) => (rating !== undefined && (min === undefined || rating < min) ? rating : min),
    undefined,
  );
  return (
    <div
      ref={containerRef}
      data-lernen-block={own ? "own" : "other"}
      data-current={current || undefined}
      {...(holdHandlers ?? {})}
      className={cn(
        "border-l-[3px] pl-3 transition-colors",
        own ? "border-primary/50" : "border-transparent",
        current && "select-none border-primary bg-primary/5 py-2",
        own && !current && worst === 1 && "border-destructive/70",
        own && !current && worst === 2 && "border-warning/70",
        own && !current && worst !== undefined && worst >= 3 && "border-success/70",
        !own && "text-foreground/85",
      )}
    >
      <p className="text-[0.75em] font-semibold uppercase tracking-wider text-muted-foreground">
        {block.speaker}
        {changed ? (
          <span className="ml-2 rounded-sm bg-warning/20 px-1 py-px normal-case tracking-normal text-warning">
            Text geändert
          </span>
        ) : null}
      </p>
      {own && tokens ? (
        <p>
          <MaskedBlockText
            tokenized={tokens}
            active={activeChunk}
            done={done}
            stage={stage}
            seed={seed}
            progress={progress}
            typingTarget={typingTarget}
            onRevealWord={onRevealWord}
          />
        </p>
      ) : (
        <p>
          {block.parts.map((part, index) =>
            part.kind === "cue" ? null : part.kind === "direction" ? (
              <span key={index} className="italic text-muted-foreground">
                {" "}
                {part.text}{" "}
              </span>
            ) : (
              <React.Fragment key={index}>{part.text}</React.Fragment>
            ),
          )}
        </p>
      )}
    </div>
  );
}

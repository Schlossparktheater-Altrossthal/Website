import Image from "next/image";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heading, Text } from "@/components/ui/typography";
import {
  DEFAULT_MYSTERY_COUNTDOWN_ISO,
  DEFAULT_MYSTERY_EXPIRATION_MESSAGE,
  readMysterySettings,
  resolveMysterySettings,
} from "@/lib/mystery-settings";
import { prisma } from "@/lib/prisma";
import type { Clue, MysteryTip as MysteryTipModel, Prisma } from "@prisma/client";
import { getMysteryClueSummaries, getMysteryScoreboard } from "@/lib/mystery-tips";

import { MysteryTipsBoard } from "./_components/mystery-tips-board";
import { MysteryScoreboard } from "./_components/mystery-scoreboard";
import { MysteryCountdownCard } from "./_components/mystery-countdown-card";

type ClueContent = {
  text?: string;
  url?: string;
  alt?: string;
};

function parseClueContent(content: Prisma.JsonValue | null | undefined): ClueContent {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return {};
  }
  const record = content as Record<string, unknown>;
  return {
    text: typeof record.text === "string" ? record.text : undefined,
    url: typeof record.url === "string" ? record.url : undefined,
    alt: typeof record.alt === "string" ? record.alt : undefined,
  };
}

function renderClueBody(clue: Clue, content: ClueContent) {
  if (clue.type === "image") {
    return (
      <div className="relative h-64 w-full">
        <Image src={content.url ?? "/next.svg"} alt={content.alt ?? "Hinweis"} fill className="object-contain" />
      </div>
    );
  }
  if (clue.type === "text" || clue.type === "riddle") {
    return <Text>{content.text ?? "Ein Rätsel wartet…"}</Text>;
  }
  return <Text>Ein Rätsel wartet…</Text>;
}

export const revalidate = 30;

export default async function MysteryPage() {
  const now = new Date();
  let clues: Clue[] = [];
  let tips: MysteryTipModel[] = [];
  let settingsRecord: Awaited<ReturnType<typeof readMysterySettings>> = null;
  let scoreboardEntries: Awaited<ReturnType<typeof getMysteryScoreboard>> = [];
  let clueSummaries: Awaited<ReturnType<typeof getMysteryClueSummaries>> = [];

  if (process.env.DATABASE_URL) {
    const [cluesResult, tipsResult, settingsResult, scoreboardResult, clueSummaryResult] = await Promise.allSettled([
      prisma.clue.findMany({
        where: { published: true, releaseAt: { lte: now } },
        orderBy: [{ index: "asc" }],
      }),
      prisma.mysteryTip.findMany({
        orderBy: [
          { count: "desc" },
          { updatedAt: "desc" },
          { createdAt: "asc" },
        ],
      }),
      readMysterySettings(),
      getMysteryScoreboard(10),
      getMysteryClueSummaries(),
    ]);

    clues = cluesResult.status === "fulfilled" ? cluesResult.value : [];
    tips = tipsResult.status === "fulfilled" ? tipsResult.value : [];
    settingsRecord = settingsResult.status === "fulfilled" ? settingsResult.value : null;
    scoreboardEntries = scoreboardResult.status === "fulfilled" ? scoreboardResult.value : [];
    clueSummaries = clueSummaryResult.status === "fulfilled" ? clueSummaryResult.value : [];
  }

  const resolvedSettings = resolveMysterySettings(settingsRecord);
  const countdownTargetIso = resolvedSettings.effectiveCountdownTarget.toISOString();
  const initialCountdownTargetIso = resolvedSettings.countdownTarget
    ? resolvedSettings.countdownTarget.toISOString()
    : null;
  const effectiveExpirationMessage = resolvedSettings.effectiveExpirationMessage ?? DEFAULT_MYSTERY_EXPIRATION_MESSAGE;
  const updatedAtIso = resolvedSettings.updatedAt ? resolvedSettings.updatedAt.toISOString() : null;

  const firstRiddle = clues.find((clue) => clue.index === 1) ?? null;
  const remainingClues = firstRiddle ? clues.filter((clue) => clue.id !== firstRiddle.id) : clues;
  const firstRiddleContent = firstRiddle ? parseClueContent(firstRiddle.content) : null;

  const initialTips = tips.map((tip) => ({
    id: tip.id,
    text: tip.text,
    count: tip.count,
    createdAt: tip.createdAt.toISOString(),
    updatedAt: tip.updatedAt.toISOString(),
  }));

  const clueOptions = clueSummaries
    .filter((clue) => clue.published)
    .map((clue) => ({
      id: clue.id,
      label: `Hinweis ${clue.index}`,
      points: clue.points,
    }));

  const scoreboardData = scoreboardEntries.map((entry) => ({
    playerName: entry.playerName,
    totalScore: entry.totalScore,
    correctCount: entry.correctCount,
    lastUpdated: entry.lastUpdated ? entry.lastUpdated.toISOString() : null,
  }));

  const countdownReached = resolvedSettings.effectiveCountdownTarget <= now;
  const isFirstRiddleReleased = countdownReached || Boolean(firstRiddle);
  const showSilentMessage = !isFirstRiddleReleased && clues.length === 0;
  const hasAdditionalClues = remainingClues.length > 0;

  return (
    <div className="layout-container space-y-10 py-12">
      <Heading level="h1">Das Geheimnis</Heading>
      <section className="space-y-6">
        <div className="space-y-2">
          {showSilentMessage && <Text tone="muted">Die Schatten sind noch still…</Text>}
          <Text>
            Jeden Monat kommt ein neues Rätsel hinzu, um den Titel des nächsten Stückes immer mehr aufzudecken.
          </Text>
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <MysteryCountdownCard
            initialCountdownTarget={initialCountdownTargetIso}
            initialExpirationMessage={resolvedSettings.expirationMessage}
            effectiveCountdownTarget={countdownTargetIso}
            effectiveExpirationMessage={effectiveExpirationMessage}
            defaultCountdownTarget={DEFAULT_MYSTERY_COUNTDOWN_ISO}
            defaultExpirationMessage={DEFAULT_MYSTERY_EXPIRATION_MESSAGE}
            updatedAt={updatedAtIso}
            hasCustomCountdown={resolvedSettings.hasCustomCountdown}
            hasCustomMessage={resolvedSettings.hasCustomMessage}
            isFirstRiddleReleased={isFirstRiddleReleased}
          />
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>Das 1. Rätsel</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
              {isFirstRiddleReleased ? (
                firstRiddle ? (
                  <>
                    {renderClueBody(firstRiddle, firstRiddleContent ?? {})}
                    <Text variant="small" tone="muted">
                      Hinweis {firstRiddle.index} • {firstRiddle.points} Punkte
                    </Text>
                  </>
                ) : (
                  <Text tone="muted">Das Rätsel wird gerade vorbereitet. Schau bald wieder vorbei.</Text>
                )
              ) : (
                <Text className="text-2xl font-semibold text-muted-foreground">Das 1. Rätsel</Text>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
      <MysteryTipsBoard
        initialTips={initialTips}
        clueOptions={clueOptions}
        defaultClueId={clueOptions[0]?.id}
      />
      <MysteryScoreboard entries={scoreboardData} />
      <section className="space-y-4">
        <Heading level="h2">Bisher enthüllte Hinweise</Heading>
        {hasAdditionalClues ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {remainingClues.map((clue) => {
              const content = parseClueContent(clue.content);
              return (
                <Card key={clue.id}>
                  <CardHeader>
                    <CardTitle>
                      Hinweis {clue.index} • {clue.points} Punkte
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {renderClueBody(clue, content)}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Text tone="muted">Weitere Hinweise folgen bald. Schau regelmäßig vorbei!</Text>
        )}
      </section>
    </div>
  );
}

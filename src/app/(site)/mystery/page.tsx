import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Eye, Lock } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heading, Text } from "@/components/ui/typography";
import {
  DEFAULT_MYSTERY_COUNTDOWN_ISO,
  DEFAULT_MYSTERY_EXPIRATION_MESSAGE,
  readMysterySettings,
  resolveMysterySettings,
} from "@/lib/mystery-countdown-settings";
import { prisma } from "@/lib/prisma";
import type { Clue, MysteryTip as MysteryTipModel, Prisma } from "@prisma/client";
import { getMysteryClueSummaries, getMysteryScoreboard } from "@/lib/mystery-submissions";
import { getPublicPageVisibility } from "@/lib/public-page-visibility";

import { MysteryGuessBoard } from "./_components/mystery-guess-board";
import { MysteryScoreboard } from "./_components/mystery-scoreboard";
import { MysteryLaunchCountdownCard } from "./_components/mystery-launch-countdown-card";

export const metadata: Metadata = {
  title: "Das Geheimnis des Sommertheaters",
  description:
    "Entschlüssele Hinweise, verfolge das Countdown-Ritual und teile deine Tipps für das große Sommertheater-Mysterium im Schlosspark.",
  alternates: {
    canonical: "/mystery",
  },
  openGraph: {
    title: "Das Geheimnis des Sommertheaters",
    description:
      "Alle freigeschalteten Rätsel, das Countdown-Ritual und die Bestenliste des Sommertheater-Mysteriums auf einen Blick.",
    url: "/mystery",
    type: "website",
    images: [
      {
        url: "/images/RuJ_3.png",
        alt: "Verschlungene Wege im nächtlichen Schlosspark",
      },
    ],
    siteName: "Sommertheater Altrossthal",
  },
  twitter: {
    card: "summary_large_image",
    title: "Das Geheimnis des Sommertheaters",
    description:
      "Tauche in die mystische Rätselreihe des Sommertheaters Altrossthal ein und begleite die Community bei der Lösung.",
    images: ["/images/RuJ_3.png"],
  },
};

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
  const visibility = await getPublicPageVisibility();
  if (!visibility.mystery) {
    notFound();
  }
  const now = new Date();
  const initialNow = now.getTime();
  let clues: Clue[] = [];
  let tips: MysteryTipModel[] = [];
  let settingsRecord: Awaited<ReturnType<typeof readMysterySettings>> = null;
  let scoreboardEntries: Awaited<ReturnType<typeof getMysteryScoreboard>> = [];
  let clueSummaries: Awaited<ReturnType<typeof getMysteryClueSummaries>> = [];

  if (process.env.DATABASE_URL) {
    const [cluesResult, tipsResult, settingsResult, scoreboardResult, clueSummaryResult] = await Promise.allSettled([
      prisma.clue.findMany({ orderBy: [{ index: "asc" }] }),
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

  const visibleClues = clues.filter((clue) => clue.published && clue.releaseAt <= now);
  const firstRiddle = clues.find((clue) => clue.index === 1) ?? null;
  const remainingClues = clues.filter((clue) => clue.id !== firstRiddle?.id);
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

  const isFirstRiddleReleased = Boolean(firstRiddle && firstRiddle.published && firstRiddle.releaseAt <= now);
  const showSilentMessage = !isFirstRiddleReleased && visibleClues.length === 0;
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
          <MysteryLaunchCountdownCard
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
            initialNow={initialNow}
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
                <div className="space-y-2">
                  <Lock className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
                  <Text tone="muted">Das 1. Rätsel kommt bald.</Text>
                  {firstRiddle?.releaseAt ? (
                    <Text variant="small" tone="muted">
                      Geplant für {new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(firstRiddle.releaseAt)}
                    </Text>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
      <MysteryGuessBoard
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
              const isReleased = clue.published && clue.releaseAt <= now;
              return (
                <Card key={clue.id}>
                  <CardHeader>
                    <CardTitle>
                      Hinweis {clue.index} • {clue.points} Punkte
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      {isReleased ? <Eye className="h-4 w-4" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />}
                      <Text variant="small" tone="muted">
                        {isReleased ? "Enthüllt" : "Geplant"} am {new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(clue.releaseAt)}
                      </Text>
                    </div>
                    {isReleased ? renderClueBody(clue, content) : <Text tone="muted">Dieser Hinweis ist noch verschlossen.</Text>}
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

import { prisma } from "@/lib/prisma";
import type { Clue, MysteryTip as MysteryTipModel, Prisma } from "@prisma/client";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heading, Text } from "@/components/ui/typography";
import { Countdown } from "./_components/countdown";
import { MysteryTipsBoard } from "./_components/mystery-tips-board";

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

const FIRST_RIDDLE_RELEASE_ISO = "2025-10-15T10:00:00.000Z";
const FIRST_RIDDLE_RELEASE = new Date(FIRST_RIDDLE_RELEASE_ISO);
const FIRST_RIDDLE_RELEASE_LABEL = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "full",
  timeStyle: "short",
  timeZone: "Europe/Berlin",
}).format(FIRST_RIDDLE_RELEASE);

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
  const isFirstRiddleReleased = now >= FIRST_RIDDLE_RELEASE;
  let clues: Clue[] = [];
  let tips: MysteryTipModel[] = [];

  if (process.env.DATABASE_URL) {
    const [cluesResult, tipsResult] = await Promise.allSettled([
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
    ]);

    clues = cluesResult.status === "fulfilled" ? cluesResult.value : [];
    tips = tipsResult.status === "fulfilled" ? tipsResult.value : [];
  }

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
          <Card>
            <CardHeader>
              <CardTitle>Nächstes Rätsel in</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isFirstRiddleReleased ? (
                <>
                  <Countdown targetDate={FIRST_RIDDLE_RELEASE_ISO} />
                  <Text variant="small" tone="muted">
                    Start am {FIRST_RIDDLE_RELEASE_LABEL}
                  </Text>
                </>
              ) : (
                <div className="space-y-2">
                  <Text variant="lead" tone="success">
                    Das erste Rätsel ist jetzt verfügbar!
                  </Text>
                  <Text variant="small" tone="muted">
                    Veröffentlicht am {FIRST_RIDDLE_RELEASE_LABEL}
                  </Text>
                </div>
              )}
            </CardContent>
          </Card>
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
      <MysteryTipsBoard initialTips={initialTips} />
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

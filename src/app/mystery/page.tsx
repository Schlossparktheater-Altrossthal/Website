import { prisma } from "@/lib/prisma";
import type { Clue, Prisma } from "@prisma/client";
import Image from "next/image";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Heading, Text } from "@/components/ui/typography";

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

export const revalidate = 30;

export default async function MysteryPage() {
  const now = new Date();
  let clues: Clue[] = [];
  try {
    clues = await prisma.clue.findMany({
      where: { published: true, releaseAt: { lte: now } },
      orderBy: [{ index: "asc" }],
    });
  } catch {
    clues = [];
  }

  return (
    <div className="layout-container space-y-6 py-12">
      <Heading level="h1">Das Geheimnis</Heading>
      {clues.length === 0 && <Text tone="muted">Die Schatten sind noch still…</Text>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {clues.map((c) => {
          const content = parseClueContent(c.content);
          return (
            <Card key={c.id}>
              <CardTitle className="p-4">
                Hinweis {c.index} • {c.points} Punkte
              </CardTitle>
              <CardContent>
                {c.type === "text" && <Text>{content.text}</Text>}
                {c.type === "image" && (
                  <div className="relative w-full h-64">
                    <Image src={content.url ?? "/next.svg"} alt={content.alt ?? "Hinweis"} fill className="object-contain" />
                  </div>
                )}
                {c.type !== "text" && c.type !== "image" && <Text>Ein Rätsel wartet…</Text>}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

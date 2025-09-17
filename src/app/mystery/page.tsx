import { prisma } from "@/lib/prisma";
import type { Clue } from "@prisma/client";
import Image from "next/image";
import { Card, CardContent, CardTitle } from "@/components/ui/card";

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
    <div className="container mx-auto px-4 sm:px-6 py-10 space-y-6">
      <h1 className="font-serif text-3xl">Das Geheimnis</h1>
      {clues.length === 0 && <p>Die Schatten sind noch still…</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {clues.map((c) => {
          const content = c.content as unknown as { text?: string; url?: string; alt?: string };
          return (
            <Card key={c.id}>
              <CardTitle className="p-4">
                Hinweis {c.index} • {c.points} Punkte
              </CardTitle>
              <CardContent>
                {c.type === "text" && <p>{content.text}</p>}
                {c.type === "image" && (
                  <div className="relative w-full h-64">
                    <Image src={content.url ?? "/next.svg"} alt={content.alt ?? "Hinweis"} fill className="object-contain" />
                  </div>
                )}
                {c.type !== "text" && c.type !== "image" && <p>Ein Rätsel wartet…</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

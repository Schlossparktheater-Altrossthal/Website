import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const tipSchema = z.object({
  tip: z
    .string()
    .trim()
    .min(3, "Dein Tipp sollte mindestens 3 Zeichen lang sein.")
    .max(280, "Bitte kürze deinen Tipp auf höchstens 280 Zeichen."),
  playerName: z
    .string()
    .trim()
    .min(2, "Bitte gib einen Spielernamen mit mindestens 2 Zeichen an.")
    .max(50, "Der Spielernamen darf höchstens 50 Zeichen lang sein."),
  clueId: z.string().cuid({ message: "Bitte wähle ein gültiges Rätsel aus." }),
});

function normalizeTip(text: string) {
  return text.trim().toLocaleLowerCase("de-DE");
}

export async function GET() {
  try {
    const tips = await prisma.mysteryTip.findMany({
      orderBy: [
        { count: "desc" },
        { updatedAt: "desc" },
        { createdAt: "asc" },
      ],
    });

    return NextResponse.json({
      tips: tips.map((tip) => ({
        id: tip.id,
        text: tip.text,
        count: tip.count,
        createdAt: tip.createdAt,
        updatedAt: tip.updatedAt,
      })),
    });
  } catch (error) {
    console.error("Failed to load mystery tips", error);
    return NextResponse.json({ error: "Konnte die Tipps gerade nicht laden." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Eingabe." }, { status: 400 });
  }

  const parsed = tipSchema.safeParse(payload);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Ungültiger Tipp.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const trimmedTip = parsed.data.tip;
  const trimmedName = parsed.data.playerName.trim();
  const clueId = parsed.data.clueId;
  const normalizedText = normalizeTip(trimmedTip);

  try {
    const clue = await prisma.clue.findUnique({ where: { id: clueId } });
    if (!clue || !clue.published) {
      return NextResponse.json({ error: "Dieses Rätsel kann aktuell nicht ausgewählt werden." }, { status: 400 });
    }

    const savedTip = await prisma.$transaction(async (tx) => {
      const tipRecord = await tx.mysteryTip.upsert({
        where: { normalizedText },
        update: {
          count: { increment: 1 },
        },
        create: {
          text: trimmedTip,
          normalizedText,
        },
      });

      await tx.mysteryTipSubmission.create({
        data: {
          tipId: tipRecord.id,
          clueId,
          playerName: trimmedName,
          tipText: trimmedTip,
          normalizedText,
        },
      });

      return tipRecord;
    });

    const created = savedTip.count === 1;

    return NextResponse.json(
      {
        tip: {
          id: savedTip.id,
          text: savedTip.text,
          count: savedTip.count,
          createdAt: savedTip.createdAt,
          updatedAt: savedTip.updatedAt,
        },
        created,
      },
      { status: created ? 201 : 200 }
    );
  } catch (error) {
    console.error("Failed to save mystery tip", error);
    return NextResponse.json({ error: "Dein Tipp konnte nicht gespeichert werden." }, { status: 500 });
  }
}

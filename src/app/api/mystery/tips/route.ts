import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const tipSchema = z.object({
  tip: z
    .string()
    .trim()
    .min(3, "Dein Tipp sollte mindestens 3 Zeichen lang sein.")
    .max(280, "Bitte kürze deinen Tipp auf höchstens 280 Zeichen."),
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
  const normalizedText = normalizeTip(trimmedTip);

  try {
    const savedTip = await prisma.mysteryTip.upsert({
      where: { normalizedText },
      update: {
        count: { increment: 1 },
      },
      create: {
        text: trimmedTip,
        normalizedText,
      },
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

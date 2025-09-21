import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getMysteryScoreboardEntry } from "@/lib/mystery-tips";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

const updateSchema = z.object({
  isCorrect: z.boolean(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.mystery.tips");
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Datenbank ist nicht konfiguriert." }, { status: 500 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Eingabe." }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const message = issue?.message ?? "Ungültige Eingabe.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const submission = await prisma.mysteryTipSubmission.findUnique({
    where: { id: params.id },
    include: { clue: { select: { points: true } }, tip: { select: { count: true } } },
  });

  if (!submission) {
    return NextResponse.json({ error: "Der Tipp konnte nicht gefunden werden." }, { status: 404 });
  }

  const nextScore = parsed.data.isCorrect ? submission.clue?.points ?? 1 : 0;

  const updated = await prisma.mysteryTipSubmission.update({
    where: { id: submission.id },
    data: {
      isCorrect: parsed.data.isCorrect,
      score: nextScore,
    },
    include: {
      tip: { select: { count: true } },
      clue: { select: { id: true, index: true, points: true, releaseAt: true, published: true } },
    },
  });

  const scoreboardEntry = await getMysteryScoreboardEntry(updated.playerName);

  return NextResponse.json({
    submission: {
      id: updated.id,
      playerName: updated.playerName,
      tipText: updated.tipText,
      normalizedText: updated.normalizedText,
      isCorrect: updated.isCorrect,
      score: updated.score,
      tipCount: updated.tip.count,
      cluePoints: updated.clue?.points ?? null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
    scoreboardEntry: scoreboardEntry
      ? {
          playerName: scoreboardEntry.playerName,
          totalScore: scoreboardEntry.totalScore,
          correctCount: scoreboardEntry.correctCount,
          totalSubmissions: scoreboardEntry.totalSubmissions,
          lastUpdated: scoreboardEntry.lastUpdated ? scoreboardEntry.lastUpdated.toISOString() : null,
        }
      : null,
  });
}

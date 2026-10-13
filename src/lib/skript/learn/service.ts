import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

import { readParts } from "../json";
import { loadScriptReader, type ScriptReaderData } from "../reader";
import { tokenizeBlock } from "./chunks";
import { REHEARSAL_HORIZON_DAYS, matchScenes, type StoredCard } from "./plan";
import { applyReview, type CardState, type LearnRating } from "./schedule";

/** Daten und Speichern des Lernmodus (docs/Plan/lernmodus-plan.md). */

export class ScriptLearnError extends Error {}

/** Wochen Verlauf für die Statistik. */
export const HISTORY_WEEKS = 12;

export type LearnHistoryEntry = { cardId: string; at: string; rating: number; mode: string };

export type LearnRehearsal = { sceneId: string; start: string; title: string };

export type LearnPageData = {
  reader: ScriptReaderData;
  cards: (StoredCard & { id: string; roleId: string; lineageId: string; chunk: number })[];
  /** Abfragen dieses Stücks der letzten Wochen (Statistik). */
  history: LearnHistoryEntry[];
  /** Zeitpunkte der Abfragen der letzten 8 Tage (Wochenziel in Ortszeit des Geräts). */
  recentReviews: string[];
  weeklyDays: number;
  rehearsals: LearnRehearsal[];
};

/** Neueste freigegebene Fassung eines Stücks (L7). */
export async function latestReleasedVersion(showId: string) {
  return prisma.scriptVersion.findFirst({
    where: { showId, status: "released" },
    orderBy: [{ releasedAt: "desc" }, { createdAt: "desc" }],
    select: { id: true },
  });
}

export async function loadLearnPage(
  showId: string,
  userId: string,
  now = new Date(),
): Promise<LearnPageData | null> {
  const version = await latestReleasedVersion(showId);
  if (!version) return null;
  const reader = await loadScriptReader(version.id, userId);
  if (!reader) return null;

  const horizon = new Date(now.getTime() + REHEARSAL_HORIZON_DAYS * 86_400_000);
  const since = new Date(now.getTime() - 8 * 86_400_000);
  const historySince = new Date(now.getTime() - HISTORY_WEEKS * 7 * 86_400_000);
  const [cards, reviews, history, profile, stageScenes, blocks] = await Promise.all([
    prisma.scriptLearnCard.findMany({ where: { userId, showId } }),
    prisma.scriptLearnReview.findMany({
      where: { card: { userId }, reviewedAt: { gte: since } },
      select: { reviewedAt: true },
    }),
    prisma.scriptLearnReview.findMany({
      where: { card: { userId, showId }, reviewedAt: { gte: historySince } },
      select: { cardId: true, reviewedAt: true, rating: true, mode: true },
      orderBy: { reviewedAt: "asc" },
    }),
    prisma.scriptLearnProfile.findUnique({ where: { userId } }),
    prisma.scene.findMany({
      where: { showId },
      orderBy: { sequence: "asc" },
      select: { id: true, title: true, identifier: true },
    }),
    prisma.eventBlock.findMany({
      where: {
        event: {
          showId,
          status: { in: ["SCHEDULED", "TENTATIVE"] },
          start: { gte: new Date(now.getTime() - 12 * 3_600_000), lte: horizon },
        },
        OR: [{ sceneId: { not: null } }, { runScenes: { some: {} } }],
      },
      select: {
        sceneId: true,
        startsAt: true,
        runScenes: { select: { sceneId: true } },
        event: { select: { start: true, title: true } },
      },
    }),
  ]);

  const sceneMap = matchScenes(stageScenes, reader.scenes);
  const next = new Map<string, LearnRehearsal>();
  for (const block of blocks) {
    const start = (block.startsAt ?? block.event.start).toISOString();
    const ids = [block.sceneId, ...block.runScenes.map((entry) => entry.sceneId)];
    for (const id of ids) {
      const scriptScene = id ? sceneMap.get(id) : undefined;
      if (!scriptScene) continue;
      const known = next.get(scriptScene);
      if (!known || known.start > start) {
        next.set(scriptScene, { sceneId: scriptScene, start, title: block.event.title });
      }
    }
  }

  return {
    reader,
    cards: cards.map((card) => ({
      id: card.id,
      roleId: card.roleId,
      lineageId: card.lineageId,
      chunk: card.chunk,
      textHash: card.textHash,
      createdAt: card.createdAt.toISOString(),
      state: card.state,
      due: card.due.toISOString(),
      stability: card.stability,
      difficulty: card.difficulty,
      scheduledDays: card.scheduledDays,
      learningSteps: card.learningSteps,
      reps: card.reps,
      lapses: card.lapses,
      lastReview: card.lastReview?.toISOString() ?? null,
    })),
    history: history.map((entry) => ({
      cardId: entry.cardId,
      at: entry.reviewedAt.toISOString(),
      rating: entry.rating,
      mode: entry.mode,
    })),
    recentReviews: reviews.map((review) => review.reviewedAt.toISOString()),
    weeklyDays: profile?.weeklyDays ?? 4,
    rehearsals: [...next.values()].sort((a, b) => a.start.localeCompare(b.start)),
  };
}

export const reviewSchema = z.object({
  roleId: z.string().min(1).max(100),
  lineageId: z.string().min(1).max(100),
  chunk: z.number().int().min(0).max(500),
  rating: z.number().int().min(1).max(4),
  auto: z.boolean(),
  revealed: z.number().min(0).max(1),
  mode: z.enum(["flow", "drill"]),
  /** Stufe beim Abfragen (fehlt bei alten Einträgen der Warteschlange). */
  stage: z.enum(["cloze", "initials", "hidden"]).optional(),
  at: z.string().datetime(),
});

export type ReviewInput = z.infer<typeof reviewSchema>;

/**
 * Speichert Abfragen (auch nachträglich aus der Offline-Warteschlange, daher mit Zeitpunkt).
 * Wortlaut und Prüfsumme kommen aus der neuesten freigegebenen Fassung, nicht vom Client.
 */
export async function recordReviews(userId: string, showId: string, entries: ReviewInput[]) {
  const version = await latestReleasedVersion(showId);
  if (!version) throw new ScriptLearnError("Keine freigegebene Fassung.");
  const lineages = [...new Set(entries.map((entry) => entry.lineageId))];
  const blocks = await prisma.scriptBlock.findMany({
    where: { versionId: version.id, lineageId: { in: lineages }, kind: "speech" },
    select: { lineageId: true, parts: true, roles: { select: { roleId: true } } },
  });
  const byLineage = new Map(blocks.map((block) => [block.lineageId, block]));
  const now = Date.now();
  let saved = 0;

  for (const entry of [...entries].sort((a, b) => a.at.localeCompare(b.at))) {
    const block = byLineage.get(entry.lineageId);
    if (!block || !block.roles.some((role) => role.roleId === entry.roleId)) continue;
    const chunk = tokenizeBlock(readParts(block.parts)).chunks[entry.chunk];
    if (!chunk) continue;
    // Zeitpunkte aus der Zukunft oder älter als 30 Tage nicht übernehmen.
    const atMs = Math.min(Date.parse(entry.at), now);
    if (atMs < now - 30 * 86_400_000) continue;
    const at = new Date(atMs);

    const where = {
      userId_roleId_lineageId_chunk: {
        userId,
        roleId: entry.roleId,
        lineageId: entry.lineageId,
        chunk: entry.chunk,
      },
    };
    const existing = await prisma.scriptLearnCard.findUnique({ where });
    const previous: CardState | null = existing
      ? {
          state: existing.state,
          due: existing.due.toISOString(),
          stability: existing.stability,
          difficulty: existing.difficulty,
          scheduledDays: existing.scheduledDays,
          learningSteps: existing.learningSteps,
          reps: existing.reps,
          lapses: existing.lapses,
          lastReview: existing.lastReview?.toISOString() ?? null,
        }
      : null;
    // Nicht neuer als die letzte gespeicherte Abfrage (zweites Gerät, doppelt gesendet) → nur
    // protokollieren; derselbe Zeitpunkt zweimal wird unten am eindeutigen Index verworfen.
    const stale = !!previous?.lastReview && previous.lastReview >= at.toISOString();
    const next = stale
      ? previous
      : applyReview(previous, entry.rating as LearnRating, at, {
          changed: !!existing && existing.textHash !== chunk.hash,
          stage: entry.stage,
        });
    const data = {
      textHash: chunk.hash,
      state: next!.state,
      due: new Date(next!.due),
      stability: next!.stability,
      difficulty: next!.difficulty,
      scheduledDays: next!.scheduledDays,
      learningSteps: next!.learningSteps,
      reps: next!.reps,
      lapses: next!.lapses,
      lastReview: next!.lastReview ? new Date(next!.lastReview) : null,
    };
    const card = await prisma.scriptLearnCard.upsert({
      where,
      create: {
        userId,
        showId,
        roleId: entry.roleId,
        lineageId: entry.lineageId,
        chunk: entry.chunk,
        ...data,
      },
      update: data,
      select: { id: true },
    });
    try {
      await prisma.scriptLearnReview.create({
        data: {
          cardId: card.id,
          rating: entry.rating,
          auto: entry.auto,
          revealed: entry.revealed,
          mode: entry.mode,
          reviewedAt: at,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
    saved += 1;
  }
  return saved;
}

export async function setWeeklyDays(userId: string, weeklyDays: number) {
  await prisma.scriptLearnProfile.upsert({
    where: { userId },
    create: { userId, weeklyDays },
    update: { weeklyDays },
  });
}

/** Lernstand einer Rolle zurücksetzen (z. B. nach Umbesetzung). */
export async function resetRole(userId: string, showId: string, roleId: string) {
  await prisma.scriptLearnCard.deleteMany({ where: { userId, showId, roleId } });
}

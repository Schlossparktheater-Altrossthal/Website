import { prisma } from "@/lib/prisma";

import { readerStateSchema, sanitizeViewPatch, type ReaderState } from "./view-options";

/** Persönlicher Leser-Stand je Person und Stück (docs/Plan/skript-ansicht-plan.md, Phase 5). */

export async function loadReaderState(userId: string, showId: string): Promise<ReaderState | null> {
  const row = await prisma.scriptReaderState.findUnique({
    where: { userId_showId: { userId, showId } },
    select: { state: true },
  });
  const parsed = readerStateSchema.safeParse(row?.state);
  if (!parsed.success) return null;
  return {
    view: sanitizeViewPatch(parsed.data.view),
    roleIds: parsed.data.roleIds,
    savedAt: parsed.data.savedAt,
  };
}

/** Speichert nur, wenn der Stand neuer ist als der gespeicherte (zwei Geräte gleichzeitig). */
export async function saveReaderState(userId: string, showId: string, raw: unknown) {
  const parsed = readerStateSchema.parse(raw);
  const state = {
    view: sanitizeViewPatch(parsed.view),
    roleIds: parsed.roleIds,
    savedAt: parsed.savedAt,
  };
  const current = await loadReaderState(userId, showId);
  if (current && current.savedAt >= state.savedAt) return false;
  await prisma.scriptReaderState.upsert({
    where: { userId_showId: { userId, showId } },
    create: { userId, showId, state },
    update: { state },
  });
  return true;
}

import { prisma } from "@/lib/prisma";

/**
 * Abgeleitete Frist je Szene: nächste anstehende Probe, in der die Szene vorkommt.
 * Ein Objekt ist fällig zur frühesten Probe einer seiner Szenen.
 */
export async function nextRehearsalByScene(sceneIds: string[], now = new Date()) {
  const result = new Map<string, Date>();
  if (!sceneIds.length) return result;
  const blocks = await prisma.eventBlock.findMany({
    where: {
      sceneId: { in: [...new Set(sceneIds)] },
      event: { start: { gte: now }, status: { not: "CANCELLED" } },
    },
    select: { sceneId: true, event: { select: { start: true } } },
  });
  for (const block of blocks) {
    if (!block.sceneId) continue;
    const current = result.get(block.sceneId);
    if (!current || block.event.start < current) result.set(block.sceneId, block.event.start);
  }
  return result;
}

export function earliestFor(sceneIds: string[], byScene: Map<string, Date>) {
  let best: Date | null = null;
  for (const id of sceneIds) {
    const date = byScene.get(id);
    if (date && (!best || date < best)) best = date;
  }
  return best;
}

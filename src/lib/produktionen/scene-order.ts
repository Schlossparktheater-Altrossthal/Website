import { prisma } from "@/lib/prisma";

/**
 * Nummern und Reihenfolge neu vergeben: `identifier` = „Akt.Position“, `sequence` fortlaufend.
 * `order` legt die neue Reihenfolge fest (IDs); sonst bleibt die bisherige.
 */
export async function renumberScenes(showId: string, order?: { id: string; act: number }[]) {
  const scenes = await prisma.scene.findMany({
    where: { showId },
    orderBy: [{ act: "asc" }, { sequence: "asc" }],
    select: { id: true, act: true, identifier: true, sequence: true },
  });
  const byId = new Map(scenes.map((scene) => [scene.id, scene]));
  const ordered = order
    ? [
        ...order.flatMap((entry) => {
          const scene = byId.get(entry.id);
          return scene ? [{ ...scene, act: entry.act }] : [];
        }),
        ...scenes.filter((scene) => !order.some((entry) => entry.id === scene.id)),
      ].sort((a, b) => a.act - b.act)
    : scenes;
  const positions = new Map<number, number>();
  const updates = ordered.flatMap((scene, index) => {
    const position = (positions.get(scene.act) ?? 0) + 1;
    positions.set(scene.act, position);
    const identifier = `${scene.act}.${position}`;
    const current = byId.get(scene.id);
    if (
      current?.identifier === identifier &&
      current.sequence === index + 1 &&
      current.act === scene.act
    ) {
      return [];
    }
    return [
      prisma.scene.update({
        where: { id: scene.id },
        data: { act: scene.act, identifier, sequence: index + 1 },
      }),
    ];
  });
  if (updates.length) await prisma.$transaction(updates);
  // Akte bleiben bestehen, auch wenn sie leer werden (löschen nur ausdrücklich).
  await prisma.showAct.createMany({
    data: [...new Set(ordered.map((scene) => scene.act))].map((number) => ({ showId, number })),
    skipDuplicates: true,
  });
}

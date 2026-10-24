// Manueller DB-Test (nicht in CI): DATABASE_URL auf eine Wegwerf-DB, dann `npx tsx` ausführen.
import { prisma } from "@/lib/prisma";

import { splitScriptRole } from "../role-admin";
import { loadScriptReview, releaseScriptVersion, saveRoleAssignments } from "../review";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.warn("ok:", msg);
}

const TEXTS = [
  "Monsieur, Ihr Tee ist bereit und die Koffer sind gepackt.",
  "Ich habe die Uhr gestellt, wie Sie es wünschten, Monsieur Fogg.",
  "Halt, im Namen der Königin, bleiben Sie stehen!",
  "Sie sind verhaftet wegen des Bankraubs von London.",
  "Wir haben ihn, Inspektor, er wollte zum Hafen.",
  "Ich schreibe es in mein Notizbuch, ganz genau.",
];

async function main() {
  const user = await prisma.user.create({ data: { email: "t@example.org", name: "Lisa" } });
  const show = await prisma.show.create({ data: { year: 2027, dates: [] } });
  const version = (label: string, status: "draft" | "released") =>
    prisma.scriptVersion.create({
      data: {
        showId: show.id,
        label,
        sourceName: "a.pdf",
        sourceSize: 1,
        profileId: "x",
        profileScore: 1,
        importReport: {},
        status,
        releasedAt: status === "released" ? new Date() : null,
      },
    });
  const scene = (versionId: string, sequence: number, title: string, sceneKey?: string) =>
    prisma.scriptScene.create({
      data: { versionId, sequence, title, ...(sceneKey ? { sceneKey } : {}) },
    });
  let seq = 0;
  const block = (
    versionId: string,
    sceneId: string,
    speaker: string,
    text: string,
    roleId?: string,
  ) =>
    prisma.scriptBlock.create({
      data: {
        versionId,
        sceneId,
        sequence: seq++,
        lineageId: crypto.randomUUID(),
        kind: "speech",
        speaker,
        parts: [{ kind: "text", text }],
        wordCount: 8,
        ...(roleId ? { roles: { create: [{ roleId }] } } : {}),
      },
    });
  const role = (name: string) => prisma.scriptRole.create({ data: { showId: show.id, name } });

  // Fassung A: Diener, Polizist 1, Polizist 2, Fix (in zwei Szenen)
  const a = await version("A", "released");
  const a1 = await scene(a.id, 0, "Szene 1 – Club", "K1");
  const a2 = await scene(a.id, 1, "Szene 2 – Hafen", "K2");
  const [diener, p1, p2, fix] = await Promise.all(
    ["Diener", "Polizist 1", "Polizist 2", "Fix"].map(role),
  );
  await block(a.id, a1.id, "Diener", TEXTS[0], diener.id);
  await block(a.id, a1.id, "Diener", TEXTS[1], diener.id);
  await block(a.id, a2.id, "Polizist 1", TEXTS[2], p1.id);
  await block(a.id, a2.id, "Polizist 2", TEXTS[3], p2.id);
  await block(a.id, a2.id, "Polizist 1", TEXTS[4], p1.id);
  await block(a.id, a1.id, "Fix", TEXTS[5], fix.id);
  await block(a.id, a2.id, "Fix", TEXTS[5] + " Noch einmal.", fix.id);

  // Fix in Szene 2 ist eigentlich ein Reporter → trennen
  const split = await splitScriptRole({
    showId: show.id,
    roleId: fix.id,
    sceneKeys: ["K2"],
    name: "Reporter",
    userId: user.id,
  });
  assert(split.moved === 1, "Trennen: ein Absatz an „Reporter“");

  // Fassung B (Entwurf): Diener → Passepartout, Polizist 1+2 → Polizist
  const b = await version("B", "draft");
  const b1 = await scene(b.id, 0, "Szene 1 – Club");
  const b2 = await scene(b.id, 1, "Szene 2 – Hafen");
  await block(b.id, b1.id, "Passepartout", TEXTS[0]);
  await block(b.id, b1.id, "Passepartout", TEXTS[1]);
  await block(b.id, b2.id, "Polizist", TEXTS[2]);
  await block(b.id, b2.id, "Polizist", TEXTS[3]);
  await block(b.id, b2.id, "Polizist", TEXTS[4]);
  await block(b.id, b1.id, "Fix", TEXTS[5]);
  await block(b.id, b2.id, "Fix", TEXTS[5] + " Noch einmal.");

  const review = (await loadScriptReview(b.id))!;
  const pass = review.roleChanges.find((c) => c.name === "Passepartout");
  const pol = review.roleChanges.find((c) => c.name === "Polizist");
  assert(
    pass?.kind === "rename" && pass.sources[0].roleId === diener.id,
    "Passepartout ← Diener erkannt",
  );
  assert(pol?.kind === "merge" && pol.sources.length === 2, "Polizist ← Polizist 1 + 2 erkannt");

  await saveRoleAssignments(b.id, user.id, [
    { name: "Passepartout", roleId: diener.id, renameTo: "Passepartout" },
    { name: "Polizist", roleId: p1.id, renameTo: "Polizist", mergeRoleIds: [p2.id] },
    { name: "Fix", roleId: fix.id },
  ]);
  const roles = await prisma.scriptRole.findMany({
    where: { showId: show.id },
    orderBy: { name: "asc" },
  });
  assert(
    roles.map((r) => r.name).join() === "Fix,Passepartout,Polizist,Reporter",
    "Rollen umbenannt/zusammengeführt",
  );
  assert(
    roles.find((r) => r.name === "Passepartout")!.aliases.includes("diener"),
    "alter Name bleibt Schreibweise",
  );
  const oldPol = await prisma.scriptBlockRole.count({
    where: { roleId: p1.id, block: { versionId: a.id } },
  });
  assert(oldPol === 3, "Fassung A: alle Polizisten-Absätze bei der zusammengeführten Rolle");

  await releaseScriptVersion(b.id, user.id);
  const reporterB = await prisma.scriptBlockRole.count({
    where: { roleId: split.id, block: { versionId: b.id } },
  });
  const fixB = await prisma.scriptBlockRole.count({
    where: { roleId: fix.id, block: { versionId: b.id } },
  });
  assert(reporterB === 1 && fixB === 1, "Fassung B: Trennung bei der Freigabe angewandt");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

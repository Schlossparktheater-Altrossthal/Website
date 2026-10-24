// Manueller DB-Test (nicht in CI): DATABASE_URL auf eine Wegwerf-DB, dann `npx tsx` ausführen.
import { prisma } from "@/lib/prisma";
import { mergeCharacters } from "@/lib/produktionen/character-merge";

import {
  applyAppearanceTakeover,
  applyRoleTakeover,
  applySceneTakeover,
  loadTakeover,
} from "../takeover";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.warn("ok:", msg);
}

async function main() {
  const user = await prisma.user.create({ data: { email: "t@example.org", name: "Lisa" } });
  const show = await prisma.show.create({ data: { year: 2027, dates: [] } });
  const own = await prisma.scene.create({
    data: { showId: show.id, slug: "club", title: "Im Club", durationMinutes: 9, sequence: 1 },
  });
  const v = await prisma.scriptVersion.create({
    data: {
      showId: show.id,
      label: "A",
      sourceName: "a.pdf",
      sourceSize: 1,
      profileId: "x",
      profileScore: 1,
      importReport: {},
      status: "released",
      releasedAt: new Date(),
    },
  });
  const s1 = await prisma.scriptScene.create({
    data: { versionId: v.id, sequence: 0, title: "SZENE 1 – Im Club", sceneKey: "K1" },
  });
  const s2 = await prisma.scriptScene.create({
    data: { versionId: v.id, sequence: 1, title: "SZENE 2 – Am Hafen", sceneKey: "K2" },
  });
  const fogg = await prisma.scriptRole.create({ data: { showId: show.id, name: "FOGG" } });
  const pass = await prisma.scriptRole.create({ data: { showId: show.id, name: "PASSEPARTOUT" } });
  let seq = 0;
  const mk = (sceneId: string, roleId: string) =>
    prisma.scriptBlock.create({
      data: {
        versionId: v.id,
        sceneId,
        sequence: seq++,
        lineageId: `l${seq}`,
        kind: "speech",
        speaker: "x",
        parts: [{ kind: "text", text: "Ein paar Worte hier" }],
        wordCount: 4,
        roles: { create: [{ roleId }] },
      },
    });
  await mk(s1.id, fogg.id);
  await mk(s1.id, pass.id);
  await mk(s2.id, pass.id);

  let t = (await loadTakeover(show.id))!;
  const k1 = t.scenes.find((s) => s.sceneKey === "K1")!;
  assert(k1.status === "new" && k1.suggestionId === own.id, "Szene 1 → Vorschlag „Im Club“");
  await applySceneTakeover(show.id, user.id, [
    { sceneKey: "K1", target: own.id, fields: [] },
    { sceneKey: "K2", target: "new", fields: [] },
  ]);
  const scenes = await prisma.scene.findMany({
    where: { showId: show.id },
    orderBy: { sequence: "asc" },
  });
  assert(scenes.length === 2 && scenes[1].title === "Am Hafen", "Szene „Am Hafen“ angelegt");
  assert(
    scenes[0].title === "Im Club" && scenes[0].durationMinutes === 9,
    "bestehende Szene unverändert",
  );

  t = (await loadTakeover(show.id))!;
  assert(
    t.roles.length === 2 && t.roles.every((r) => !r.characterIds.length),
    "zwei offene Rollen",
  );
  await applyRoleTakeover(
    show.id,
    user.id,
    t.roles.map((r) => ({ scriptRoleId: r.id, target: "new" })),
  );
  const chars = await prisma.character.findMany({ where: { showId: show.id } });
  assert(
    chars
      .map((c) => c.name)
      .sort()
      .join() === "Fogg,Passepartout",
    "Rollen lesbar angelegt",
  );

  t = (await loadTakeover(show.id))!;
  assert(t.appearances.add.length === 3, "drei Auftritte vorgeschlagen");
  await applyAppearanceTakeover(show.id, {
    add: t.appearances.add,
    remove: [],
    includeMembers: false,
  });
  t = (await loadTakeover(show.id))!;
  assert(!t.appearances.add.length && !t.appearances.remove.length, "danach nichts mehr offen");

  // Neue Fassung ohne Fogg in Szene 1 → Entfernen nur vorgeschlagen
  await prisma.scriptBlockRole.deleteMany({ where: { roleId: fogg.id } });
  t = (await loadTakeover(show.id))!;
  assert(t.appearances.remove.length === 1, "Fogg in Szene 1 zum Entfernen vorgeschlagen");
  const foggChar = chars.find((c) => c.name === "Fogg")!;
  await prisma.sceneCharacter.updateMany({
    where: { characterId: foggChar.id },
    data: { source: "manual" },
  });
  t = (await loadTakeover(show.id))!;
  assert(!t.appearances.remove.length, "von Hand gepflegt → nie entfernen");

  // Rollen im Stück zusammenführen
  const passChar = chars.find((c) => c.name === "Passepartout")!;
  await mergeCharacters(foggChar.id, passChar.id);
  const app = await prisma.sceneCharacter.findMany({ where: { characterId: passChar.id } });
  assert(
    app.length === 2 && app.find((a) => a.sceneId === own.id)?.source === "manual",
    "Auftritte zusammengefasst, manuell gewinnt",
  );
  const links = await prisma.scriptRoleLink.findMany({ where: { characterId: passChar.id } });
  assert(links.length === 2, "Skript-Verknüpfungen umgehängt");
  assert(
    !(await prisma.character.findUnique({ where: { id: foggChar.id } })),
    "leere Rolle gelöscht",
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

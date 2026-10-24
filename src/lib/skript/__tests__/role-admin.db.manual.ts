// Manueller DB-Test (nicht in CI): DATABASE_URL auf eine Wegwerf-DB, dann `npx tsx` ausführen.
import { prisma } from "@/lib/prisma";
import {
  mergeScriptRoles,
  undoScriptRoleMerge,
  setScriptRoleLinks,
  setScriptGroupRules,
} from "../role-admin";
import { loadScriptReader } from "../reader";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.warn("ok:", msg);
}

async function main() {
  const user = await prisma.user.create({ data: { email: "t@example.org", name: "Lisa" } });
  const user2 = await prisma.user.create({ data: { email: "e@example.org", name: "Ede" } });
  const show = await prisma.show.create({ data: { year: 2027, dates: [] } });
  const fogg = await prisma.character.create({ data: { showId: show.id, name: "Phileas Fogg" } });
  const ens = await prisma.character.create({ data: { showId: show.id, name: "Ensemble" } });
  await prisma.characterCasting.create({ data: { characterId: fogg.id, userId: user.id } });
  await prisma.characterCasting.create({ data: { characterId: ens.id, userId: user2.id } });
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
  const sc = await prisma.scriptScene.create({
    data: { versionId: v.id, sequence: 0, title: "1" },
  });
  const [a, b, g] = await Promise.all(
    [
      ["FOGG", "person"],
      ["Mr. Fogg", "person"],
      ["Alle", "group"],
    ].map(([name, kind]) =>
      prisma.scriptRole.create({
        data: {
          showId: show.id,
          name,
          kind: kind as "person" | "group",
          groupMode: kind === "group" ? "cast" : null,
        },
      }),
    ),
  );
  const mk = (seq: number, roleIds: string[]) =>
    prisma.scriptBlock.create({
      data: {
        versionId: v.id,
        sceneId: sc.id,
        sequence: seq,
        lineageId: `l${seq}`,
        kind: "speech",
        speaker: "x",
        parts: [{ kind: "text", text: "Hallo Welt" }],
        roles: { create: roleIds.map((roleId) => ({ roleId })) },
      },
    });
  await mk(0, [a.id]);
  await mk(1, [b.id]);
  await mk(2, [a.id, b.id]);
  await mk(3, [g.id]);
  await prisma.scriptLearnCard.create({
    data: {
      userId: user.id,
      showId: show.id,
      roleId: b.id,
      lineageId: "l1",
      chunk: 0,
      textHash: "h",
      due: new Date(),
    },
  });

  // Name „FOGG“ ≠ „Phileas Fogg“ → ohne Link keine eigene Rolle
  let r = await loadScriptReader(v.id, user.id);
  assert(
    !r!.ownRoleIds.includes(a.id) && r!.ownRoleIds.includes(g.id),
    "ohne Link kein FOGG, aber „Alle“",
  );
  await setScriptRoleLinks(show.id, a.id, [fogg.id], user.id);
  r = await loadScriptReader(v.id, user.id);
  assert(r!.ownRoleIds.join() === a.id, "Link macht FOGG zu Lisas Rolle");
  const r2 = await loadScriptReader(v.id, user2.id);
  assert(r2!.ownRoleIds.join() === g.id, "Ensemble-only bekommt „Alle“");
  const alle = r!.blocks.find((x) => x.lineageId === "l3")!;
  assert(alle.memberRoleIds.includes(a.id), "„Alle“ enthält FOGG (besetzt)");
  await setScriptGroupRules({
    showId: show.id,
    groupRoleId: g.id,
    sceneKey: null,
    lineageId: "l3",
    include: [b.id],
    exclude: [],
    userId: user.id,
  });
  r = await loadScriptReader(v.id, user.id);
  assert(
    r!.blocks.find((x) => x.lineageId === "l3")!.memberRoleIds.join() === b.id,
    "Absatz-Ausnahme greift",
  );

  const merge = await mergeScriptRoles(show.id, b.id, a.id, user.id);
  r = await loadScriptReader(v.id, user.id);
  const owned = r!.blocks
    .filter((x) => x.roleIds.includes(a.id))
    .map((x) => x.lineageId)
    .sort();
  assert(owned.join() === "l0,l1,l2", "nach Merge gehören alle Absätze FOGG");
  assert(
    r!.blocks.find((x) => x.lineageId === "l3")!.memberRoleIds.join() === a.id,
    "Gruppenregel umgehängt",
  );
  const card = await prisma.scriptLearnCard.findFirst({ where: { userId: user.id } });
  assert(card!.roleId === a.id, "Lernkarte gewandert");
  const target = await prisma.scriptRole.findUnique({ where: { id: a.id } });
  assert(target!.aliases.includes("mr fogg"), "Schreibweise übernommen");

  await undoScriptRoleMerge(show.id, merge.id);
  const back = await prisma.scriptBlockRole.findMany({ where: { roleId: b.id } });
  assert(back.length === 2, "Rückgängig: Mr. Fogg hat wieder l1 und l2");
  const aBlocks = await prisma.scriptBlockRole.findMany({ where: { roleId: a.id } });
  assert(aBlocks.length === 2, "FOGG hat wieder l0 und l2");
  const card2 = await prisma.scriptLearnCard.findFirst({ where: { userId: user.id } });
  assert(card2!.roleId === b.id, "Lernkarte zurück");
  const t2 = await prisma.scriptRole.findUnique({ where: { id: a.id } });
  assert(!t2!.aliases.includes("mr fogg") && !!t2!.linkedAt, "Ziel wie vorher");
  const rule = await prisma.scriptGroupRule.findFirst({ where: { groupRoleId: g.id } });
  assert(rule!.memberRoleId === b.id, "Gruppenregel zurück");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

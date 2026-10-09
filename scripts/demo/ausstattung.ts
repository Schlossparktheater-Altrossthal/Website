// Demo: Ausstattung (docs/Plan/ausstattung-plan.md) – Requisiten und Bühnenbild beim Bühnenbau,
// Kostüme aus Teilen bei den Kostümen, offene und abgelehnte Anforderungen aus Szenen.

import type { ProductionObjectKind, ProductionObjectStatus } from "@prisma/client";

import { createObjectWithCard, setObjectStatus } from "@/lib/ausstattung/service";
import { prisma } from "@/lib/prisma";

/**
 * Bausteine und Recht „Ausstattung anfordern“ wie in der Migration – der Stammdaten-Export kann
 * älter sein als die Migration und würde sie sonst überschreiben.
 */
export async function applyAusstattungDefaults() {
  await prisma.$executeRawUnsafe(`
    UPDATE "DepartmentTemplate" SET "modules" = ARRAY(SELECT DISTINCT unnest(array_cat("modules", ARRAY['requirements', 'props'])))
    WHERE "slug" = 'requisite';
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE "DepartmentTemplate" SET "modules" = ARRAY(SELECT DISTINCT unnest(array_cat("modules", ARRAY['requirements', 'costumes'])))
    WHERE "slug" IN ('kostuem', 'kostueme');
  `);
  await prisma.$executeRawUnsafe(`
    UPDATE "DepartmentTemplate" SET "modules" = ARRAY(SELECT DISTINCT unnest(array_cat("modules", ARRAY['requirements', 'set', 'props'])))
    WHERE "slug" IN ('buehnenbild', 'buehnenbau');
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO "AppRolePermission" ("id", "roleId", "permissionId")
    SELECT DISTINCT 'apr_' || md5(arp."roleId" || target."id"), arp."roleId", target."id"
    FROM "AppRolePermission" arp
    JOIN "Permission" source ON source."id" = arp."permissionId"
      AND source."key" IN ('PRIVATE.PRODUCTION.SHOW.MANAGE', 'PRIVATE.PRODUCTION.PLAN.MANAGE', 'PRIVATE.REHEARSAL.PLANNING.MANAGE')
    CROSS JOIN (SELECT "id" FROM "Permission" WHERE "key" = 'PRIVATE.PRODUCTION.REQUIREMENT.CREATE') target
    ON CONFLICT ("roleId", "permissionId") DO NOTHING;
  `);
}

type DemoObject = {
  title: string;
  kind: ProductionObjectKind;
  /** Szenen als Index (0-basiert) in SCENES. */
  scenes: number[];
  roles?: string[];
  status: ProductionObjectStatus;
  source?: "stock" | "build" | "buy" | "borrow";
  description?: string;
  /** Position je Szene, Index wie `scenes`. */
  notes?: (string | null)[];
  steps?: [string, boolean][];
  costCents?: number;
  /** Kostüm: Titel der Teile. */
  parts?: string[];
};

const SET_AND_PROPS: DemoObject[] = [
  {
    title: "Thron des Theseus",
    kind: "set_piece",
    scenes: [0, 7],
    status: "ready",
    source: "stock",
    description: "Der Thron aus dem Fundus, neu mit Goldfarbe abgesetzt.",
  },
  {
    title: "Laube für Titania",
    kind: "set_piece",
    scenes: [2, 5, 7],
    status: "in_progress",
    source: "build",
    description:
      "Weidenruten-Laube, ca. 2 m hoch, nach hinten offen, damit Titania unbemerkt abgehen kann. Muss bei Wind stehen bleiben – Bodenanker!",
    steps: [
      ["Weidenruten beim Gärtner abholen", true],
      ["Grundgestell schweißen", true],
      ["Ruten flechten", false],
      ["Blumen und Lichterkette", false],
    ],
    costCents: 8500,
  },
  {
    title: "Waldkulisse mit Lichtung",
    kind: "set_piece",
    scenes: [2, 3, 4, 5, 6],
    status: "in_progress",
    source: "build",
    notes: ["bleibt stehen", "bleibt stehen", null, null, null],
  },
  {
    title: "Mauer (tragbar)",
    kind: "set_piece",
    scenes: [8],
    roles: ["schnauz"],
    status: "planned",
    source: "build",
    description: "Leichte Pappwand mit Loch, Schnauz trägt sie selbst auf die Bühne.",
  },
  {
    title: "Hochzeitstafel",
    kind: "set_piece",
    scenes: [7, 8],
    status: "planned",
    source: "borrow",
    description: "Lange Tafel mit weißem Tuch – Biertischgarnitur vom Sportverein.",
  },
  {
    title: "Liebesblume",
    kind: "prop",
    scenes: [3, 6],
    roles: ["oberon", "puck"],
    status: "ready",
    source: "build",
    notes: ["Puck, Gürteltasche", "Puck"],
  },
  {
    title: "Rollenbuch des Squenz",
    kind: "prop",
    scenes: [1, 4],
    roles: ["squenz"],
    status: "ready",
    source: "buy",
    notes: ["Tisch rechts", "Squenz"],
  },
  {
    title: "Laterne (Mondschein)",
    kind: "prop",
    scenes: [8],
    roles: ["schlucker"],
    status: "in_progress",
    source: "stock",
    notes: ["Gasse links"],
  },
  {
    title: "Dolch für Thisbe",
    kind: "prop",
    scenes: [8],
    roles: ["flaut"],
    status: "planned",
    source: "build",
    description: "Stumpf, aus Holz, silbern bemalt – darf nicht nach echtem Messer aussehen.",
  },
  {
    title: "Schwert des Theseus",
    kind: "prop",
    scenes: [0, 7],
    roles: ["theseus"],
    status: "ready",
    source: "stock",
    notes: ["Theseus, am Gürtel", "Theseus"],
  },
];

const COSTUMES: DemoObject[] = [
  {
    title: "Oberon – Waldkönig",
    kind: "costume",
    scenes: [2, 3, 7, 9],
    roles: ["oberon"],
    status: "in_progress",
    parts: ["Geweihkrone", "Umhang moosgrün", "Leinenhemd naturweiß"],
  },
  {
    title: "Titania – Feenkleid",
    kind: "costume",
    scenes: [2, 5, 7, 9],
    roles: ["titania"],
    status: "in_progress",
    parts: ["Feenkleid Tüll", "Blütenkranz"],
  },
  {
    title: "Zettel – Weber",
    kind: "costume",
    scenes: [1, 4],
    roles: ["zettel"],
    status: "ready",
    parts: ["Leinenhemd naturweiß", "Lederschurz", "Kappe"],
  },
  {
    title: "Zettel – Eselskopf",
    kind: "costume",
    scenes: [5],
    roles: ["zettel"],
    status: "in_progress",
    description:
      "Schneller Umzug nach der Probe im Wald! Kopf muss in unter 30 Sekunden auf- und absetzbar sein.",
    parts: ["Eselskopf", "Leinenhemd naturweiß", "Lederschurz"],
  },
  {
    title: "Zettel als Pyramus",
    kind: "costume",
    scenes: [8],
    roles: ["zettel"],
    status: "planned",
    parts: ["Umhang rot", "Holzschwert"],
  },
  {
    title: "Puck – Kobold",
    kind: "costume",
    scenes: [2, 3, 4, 6, 7, 9],
    roles: ["puck"],
    status: "ready",
    parts: ["Kapuzenwams", "Gürteltasche"],
  },
  {
    title: "Hermia – Reisekleid",
    kind: "costume",
    scenes: [0, 6],
    roles: ["hermia"],
    status: "planned",
  },
];

export async function seedDemoAusstattung(
  showId: string,
  characterIds: Map<string, string>,
  sceneIds: string[],
  uid: (key: string) => string,
) {
  const departments = await prisma.department.findMany({
    where: { showId, slug: { in: ["buehnenbau", "kostueme"] } },
    select: { id: true, slug: true },
  });
  const bySlug = new Map(departments.map((entry) => [entry.slug, entry.id]));
  const build = bySlug.get("buehnenbau");
  const costume = bySlug.get("kostueme");
  if (!build || !costume) return;

  const create = async (departmentId: string, object: DemoObject, createdBy: string) => {
    const created = await createObjectWithCard(prisma, {
      showId,
      departmentId,
      kind: object.kind,
      title: object.title,
      description: object.description,
      createdById: uid(createdBy),
      sceneIds: object.scenes.map((index) => sceneIds[index]!).filter(Boolean),
      characterIds: (object.roles ?? []).map((key) => characterIds.get(key)!).filter(Boolean),
    });
    await prisma.productionObject.update({
      where: { id: created.id },
      data: { source: object.source ?? "undecided", costCents: object.costCents ?? null },
    });
    for (const [index, note] of (object.notes ?? []).entries()) {
      const sceneId = sceneIds[object.scenes[index]!];
      if (!note || !sceneId) continue;
      await prisma.objectScene.updateMany({
        where: { objectId: created.id, sceneId },
        data: { note },
      });
    }
    if (object.status !== "planned") await setObjectStatus(prisma, created.id, object.status);
    if (object.steps?.length) {
      const task = await prisma.departmentTask.findUnique({ where: { objectId: created.id } });
      if (task) {
        await prisma.taskChecklistItem.createMany({
          data: object.steps.map(([text, done], position) => ({
            taskId: task.id,
            text,
            position,
            doneAt: done ? new Date() : null,
          })),
        });
      }
    }
    return created.id;
  };

  for (const object of SET_AND_PROPS) await create(build, object, "jonas");

  // Kostüme aus Teilen; ein Teil (Leinenhemd, Lederschurz) steckt in mehreren Kostümen.
  const parts = new Map<string, string>();
  for (const object of COSTUMES) {
    const costumeId = await create(costume, object, "julia");
    for (const [position, title] of (object.parts ?? []).entries()) {
      let partId = parts.get(title);
      if (!partId) {
        partId = await create(
          costume,
          { title, kind: "costume_part", scenes: [], status: "ready", source: "stock" },
          "julia",
        );
        parts.set(title, partId);
      }
      await prisma.costumePart.create({ data: { costumeId, partId, position } });
    }
  }

  // Anforderungen der Regie: zwei offen im Eingang, eine abgelehnt.
  const requirements: {
    departmentId: string;
    scene: number;
    kind: ProductionObjectKind;
    role?: string;
    text: string;
    declined?: string;
  }[] = [
    {
      departmentId: costume,
      scene: 9,
      kind: "costume",
      role: "hermia",
      text: "Hochzeitskleid für Hermia im Schlussbild. Hell, schlicht, nicht bodenlang (Wiese!). Sie muss darin tanzen können.",
    },
    {
      departmentId: build,
      scene: 8,
      kind: "prop",
      role: "schlucker",
      text: "Dornbusch und Hund für den Mondschein – gern als Stoffhund an einer Leine, der Busch darf albern aussehen.",
    },
    {
      departmentId: build,
      scene: 2,
      kind: "set_piece",
      text: "Echter Wasserlauf durch die Lichtung, ca. 4 m.",
      declined: "Zu aufwendig für den Schlosspark – wir lösen es mit blauem Licht und Tüchern.",
    },
  ];
  for (const entry of requirements) {
    const sceneId = sceneIds[entry.scene];
    if (!sceneId) continue;
    await prisma.sceneRequirement.create({
      data: {
        showId,
        sceneId,
        departmentId: entry.departmentId,
        kind: entry.kind,
        characterId: entry.role ? (characterIds.get(entry.role) ?? null) : null,
        text: entry.text,
        requestedById: uid("miriam"),
        ...(entry.declined
          ? {
              status: "declined",
              declineReason: entry.declined,
              decidedById: uid("jonas"),
              decidedAt: new Date(),
            }
          : {}),
      },
    });
  }
}

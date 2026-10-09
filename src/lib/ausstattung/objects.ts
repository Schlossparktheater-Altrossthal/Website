import type {
  ProductionObjectKind,
  ProductionObjectSource,
  ProductionObjectStatus,
  SceneRequirementStatus,
} from "@prisma/client";

import { earliestFor, nextRehearsalByScene } from "@/lib/ausstattung/rehearsals";
import { getUserDisplayName } from "@/lib/names";
import { prisma } from "@/lib/prisma";
import { compareSceneIdentifiers } from "@/lib/produktionen/roles-scenes";

/** Szene in Kurzform für Chips und Listen. */
export type StageScene = {
  id: string;
  act: number;
  identifier: string | null;
  title: string | null;
  /** Rollen, die in der Szene auftreten. */
  characterIds: string[];
};

export type StageCharacter = {
  id: string;
  name: string;
  color: string | null;
  /** Besetzung, Erstbesetzung zuerst. */
  cast: { userId: string; name: string; type: string }[];
};

export type StageData = { scenes: StageScene[]; characters: StageCharacter[] };

export type ObjectListItem = {
  id: string;
  kind: ProductionObjectKind;
  title: string;
  description: string | null;
  status: ProductionObjectStatus;
  source: ProductionObjectSource;
  costCents: number | null;
  dimensions: string | null;
  sceneIds: string[];
  /** Szenen-Notiz („Tisch links“) je Szene. */
  sceneNotes: Record<string, string>;
  characterIds: string[];
  /** Kostüm: Teile in Reihenfolge; Teil: Kostüme, in denen es steckt. */
  partIds: string[];
  partOfIds: string[];
  photoId: string | null;
  photoCount: number;
  taskId: string | null;
  checklistDone: number;
  checklistTotal: number;
  checkedAt: string | null;
  inventoryLabel: string | null;
  /** Abgeleitete Frist: nächste Probe einer der Szenen. */
  nextRehearsal: string | null;
  archived: boolean;
};

export type InboxItem = {
  id: string;
  kind: ProductionObjectKind;
  text: string;
  hasPhoto: boolean;
  sceneId: string;
  sceneLabel: string;
  characterId: string | null;
  characterName: string | null;
  requestedBy: string | null;
  createdAt: string;
};

export function sceneLabel(scene: { identifier: string | null; title: string | null }) {
  return [scene.identifier, scene.title].filter(Boolean).join(" ") || "Szene";
}

export async function loadStage(showId: string): Promise<StageData> {
  const [scenes, characters] = await Promise.all([
    prisma.scene.findMany({
      where: { showId },
      select: {
        id: true,
        act: true,
        identifier: true,
        title: true,
        characters: { orderBy: { order: "asc" }, select: { characterId: true } },
      },
    }),
    prisma.character.findMany({
      where: { showId },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        color: true,
        castings: {
          where: { user: { deactivatedAt: null } },
          select: {
            type: true,
            user: {
              select: { id: true, firstName: true, lastName: true, name: true, email: true },
            },
          },
        },
      },
    }),
  ]);
  return {
    scenes: scenes
      .sort((a, b) => a.act - b.act || compareSceneIdentifiers(a.identifier, b.identifier))
      .map((scene) => ({
        id: scene.id,
        act: scene.act,
        identifier: scene.identifier,
        title: scene.title,
        characterIds: scene.characters.map((entry) => entry.characterId),
      })),
    characters: characters.map((character) => ({
      id: character.id,
      name: character.name,
      color: character.color,
      cast: [...character.castings]
        .sort((a, b) => Number(b.type === "primary") - Number(a.type === "primary"))
        .map((entry) => ({
          userId: entry.user.id,
          name: getUserDisplayName(entry.user),
          type: entry.type,
        })),
    })),
  };
}

const OBJECT_SELECT = {
  id: true,
  kind: true,
  title: true,
  description: true,
  status: true,
  source: true,
  costCents: true,
  dimensions: true,
  checkedAt: true,
  archivedAt: true,
  scenes: { select: { sceneId: true, note: true } },
  characters: { select: { characterId: true } },
  parts: { orderBy: { position: "asc" }, select: { partId: true } },
  partOf: { select: { costumeId: true } },
  photos: { orderBy: { sortOrder: "asc" }, select: { id: true } },
  inventoryProduct: { select: { name: true } },
  inventoryAsset: { select: { code: true, product: { select: { name: true } } } },
  task: {
    select: {
      id: true,
      checklist: { select: { doneAt: true } },
    },
  },
} as const;

type ObjectRow = Awaited<
  ReturnType<typeof prisma.productionObject.findMany<{ select: typeof OBJECT_SELECT }>>
>[number];

function toListItem(row: ObjectRow, rehearsals: Map<string, Date>): ObjectListItem {
  const sceneIds = row.scenes.map((entry) => entry.sceneId);
  const next = earliestFor(sceneIds, rehearsals);
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    description: row.description,
    status: row.status,
    source: row.source,
    costCents: row.costCents,
    dimensions: row.dimensions,
    sceneIds,
    sceneNotes: Object.fromEntries(
      row.scenes.filter((entry) => entry.note).map((entry) => [entry.sceneId, entry.note ?? ""]),
    ),
    characterIds: row.characters.map((entry) => entry.characterId),
    partIds: row.parts.map((entry) => entry.partId),
    partOfIds: row.partOf.map((entry) => entry.costumeId),
    photoId: row.photos[0]?.id ?? null,
    photoCount: row.photos.length,
    taskId: row.task?.id ?? null,
    checklistDone: row.task?.checklist.filter((item) => item.doneAt).length ?? 0,
    checklistTotal: row.task?.checklist.length ?? 0,
    checkedAt: row.checkedAt?.toISOString() ?? null,
    inventoryLabel: row.inventoryAsset
      ? `${row.inventoryAsset.code} · ${row.inventoryAsset.product?.name ?? ""}`.trim()
      : (row.inventoryProduct?.name ?? null),
    nextRehearsal: next?.toISOString() ?? null,
    archived: Boolean(row.archivedAt),
  };
}

/** Alle Objekte eines Gewerks (optional nur bestimmte Arten), ohne archivierte. */
export async function loadDepartmentObjects(
  departmentId: string,
  kinds?: ProductionObjectKind[],
): Promise<ObjectListItem[]> {
  const rows = await prisma.productionObject.findMany({
    where: { departmentId, archivedAt: null, ...(kinds ? { kind: { in: kinds } } : {}) },
    orderBy: [{ title: "asc" }],
    select: OBJECT_SELECT,
  });
  const rehearsals = await nextRehearsalByScene(
    rows.flatMap((row) => row.scenes.map((entry) => entry.sceneId)),
  );
  return rows.map((row) => toListItem(row, rehearsals));
}

/** Objekte einer Produktion, z. B. alle Kostüme für den Kostümplot. */
export async function loadShowObjects(
  showId: string,
  kinds?: ProductionObjectKind[],
): Promise<(ObjectListItem & { departmentId: string })[]> {
  const rows = await prisma.productionObject.findMany({
    where: { showId, archivedAt: null, ...(kinds ? { kind: { in: kinds } } : {}) },
    orderBy: [{ title: "asc" }],
    select: { ...OBJECT_SELECT, departmentId: true },
  });
  const rehearsals = await nextRehearsalByScene(
    rows.flatMap((row) => row.scenes.map((entry) => entry.sceneId)),
  );
  return rows.map((row) => ({ ...toListItem(row, rehearsals), departmentId: row.departmentId }));
}

export type ObjectDetail = ObjectListItem & {
  showId: string;
  departmentId: string;
  departmentSlug: string;
  departmentName: string;
  material: string | null;
  note: string | null;
  inventoryProductId: string | null;
  inventoryAssetId: string | null;
  photos: { id: string; kind: string; caption: string | null }[];
  checklist: { id: string; text: string; done: boolean }[];
  requirements: {
    id: string;
    text: string;
    status: SceneRequirementStatus;
    sceneLabel: string;
    requestedBy: string | null;
    createdAt: string;
  }[];
  finance: { id: string; title: string; amount: number; status: string }[];
  createdBy: string | null;
  createdAt: string;
};

export async function loadObjectDetail(objectId: string): Promise<ObjectDetail | null> {
  const row = await prisma.productionObject.findUnique({
    where: { id: objectId },
    select: {
      ...OBJECT_SELECT,
      showId: true,
      departmentId: true,
      material: true,
      note: true,
      inventoryProductId: true,
      inventoryAssetId: true,
      createdAt: true,
      department: { select: { slug: true, name: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true, name: true, email: true } },
      photos: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, kind: true, caption: true },
      },
      task: {
        select: {
          id: true,
          checklist: {
            orderBy: [{ position: "asc" }, { id: "asc" }],
            select: { id: true, text: true, doneAt: true },
          },
        },
      },
      requirements: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          text: true,
          status: true,
          createdAt: true,
          scene: { select: { identifier: true, title: true } },
          requestedBy: {
            select: { id: true, firstName: true, lastName: true, name: true, email: true },
          },
        },
      },
      financeEntries: {
        orderBy: { bookingDate: "asc" },
        select: { id: true, title: true, amount: true, status: true },
      },
    },
  });
  if (!row) return null;
  const rehearsals = await nextRehearsalByScene(row.scenes.map((entry) => entry.sceneId));
  return {
    ...toListItem(row, rehearsals),
    showId: row.showId,
    departmentId: row.departmentId,
    departmentSlug: row.department.slug,
    departmentName: row.department.name,
    material: row.material,
    note: row.note,
    inventoryProductId: row.inventoryProductId,
    inventoryAssetId: row.inventoryAssetId,
    photos: row.photos,
    checklist:
      row.task?.checklist.map((item) => ({
        id: item.id,
        text: item.text,
        done: Boolean(item.doneAt),
      })) ?? [],
    requirements: row.requirements.map((entry) => ({
      id: entry.id,
      text: entry.text,
      status: entry.status,
      sceneLabel: sceneLabel(entry.scene),
      requestedBy: entry.requestedBy ? getUserDisplayName(entry.requestedBy) : null,
      createdAt: entry.createdAt.toISOString(),
    })),
    finance: row.financeEntries.map((entry) => ({
      id: entry.id,
      title: entry.title,
      amount: entry.amount,
      status: entry.status,
    })),
    createdBy: row.createdBy ? getUserDisplayName(row.createdBy) : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Offene Anforderungen im Eingang eines Gewerks. */
export async function loadInbox(departmentId: string): Promise<InboxItem[]> {
  const rows = await prisma.sceneRequirement.findMany({
    where: { departmentId, status: "open" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      kind: true,
      text: true,
      photoMimeType: true,
      sceneId: true,
      createdAt: true,
      scene: { select: { identifier: true, title: true } },
      character: { select: { id: true, name: true } },
      requestedBy: {
        select: { id: true, firstName: true, lastName: true, name: true, email: true },
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    text: row.text,
    hasPhoto: Boolean(row.photoMimeType),
    sceneId: row.sceneId,
    sceneLabel: sceneLabel(row.scene),
    characterId: row.character?.id ?? null,
    characterName: row.character?.name ?? null,
    requestedBy: row.requestedBy ? getUserDisplayName(row.requestedBy) : null,
    createdAt: row.createdAt.toISOString(),
  }));
}

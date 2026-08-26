"use server";

import { BreakdownStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  ensureProductionManager,
  ensureUniqueSceneSlug,
  parseCheckbox,
  parseEnumValue,
  parseOptionalDate,
  parseRedirectPath,
  readOptionalInt,
  readOptionalString,
  readString,
  revalidateShow,
  slugify,
} from "./helpers";

const sceneIdentifierPattern = /^\d+(?:\.\d+)?$/;

function ensureValidSceneIdentifier(identifier: string): void {
  if (!sceneIdentifierPattern.test(identifier)) {
    throw new Error(
      "Nummern dürfen nur Ziffern enthalten und maximal eine Unterteilung wie 1.1 besitzen.",
    );
  }
  const parts = identifier.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.some((part) => Number.isNaN(part) || part < 1)) {
    throw new Error("Nummern müssen positive Zahlen sein.");
  }
}

async function ensureUniqueSceneIdentifier(
  showId: string,
  identifier: string,
  sceneId?: string,
): Promise<void> {
  const existing = await prisma.scene.findFirst({
    where: {
      showId,
      identifier,
      ...(sceneId ? { NOT: { id: sceneId } } : {}),
    },
    select: { id: true },
  });
  if (existing) {
    throw new Error("Diese Nummer ist bereits vergeben.");
  }
}

export async function createSceneAction(formData: FormData): Promise<void> {
  const auth = await ensureProductionManager();
  if (!auth.ok) {
    throw new Error(auth.error);
  }
  const redirectPath = parseRedirectPath(formData);
  try {
    const showId = readString(formData, "showId", { label: "Produktion" });
    const show = await prisma.show.findUnique({ where: { id: showId }, select: { id: true } });
    if (!show) {
      throw new Error("Produktion wurde nicht gefunden.");
    }

    const identifier = readString(formData, "identifier", { label: "Nummer", maxLength: 40 });
    ensureValidSceneIdentifier(identifier);
    await ensureUniqueSceneIdentifier(showId, identifier);
    const title = readOptionalString(formData, "title", { label: "Titel", maxLength: 160 });
    const summary = readOptionalString(formData, "summary", {
      label: "Zusammenfassung",
      maxLength: 600,
    });
    const location = readOptionalString(formData, "location", { label: "Ort", maxLength: 120 });
    const notes = readOptionalString(formData, "notes", { label: "Notiz", maxLength: 400 });
    const baseSlugSource = identifier ?? title ?? `szene-${Date.now()}`;
    const baseSlug = slugify(baseSlugSource);
    const slug = await ensureUniqueSceneSlug(showId, baseSlug);

    await prisma.scene.create({
      data: {
        showId,
        identifier,
        title: title ?? null,
        summary: summary ?? null,
        location: location ?? null,
        notes: notes ?? null,
        slug,
      },
    });

    revalidateShow(showId, redirectPath);
  } catch (error) {
    console.error("createSceneAction", error);
    const message = error instanceof Error ? error.message : "Szene konnte nicht angelegt werden.";
    throw new Error(message);
  }
}

export async function updateSceneAction(formData: FormData): Promise<void> {
  const auth = await ensureProductionManager();
  if (!auth.ok) {
    throw new Error(auth.error);
  }
  const redirectPath = parseRedirectPath(formData);
  try {
    const sceneId = readString(formData, "sceneId", { label: "Szene" });
    const scene = await prisma.scene.findUnique({
      where: { id: sceneId },
      select: { showId: true, slug: true },
    });
    if (!scene) {
      throw new Error("Szene wurde nicht gefunden.");
    }

    const identifier = readString(formData, "identifier", { label: "Nummer", maxLength: 40 });
    ensureValidSceneIdentifier(identifier);
    await ensureUniqueSceneIdentifier(scene.showId, identifier, sceneId);
    const title = readOptionalString(formData, "title", { label: "Titel", maxLength: 160 });
    const summary = readOptionalString(formData, "summary", {
      label: "Zusammenfassung",
      maxLength: 600,
    });
    const location = readOptionalString(formData, "location", { label: "Ort", maxLength: 120 });
    const notes = readOptionalString(formData, "notes", { label: "Notiz", maxLength: 400 });
    await prisma.scene.update({
      where: { id: sceneId },
      data: {
        identifier,
        title: title ?? null,
        summary: summary ?? null,
        location: location ?? null,
        notes: notes ?? null,
        slug: scene.slug,
      },
    });

    revalidateShow(scene.showId, redirectPath);
  } catch (error) {
    console.error("updateSceneAction", error);
    const message =
      error instanceof Error ? error.message : "Szene konnte nicht aktualisiert werden.";
    throw new Error(message);
  }
}

export async function deleteSceneAction(formData: FormData): Promise<void> {
  const auth = await ensureProductionManager();
  if (!auth.ok) {
    throw new Error(auth.error);
  }
  const redirectPath = parseRedirectPath(formData);
  try {
    const sceneId = readString(formData, "sceneId", { label: "Szene" });
    const scene = await prisma.scene.findUnique({
      where: { id: sceneId },
      select: { showId: true },
    });
    if (!scene) {
      throw new Error("Szene wurde nicht gefunden.");
    }

    await prisma.scene.delete({ where: { id: sceneId } });
    revalidateShow(scene.showId, redirectPath);
  } catch (error) {
    console.error("deleteSceneAction", error);
    const message = error instanceof Error ? error.message : "Szene konnte nicht entfernt werden.";
    throw new Error(message);
  }
}

export async function addSceneCharacterAction(formData: FormData): Promise<void> {
  const auth = await ensureProductionManager();
  if (!auth.ok) {
    throw new Error(auth.error);
  }
  const redirectPath = parseRedirectPath(formData);
  try {
    const sceneId = readString(formData, "sceneId", { label: "Szene" });
    const characterId = readString(formData, "characterId", { label: "Rolle" });

    const [scene, character] = await Promise.all([
      prisma.scene.findUnique({ where: { id: sceneId }, select: { showId: true } }),
      prisma.character.findUnique({ where: { id: characterId }, select: { showId: true } }),
    ]);
    if (!scene) {
      throw new Error("Szene wurde nicht gefunden.");
    }
    if (!character) {
      throw new Error("Rolle wurde nicht gefunden.");
    }
    if (scene.showId !== character.showId) {
      throw new Error("Die Figur gehört nicht zur ausgewählten Produktion.");
    }

    const orderValue = readOptionalInt(formData, "order", {
      label: "Sortierung",
      min: 0,
      max: 9999,
    });
    const isFeatured = parseCheckbox(formData.get("isFeatured"));

    await prisma.sceneCharacter.upsert({
      where: { sceneId_characterId: { sceneId, characterId } },
      update: {
        order: orderValue ?? 0,
        isFeatured,
      },
      create: {
        sceneId,
        characterId,
        order: orderValue ?? 0,
        isFeatured,
      },
    });

    revalidateShow(scene.showId, redirectPath);
  } catch (error) {
    console.error("addSceneCharacterAction", error);
    const message =
      error instanceof Error ? error.message : "Figur konnte nicht hinzugefügt werden.";
    throw new Error(message);
  }
}

export async function removeSceneCharacterAction(formData: FormData): Promise<void> {
  const auth = await ensureProductionManager();
  if (!auth.ok) {
    throw new Error(auth.error);
  }
  const redirectPath = parseRedirectPath(formData);
  try {
    const assignmentId = readString(formData, "assignmentId", { label: "Zuordnung" });
    const assignment = await prisma.sceneCharacter.findUnique({
      where: { id: assignmentId },
      select: { scene: { select: { showId: true } } },
    });
    if (!assignment) {
      throw new Error("Zuordnung wurde nicht gefunden.");
    }

    await prisma.sceneCharacter.delete({ where: { id: assignmentId } });
    revalidateShow(assignment.scene.showId, redirectPath);
  } catch (error) {
    console.error("removeSceneCharacterAction", error);
    const message =
      error instanceof Error ? error.message : "Zuordnung konnte nicht entfernt werden.";
    throw new Error(message);
  }
}

export async function createBreakdownItemAction(formData: FormData): Promise<void> {
  const auth = await ensureProductionManager();
  if (!auth.ok) {
    throw new Error(auth.error);
  }
  const redirectPath = parseRedirectPath(formData);
  try {
    const sceneId = readString(formData, "sceneId", { label: "Szene" });
    const departmentId = readString(formData, "departmentId", { label: "Gewerk" });
    const title = readString(formData, "title", { label: "Titel", minLength: 2, maxLength: 160 });
    const description = readOptionalString(formData, "description", {
      label: "Beschreibung",
      maxLength: 600,
    });
    const note = readOptionalString(formData, "note", { label: "Notiz", maxLength: 300 });
    const status =
      parseEnumValue(BreakdownStatus, formData.get("status"), "Status", { optional: true }) ??
      BreakdownStatus.planned;
    const neededBy = parseOptionalDate(formData, "neededBy", "Benötigt bis");
    const assignedToId = readOptionalString(formData, "assignedToId", { label: "Zuständig" });

    const scene = await prisma.scene.findUnique({
      where: { id: sceneId },
      select: { showId: true },
    });
    if (!scene) {
      throw new Error("Szene wurde nicht gefunden.");
    }
    const department = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) {
      throw new Error("Gewerk wurde nicht gefunden.");
    }

    await prisma.sceneBreakdownItem.create({
      data: {
        sceneId,
        departmentId,
        title,
        description: description ?? null,
        status,
        neededBy: neededBy ?? null,
        note: note ?? null,
        assignedToId: assignedToId ?? null,
      },
    });

    revalidateShow(scene.showId, redirectPath);
  } catch (error) {
    console.error("createBreakdownItemAction", error);
    const message =
      error instanceof Error ? error.message : "Breakdown-Eintrag konnte nicht erstellt werden.";
    throw new Error(message);
  }
}

export async function updateBreakdownItemAction(formData: FormData): Promise<void> {
  const auth = await ensureProductionManager();
  if (!auth.ok) {
    throw new Error(auth.error);
  }
  const redirectPath = parseRedirectPath(formData);
  try {
    const itemId = readString(formData, "itemId", { label: "Breakdown" });
    const item = await prisma.sceneBreakdownItem.findUnique({
      where: { id: itemId },
      select: { scene: { select: { showId: true } } },
    });
    if (!item) {
      throw new Error("Breakdown-Eintrag wurde nicht gefunden.");
    }

    const title = readString(formData, "title", { label: "Titel", minLength: 2, maxLength: 160 });
    const description = readOptionalString(formData, "description", {
      label: "Beschreibung",
      maxLength: 600,
    });
    const note = readOptionalString(formData, "note", { label: "Notiz", maxLength: 300 });
    const status =
      parseEnumValue(BreakdownStatus, formData.get("status"), "Status", { optional: true }) ??
      BreakdownStatus.planned;
    const neededBy = parseOptionalDate(formData, "neededBy", "Benötigt bis");
    const assignedToId = readOptionalString(formData, "assignedToId", { label: "Zuständig" });

    await prisma.sceneBreakdownItem.update({
      where: { id: itemId },
      data: {
        title,
        description: description ?? null,
        status,
        neededBy: neededBy ?? null,
        note: note ?? null,
        assignedToId: assignedToId ?? null,
      },
    });

    revalidateShow(item.scene.showId, redirectPath);
  } catch (error) {
    console.error("updateBreakdownItemAction", error);
    const message =
      error instanceof Error
        ? error.message
        : "Breakdown-Eintrag konnte nicht aktualisiert werden.";
    throw new Error(message);
  }
}

export async function removeBreakdownItemAction(formData: FormData): Promise<void> {
  const auth = await ensureProductionManager();
  if (!auth.ok) {
    throw new Error(auth.error);
  }
  const redirectPath = parseRedirectPath(formData);
  try {
    const itemId = readString(formData, "itemId", { label: "Breakdown" });
    const item = await prisma.sceneBreakdownItem.findUnique({
      where: { id: itemId },
      select: { scene: { select: { showId: true } } },
    });
    if (!item) {
      throw new Error("Breakdown-Eintrag wurde nicht gefunden.");
    }

    await prisma.sceneBreakdownItem.delete({ where: { id: itemId } });
    revalidateShow(item.scene.showId, redirectPath);
  } catch (error) {
    console.error("removeBreakdownItemAction", error);
    const message =
      error instanceof Error ? error.message : "Breakdown-Eintrag konnte nicht entfernt werden.";
    throw new Error(message);
  }
}

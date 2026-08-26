"use server";

import { CharacterCastingType, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  ensureProductionManager,
  parseColor,
  parseEnumValue,
  parseRedirectPath,
  readOptionalRolePreferenceCode,
  readOptionalString,
  readString,
  requireProductionManager,
  revalidateShow,
} from "./helpers";

export async function createCharacterAction(formData: FormData): Promise<void> {
  await requireProductionManager();
  const redirectPath = parseRedirectPath(formData);
  try {
    const showId = readString(formData, "showId", { label: "Produktion" });
    const show = await prisma.show.findUnique({ where: { id: showId }, select: { id: true } });
    if (!show) throw new Error("Produktion wurde nicht gefunden.");

    const name = readString(formData, "name", { label: "Name", minLength: 2, maxLength: 120 });
    const rolePreferenceCode = readOptionalRolePreferenceCode(formData, "rolePreferenceCode", {
      label: "Rollengröße",
    });
    const description = readOptionalString(formData, "description", {
      label: "Beschreibung",
      maxLength: 500,
    });
    const notes = readOptionalString(formData, "notes", { label: "Notiz", maxLength: 500 });
    const color = parseColor(
      readOptionalString(formData, "color", { label: "Farbe", maxLength: 20 }),
    );
    const castingUserId = readOptionalString(formData, "castingUserId", { label: "Schauspieler" });
    const castingType =
      parseEnumValue(CharacterCastingType, formData.get("castingType"), "Besetzungsart", {
        optional: true,
      }) ?? CharacterCastingType.primary;
    const castingNotes = readOptionalString(formData, "castingNotes", {
      label: "Notiz",
      maxLength: 200,
    });

    const character = await prisma.character.create({
      data: {
        showId,
        name,
        rolePreferenceCode: rolePreferenceCode ?? null,
        description: description ?? null,
        notes: notes ?? null,
        color: color ?? null,
      },
    });

    if (castingUserId) {
      const user = await prisma.user.findUnique({
        where: { id: castingUserId },
        select: { id: true },
      });
      if (!user) {
        throw new Error("Mitglied wurde nicht gefunden.");
      }

      await prisma.characterCasting.create({
        data: {
          characterId: character.id,
          userId: castingUserId,
          type: castingType,
          notes: castingNotes ?? null,
        },
      });
    }

    revalidateShow(showId, redirectPath);
  } catch (error) {
    console.error("createCharacterAction", error);
    const message = error instanceof Error ? error.message : "Rolle konnte nicht angelegt werden.";
    throw new Error(message);
  }
}

export async function updateCharacterAction(formData: FormData): Promise<void> {
  await requireProductionManager();
  const redirectPath = parseRedirectPath(formData);
  try {
    const characterId = readString(formData, "characterId", { label: "Rolle" });
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      select: { showId: true },
    });
    if (!character) throw new Error("Rolle wurde nicht gefunden.");

    const name = readString(formData, "name", { label: "Name", minLength: 2, maxLength: 120 });
    const rolePreferenceCode = readOptionalRolePreferenceCode(formData, "rolePreferenceCode", {
      label: "Rollengröße",
    });
    const description = readOptionalString(formData, "description", {
      label: "Beschreibung",
      maxLength: 500,
    });
    const notes = readOptionalString(formData, "notes", { label: "Notiz", maxLength: 500 });
    const color = parseColor(
      readOptionalString(formData, "color", { label: "Farbe", maxLength: 20 }),
    );

    await prisma.character.update({
      where: { id: characterId },
      data: {
        name,
        rolePreferenceCode: rolePreferenceCode ?? null,
        description: description ?? null,
        notes: notes ?? null,
        color: color ?? null,
      },
    });

    revalidateShow(character.showId, redirectPath);
  } catch (error) {
    console.error("updateCharacterAction", error);
    const message =
      error instanceof Error ? error.message : "Rolle konnte nicht aktualisiert werden.";
    throw new Error(message);
  }
}

export async function deleteCharacterAction(formData: FormData): Promise<void> {
  await requireProductionManager();
  const redirectPath = parseRedirectPath(formData);
  try {
    const characterId = readString(formData, "characterId", { label: "Rolle" });
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      select: { showId: true },
    });
    if (!character) throw new Error("Rolle wurde nicht gefunden.");

    await prisma.character.delete({ where: { id: characterId } });
    revalidateShow(character.showId, redirectPath);
  } catch (error) {
    console.error("deleteCharacterAction", error);
    const message = error instanceof Error ? error.message : "Rolle konnte nicht entfernt werden.";
    throw new Error(message);
  }
}

export async function assignCharacterCastingAction(formData: FormData): Promise<void> {
  const auth = await ensureProductionManager();
  if (!auth.ok) {
    throw new Error(auth.error);
  }
  const redirectPath = parseRedirectPath(formData);
  try {
    const characterId = readString(formData, "characterId", { label: "Rolle" });
    const userId = readString(formData, "userId", { label: "Mitglied" });
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      select: { showId: true },
    });
    if (!character) {
      throw new Error("Rolle wurde nicht gefunden.");
    }
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) {
      throw new Error("Mitglied wurde nicht gefunden.");
    }

    const type =
      parseEnumValue(CharacterCastingType, formData.get("type"), "Besetzungsart", {
        optional: true,
      }) ?? CharacterCastingType.primary;
    const notes = readOptionalString(formData, "notes", { label: "Notiz", maxLength: 200 });

    await prisma.characterCasting.upsert({
      where: {
        characterId_userId_type: {
          characterId,
          userId,
          type,
        },
      },
      update: { notes: notes ?? null },
      create: {
        characterId,
        userId,
        type,
        notes: notes ?? null,
      },
    });

    revalidateShow(character.showId, redirectPath);
  } catch (error) {
    console.error("assignCharacterCastingAction", error);
    const message =
      error instanceof Error ? error.message : "Besetzung konnte nicht gespeichert werden.";
    throw new Error(message);
  }
}

export async function updateCharacterCastingAction(formData: FormData): Promise<void> {
  const auth = await ensureProductionManager();
  if (!auth.ok) {
    throw new Error(auth.error);
  }
  const redirectPath = parseRedirectPath(formData);
  try {
    const castingId = readString(formData, "castingId", { label: "Besetzung" });
    const casting = await prisma.characterCasting.findUnique({
      where: { id: castingId },
      select: {
        id: true,
        type: true,
        character: { select: { showId: true } },
      },
    });
    if (!casting) {
      throw new Error("Besetzung wurde nicht gefunden.");
    }

    const type =
      parseEnumValue(CharacterCastingType, formData.get("type"), "Besetzungsart", {
        optional: true,
      }) ?? casting.type;
    const notes = readOptionalString(formData, "notes", { label: "Notiz", maxLength: 200 });

    try {
      await prisma.characterCasting.update({
        where: { id: castingId },
        data: {
          type,
          notes: notes ?? null,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new Error("Diese Besetzung existiert bereits in der gewählten Besetzungsart.");
      }
      throw error;
    }

    revalidateShow(casting.character.showId, redirectPath);
  } catch (error) {
    console.error("updateCharacterCastingAction", error);
    const message =
      error instanceof Error ? error.message : "Besetzung konnte nicht aktualisiert werden.";
    throw new Error(message);
  }
}

export async function removeCharacterCastingAction(formData: FormData): Promise<void> {
  const auth = await ensureProductionManager();
  if (!auth.ok) {
    throw new Error(auth.error);
  }
  const redirectPath = parseRedirectPath(formData);
  try {
    const castingId = readString(formData, "castingId", { label: "Besetzung" });
    const casting = await prisma.characterCasting.findUnique({
      where: { id: castingId },
      select: { character: { select: { showId: true } } },
    });
    if (!casting) {
      throw new Error("Besetzung wurde nicht gefunden.");
    }

    await prisma.characterCasting.delete({ where: { id: castingId } });
    revalidateShow(casting.character.showId, redirectPath);
  } catch (error) {
    console.error("removeCharacterCastingAction", error);
    const message =
      error instanceof Error ? error.message : "Besetzung konnte nicht entfernt werden.";
    throw new Error(message);
  }
}

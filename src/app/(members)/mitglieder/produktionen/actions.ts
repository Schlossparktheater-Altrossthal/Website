"use server";

import { revalidatePath } from "next/cache";
import {
  Prisma,
  DepartmentMembershipRole,
  CharacterCastingType,
  BreakdownStatus,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";

type ActionResult = { success: true } | { error: string };

type ReadOptions = {
  minLength?: number;
  maxLength?: number;
  label?: string;
};

function isString(value: FormDataEntryValue | null | undefined): value is string {
  return typeof value === "string";
}

function readOptionalString(formData: FormData, key: string, options?: ReadOptions): string | undefined {
  const raw = formData.get(key);
  if (!isString(raw)) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (options?.minLength && trimmed.length < options.minLength) {
    throw new Error(
      `${options?.label ?? key} muss mindestens ${options.minLength} Zeichen enthalten.`,
    );
  }
  if (options?.maxLength && trimmed.length > options.maxLength) {
    throw new Error(
      `${options?.label ?? key} darf höchstens ${options.maxLength} Zeichen enthalten.`,
    );
  }
  return trimmed;
}

function readString(formData: FormData, key: string, options?: ReadOptions): string {
  const value = readOptionalString(formData, key, options);
  if (value === undefined) {
    throw new Error(`${options?.label ?? key} ist erforderlich.`);
  }
  return value;
}

function readOptionalInt(
  formData: FormData,
  key: string,
  options?: { label?: string; min?: number; max?: number },
): number | undefined {
  const raw = readOptionalString(formData, key, { label: options?.label });
  if (raw === undefined) return undefined;
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value)) {
    throw new Error(`${options?.label ?? key} muss eine Zahl sein.`);
  }
  if (options?.min !== undefined && value < options.min) {
    throw new Error(`${options?.label ?? key} muss mindestens ${options.min} sein.`);
  }
  if (options?.max !== undefined && value > options.max) {
    throw new Error(`${options?.label ?? key} darf höchstens ${options.max} sein.`);
  }
  return value;
}

function parseEnumValue<T extends Record<string, string>>(
  enumeration: T,
  raw: FormDataEntryValue | null | undefined,
  label: string,
  options?: { optional?: boolean },
): T[keyof T] | undefined {
  if (!isString(raw) || !raw.trim()) {
    if (options?.optional) return undefined;
    throw new Error(`${label} ist erforderlich.`);
  }
  const normalized = raw.trim();
  const values = Object.values(enumeration) as string[];
  if (!values.includes(normalized)) {
    throw new Error(`${label} ist ungültig.`);
  }
  return normalized as T[keyof T];
}

function parseCheckbox(value: FormDataEntryValue | null | undefined) {
  if (!isString(value)) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "on" || normalized === "true" || normalized === "1";
}

function parseColor(raw?: string) {
  if (!raw) return undefined;
  const value = raw.trim();
  if (!value) return undefined;
  if (!/^#(?:[0-9a-fA-F]{6})$/.test(value)) {
    throw new Error("Farbwert muss im Format #RRGGBB angegeben werden.");
  }
  return value.toLowerCase();
}

function parseOptionalDate(formData: FormData, key: string, label: string) {
  const raw = readOptionalString(formData, key, { label });
  if (!raw) return undefined;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} enthält kein gültiges Datum.`);
  }
  return date;
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-")
    .slice(0, 60);
}

async function ensureUniqueDepartmentSlug(base: string, excludeId?: string) {
  const normalized = base || `gewerk-${Math.random().toString(36).slice(2, 8)}`;
  let candidate = normalized;
  let counter = 2;
  while (true) {
    const existing = await prisma.department.findFirst({
      where: {
        slug: candidate,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${normalized}-${counter++}`;
  }
}

async function ensureUniqueSceneSlug(showId: string, base: string, excludeId?: string) {
  const normalized = base || `scene-${Math.random().toString(36).slice(2, 8)}`;
  let candidate = normalized;
  let counter = 2;
  while (true) {
    const existing = await prisma.scene.findFirst({
      where: {
        showId,
        slug: candidate,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${normalized}-${counter++}`;
  }
}

function parseRedirectPath(formData: FormData) {
  const raw = formData.get("redirectPath");
  if (!isString(raw)) return undefined;
  const trimmed = raw.trim();
  if (!trimmed || !trimmed.startsWith("/")) return undefined;
  return trimmed;
}

async function ensureProductionManager() {
  const session = await requireAuth();
  const userId = session.user?.id;
  if (!userId) {
    return { ok: false as const, error: "Keine Berechtigung." };
  }
  const allowed = await hasPermission(session.user, "mitglieder.produktionen");
  if (!allowed) {
    return { ok: false as const, error: "Keine Berechtigung." };
  }
  return { ok: true as const, userId };
}

function revalidateDepartments(redirectPath?: string) {
  revalidatePath("/mitglieder/produktionen");
  if (redirectPath && redirectPath !== "/mitglieder/produktionen") {
    revalidatePath(redirectPath);
  }
}

function revalidateShow(showId: string, redirectPath?: string, includeList = false) {
  const target = `/mitglieder/produktionen/${showId}`;
  if (includeList) {
    revalidatePath("/mitglieder/produktionen");
  }
  revalidatePath(target);
  if (redirectPath && redirectPath !== target && redirectPath !== "/mitglieder/produktionen") {
    revalidatePath(redirectPath);
  }
}

export async function createDepartmentAction(formData: FormData): Promise<ActionResult> {
  const auth = await ensureProductionManager();
  if (!auth.ok) return { error: auth.error };
  const redirectPath = parseRedirectPath(formData);
  try {
    const name = readString(formData, "name", { label: "Name", minLength: 2, maxLength: 80 });
    const slugInput = readOptionalString(formData, "slug", { label: "Slug", maxLength: 80 });
    if (slugInput && !/^[a-z0-9-]+$/i.test(slugInput)) {
      throw new Error("Slug darf nur Buchstaben, Zahlen und Bindestriche enthalten.");
    }
    const description = readOptionalString(formData, "description", { label: "Beschreibung", maxLength: 2000 });
    const color = parseColor(readOptionalString(formData, "color", { label: "Farbe", maxLength: 20 }));
    const baseSlug = slugify(slugInput ?? name);
    const slug = await ensureUniqueDepartmentSlug(baseSlug);

    await prisma.department.create({
      data: {
        name,
        slug,
        description: description ?? null,
        color: color ?? null,
      },
    });

    revalidateDepartments(redirectPath);
    return { success: true };
  } catch (error) {
    console.error("createDepartmentAction", error);
    return {
      error: error instanceof Error ? error.message : "Gewerk konnte nicht angelegt werden.",
    };
  }
}

export async function updateDepartmentAction(formData: FormData): Promise<ActionResult> {
  const auth = await ensureProductionManager();
  if (!auth.ok) return { error: auth.error };
  const redirectPath = parseRedirectPath(formData);
  try {
    const id = readString(formData, "id", { label: "Gewerk" });
    const department = await prisma.department.findUnique({ where: { id } });
    if (!department) {
      return { error: "Gewerk wurde nicht gefunden." };
    }
    const name = readString(formData, "name", { label: "Name", minLength: 2, maxLength: 80 });
    const slugInput = readOptionalString(formData, "slug", { label: "Slug", maxLength: 80 });
    if (slugInput && !/^[a-z0-9-]+$/i.test(slugInput)) {
      throw new Error("Slug darf nur Buchstaben, Zahlen und Bindestriche enthalten.");
    }
    const description = readOptionalString(formData, "description", { label: "Beschreibung", maxLength: 2000 });
    const color = parseColor(readOptionalString(formData, "color", { label: "Farbe", maxLength: 20 }));

    let slug = department.slug;
    if (slugInput) {
      const baseSlug = slugify(slugInput);
      slug = await ensureUniqueDepartmentSlug(baseSlug, department.id);
    }

    await prisma.department.update({
      where: { id },
      data: {
        name,
        slug,
        description: description ?? null,
        color: color ?? null,
      },
    });

    revalidateDepartments(redirectPath);
    return { success: true };
  } catch (error) {
    console.error("updateDepartmentAction", error);
    return {
      error: error instanceof Error ? error.message : "Gewerk konnte nicht aktualisiert werden.",
    };
  }
}

export async function deleteDepartmentAction(formData: FormData): Promise<ActionResult> {
  const auth = await ensureProductionManager();
  if (!auth.ok) return { error: auth.error };
  const redirectPath = parseRedirectPath(formData);
  try {
    const id = readString(formData, "id", { label: "Gewerk" });
    await prisma.department.delete({ where: { id } });
    revalidateDepartments(redirectPath);
    return { success: true };
  } catch (error) {
    console.error("deleteDepartmentAction", error);
    return {
      error: error instanceof Error
        ? error.message
        : "Gewerk konnte nicht gelöscht werden (ggf. bereits verwendet).",
    };
  }
}

export async function addDepartmentMemberAction(formData: FormData): Promise<ActionResult> {
  const auth = await ensureProductionManager();
  if (!auth.ok) return { error: auth.error };
  const redirectPath = parseRedirectPath(formData);
  try {
    const departmentId = readString(formData, "departmentId", { label: "Gewerk" });
    const userId = readString(formData, "userId", { label: "Mitglied" });
    const role =
      parseEnumValue(DepartmentMembershipRole, formData.get("role"), "Funktion", { optional: true }) ??
      DepartmentMembershipRole.member;
    const titleValue = readOptionalString(formData, "title", { label: "Bezeichnung", maxLength: 120 });
    const noteValue = readOptionalString(formData, "note", { label: "Notiz", maxLength: 200 });

    const [department, user] = await Promise.all([
      prisma.department.findUnique({ where: { id: departmentId } }),
      prisma.user.findUnique({ where: { id: userId } }),
    ]);
    if (!department) return { error: "Gewerk wurde nicht gefunden." };
    if (!user) return { error: "Mitglied wurde nicht gefunden." };

    await prisma.departmentMembership.upsert({
      where: { departmentId_userId: { departmentId, userId } },
      update: {
        role,
        title: titleValue ?? null,
        note: noteValue ?? null,
      },
      create: {
        departmentId,
        userId,
        role,
        title: titleValue ?? null,
        note: noteValue ?? null,
      },
    });

    revalidateDepartments(redirectPath);
    return { success: true };
  } catch (error) {
    console.error("addDepartmentMemberAction", error);
    return {
      error: error instanceof Error ? error.message : "Mitglied konnte nicht hinzugefügt werden.",
    };
  }
}

export async function updateDepartmentMemberAction(formData: FormData): Promise<ActionResult> {
  const auth = await ensureProductionManager();
  if (!auth.ok) return { error: auth.error };
  const redirectPath = parseRedirectPath(formData);
  try {
    const membershipId = readString(formData, "membershipId", { label: "Mitgliedschaft" });
    const membership = await prisma.departmentMembership.findUnique({
      where: { id: membershipId },
    });
    if (!membership) {
      return { error: "Mitgliedschaft wurde nicht gefunden." };
    }

    const role =
      parseEnumValue(DepartmentMembershipRole, formData.get("role"), "Funktion", { optional: true }) ??
      membership.role;
    const titleValue = readOptionalString(formData, "title", { label: "Bezeichnung", maxLength: 120 });
    const noteValue = readOptionalString(formData, "note", { label: "Notiz", maxLength: 200 });

    await prisma.departmentMembership.update({
      where: { id: membershipId },
      data: {
        role,
        title: titleValue ?? null,
        note: noteValue ?? null,
      },
    });

    revalidateDepartments(redirectPath);
    return { success: true };
  } catch (error) {
    console.error("updateDepartmentMemberAction", error);
    return {
      error: error instanceof Error ? error.message : "Mitglied konnte nicht aktualisiert werden.",
    };
  }
}

export async function removeDepartmentMemberAction(formData: FormData): Promise<ActionResult> {
  const auth = await ensureProductionManager();
  if (!auth.ok) return { error: auth.error };
  const redirectPath = parseRedirectPath(formData);
  try {
    const membershipId = readString(formData, "membershipId", { label: "Mitgliedschaft" });
    await prisma.departmentMembership.delete({ where: { id: membershipId } });
    revalidateDepartments(redirectPath);
    return { success: true };
  } catch (error) {
    console.error("removeDepartmentMemberAction", error);
    return {
      error: error instanceof Error ? error.message : "Mitglied konnte nicht entfernt werden.",
    };
  }
}

export async function createCharacterAction(formData: FormData): Promise<ActionResult> {
  const auth = await ensureProductionManager();
  if (!auth.ok) return { error: auth.error };
  const redirectPath = parseRedirectPath(formData);
  try {
    const showId = readString(formData, "showId", { label: "Produktion" });
    const show = await prisma.show.findUnique({ where: { id: showId }, select: { id: true } });
    if (!show) return { error: "Produktion wurde nicht gefunden." };

    const name = readString(formData, "name", { label: "Name", minLength: 2, maxLength: 120 });
    const shortName = readOptionalString(formData, "shortName", { label: "Kurzname", maxLength: 40 });
    const description = readOptionalString(formData, "description", { label: "Beschreibung", maxLength: 500 });
    const notes = readOptionalString(formData, "notes", { label: "Notiz", maxLength: 500 });
    const color = parseColor(readOptionalString(formData, "color", { label: "Farbe", maxLength: 20 }));
    const orderValue = readOptionalInt(formData, "order", { label: "Sortierung", min: 0, max: 9999 });
    const order =
      orderValue ?? (await prisma.character.count({ where: { showId } })) ?? 0;

    await prisma.character.create({
      data: {
        showId,
        name,
        shortName: shortName ?? null,
        description: description ?? null,
        notes: notes ?? null,
        color: color ?? null,
        order,
      },
    });

    revalidateShow(showId, redirectPath);
    return { success: true };
  } catch (error) {
    console.error("createCharacterAction", error);
    return {
      error: error instanceof Error ? error.message : "Rolle konnte nicht angelegt werden.",
    };
  }
}

export async function updateCharacterAction(formData: FormData): Promise<ActionResult> {
  const auth = await ensureProductionManager();
  if (!auth.ok) return { error: auth.error };
  const redirectPath = parseRedirectPath(formData);
  try {
    const characterId = readString(formData, "characterId", { label: "Rolle" });
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      select: { showId: true },
    });
    if (!character) return { error: "Rolle wurde nicht gefunden." };

    const name = readString(formData, "name", { label: "Name", minLength: 2, maxLength: 120 });
    const shortName = readOptionalString(formData, "shortName", { label: "Kurzname", maxLength: 40 });
    const description = readOptionalString(formData, "description", { label: "Beschreibung", maxLength: 500 });
    const notes = readOptionalString(formData, "notes", { label: "Notiz", maxLength: 500 });
    const color = parseColor(readOptionalString(formData, "color", { label: "Farbe", maxLength: 20 }));
    const orderValue = readOptionalInt(formData, "order", { label: "Sortierung", min: 0, max: 9999 });

    await prisma.character.update({
      where: { id: characterId },
      data: {
        name,
        shortName: shortName ?? null,
        description: description ?? null,
        notes: notes ?? null,
        color: color ?? null,
        ...(orderValue !== undefined ? { order: orderValue } : {}),
      },
    });

    revalidateShow(character.showId, redirectPath);
    return { success: true };
  } catch (error) {
    console.error("updateCharacterAction", error);
    return {
      error: error instanceof Error ? error.message : "Rolle konnte nicht aktualisiert werden.",
    };
  }
}

export async function deleteCharacterAction(formData: FormData): Promise<ActionResult> {
  const auth = await ensureProductionManager();
  if (!auth.ok) return { error: auth.error };
  const redirectPath = parseRedirectPath(formData);
  try {
    const characterId = readString(formData, "characterId", { label: "Rolle" });
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      select: { showId: true },
    });
    if (!character) return { error: "Rolle wurde nicht gefunden." };

    await prisma.character.delete({ where: { id: characterId } });
    revalidateShow(character.showId, redirectPath);
    return { success: true };
  } catch (error) {
    console.error("deleteCharacterAction", error);
    return {
      error: error instanceof Error ? error.message : "Rolle konnte nicht entfernt werden.",
    };
  }
}

export async function assignCharacterCastingAction(formData: FormData): Promise<ActionResult> {
  const auth = await ensureProductionManager();
  if (!auth.ok) return { error: auth.error };
  const redirectPath = parseRedirectPath(formData);
  try {
    const characterId = readString(formData, "characterId", { label: "Rolle" });
    const userId = readString(formData, "userId", { label: "Mitglied" });
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      select: { showId: true },
    });
    if (!character) return { error: "Rolle wurde nicht gefunden." };
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return { error: "Mitglied wurde nicht gefunden." };

    const type =
      parseEnumValue(CharacterCastingType, formData.get("type"), "Besetzungsart", { optional: true }) ??
      CharacterCastingType.primary;
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
    return { success: true };
  } catch (error) {
    console.error("assignCharacterCastingAction", error);
    return {
      error: error instanceof Error ? error.message : "Besetzung konnte nicht gespeichert werden.",
    };
  }
}

export async function updateCharacterCastingAction(formData: FormData): Promise<ActionResult> {
  const auth = await ensureProductionManager();
  if (!auth.ok) return { error: auth.error };
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
    if (!casting) return { error: "Besetzung wurde nicht gefunden." };

    const type =
      parseEnumValue(CharacterCastingType, formData.get("type"), "Besetzungsart", { optional: true }) ??
      casting.type;
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
        return {
          error: "Diese Besetzung existiert bereits in der gewählten Besetzungsart.",
        };
      }
      throw error;
    }

    revalidateShow(casting.character.showId, redirectPath);
    return { success: true };
  } catch (error) {
    console.error("updateCharacterCastingAction", error);
    return {
      error: error instanceof Error ? error.message : "Besetzung konnte nicht aktualisiert werden.",
    };
  }
}

export async function removeCharacterCastingAction(formData: FormData): Promise<ActionResult> {
  const auth = await ensureProductionManager();
  if (!auth.ok) return { error: auth.error };
  const redirectPath = parseRedirectPath(formData);
  try {
    const castingId = readString(formData, "castingId", { label: "Besetzung" });
    const casting = await prisma.characterCasting.findUnique({
      where: { id: castingId },
      select: { character: { select: { showId: true } } },
    });
    if (!casting) return { error: "Besetzung wurde nicht gefunden." };

    await prisma.characterCasting.delete({ where: { id: castingId } });
    revalidateShow(casting.character.showId, redirectPath);
    return { success: true };
  } catch (error) {
    console.error("removeCharacterCastingAction", error);
    return {
      error: error instanceof Error ? error.message : "Besetzung konnte nicht entfernt werden.",
    };
  }
}

export async function createSceneAction(formData: FormData): Promise<ActionResult> {
  const auth = await ensureProductionManager();
  if (!auth.ok) return { error: auth.error };
  const redirectPath = parseRedirectPath(formData);
  try {
    const showId = readString(formData, "showId", { label: "Produktion" });
    const show = await prisma.show.findUnique({ where: { id: showId }, select: { id: true } });
    if (!show) return { error: "Produktion wurde nicht gefunden." };

    const identifier = readOptionalString(formData, "identifier", { label: "Nummer", maxLength: 40 });
    const title = readOptionalString(formData, "title", { label: "Titel", maxLength: 160 });
    const summary = readOptionalString(formData, "summary", { label: "Zusammenfassung", maxLength: 600 });
    const location = readOptionalString(formData, "location", { label: "Ort", maxLength: 120 });
    const timeOfDay = readOptionalString(formData, "timeOfDay", { label: "Tageszeit", maxLength: 60 });
    const notes = readOptionalString(formData, "notes", { label: "Notiz", maxLength: 400 });
    const sequenceValue = readOptionalInt(formData, "sequence", { label: "Reihenfolge", min: 0, max: 9999 });
    const duration = readOptionalInt(formData, "duration", { label: "Dauer", min: 0, max: 600 });
    const slugInput = readOptionalString(formData, "slug", { label: "Slug", maxLength: 80 });
    if (slugInput && !/^[a-z0-9-]+$/i.test(slugInput)) {
      throw new Error("Slug darf nur Buchstaben, Zahlen und Bindestriche enthalten.");
    }

    const baseSlugSource = slugInput ?? identifier ?? title ?? `szene-${Date.now()}`;
    const baseSlug = slugify(baseSlugSource);
    const slug = await ensureUniqueSceneSlug(showId, baseSlug);
    const sequence =
      sequenceValue ?? (await prisma.scene.count({ where: { showId } })) ?? 0;

    await prisma.scene.create({
      data: {
        showId,
        identifier: identifier ?? null,
        title: title ?? null,
        summary: summary ?? null,
        location: location ?? null,
        timeOfDay: timeOfDay ?? null,
        notes: notes ?? null,
        sequence,
        durationMinutes: duration ?? null,
        slug,
      },
    });

    revalidateShow(showId, redirectPath);
    return { success: true };
  } catch (error) {
    console.error("createSceneAction", error);
    return {
      error: error instanceof Error ? error.message : "Szene konnte nicht angelegt werden.",
    };
  }
}

export async function updateSceneAction(formData: FormData): Promise<ActionResult> {
  const auth = await ensureProductionManager();
  if (!auth.ok) return { error: auth.error };
  const redirectPath = parseRedirectPath(formData);
  try {
    const sceneId = readString(formData, "sceneId", { label: "Szene" });
    const scene = await prisma.scene.findUnique({
      where: { id: sceneId },
      select: { showId: true, slug: true },
    });
    if (!scene) return { error: "Szene wurde nicht gefunden." };

    const identifier = readOptionalString(formData, "identifier", { label: "Nummer", maxLength: 40 });
    const title = readOptionalString(formData, "title", { label: "Titel", maxLength: 160 });
    const summary = readOptionalString(formData, "summary", { label: "Zusammenfassung", maxLength: 600 });
    const location = readOptionalString(formData, "location", { label: "Ort", maxLength: 120 });
    const timeOfDay = readOptionalString(formData, "timeOfDay", { label: "Tageszeit", maxLength: 60 });
    const notes = readOptionalString(formData, "notes", { label: "Notiz", maxLength: 400 });
    const sequenceValue = readOptionalInt(formData, "sequence", { label: "Reihenfolge", min: 0, max: 9999 });
    const duration = readOptionalInt(formData, "duration", { label: "Dauer", min: 0, max: 600 });
    const slugInput = readOptionalString(formData, "slug", { label: "Slug", maxLength: 80 });
    if (slugInput && !/^[a-z0-9-]+$/i.test(slugInput)) {
      throw new Error("Slug darf nur Buchstaben, Zahlen und Bindestriche enthalten.");
    }

    let slug = scene.slug;
    if (slugInput) {
      const baseSlug = slugify(slugInput);
      slug = await ensureUniqueSceneSlug(scene.showId, baseSlug, sceneId);
    }

    await prisma.scene.update({
      where: { id: sceneId },
      data: {
        identifier: identifier ?? null,
        title: title ?? null,
        summary: summary ?? null,
        location: location ?? null,
        timeOfDay: timeOfDay ?? null,
        notes: notes ?? null,
        ...(sequenceValue !== undefined ? { sequence: sequenceValue } : {}),
        durationMinutes: duration ?? null,
        slug,
      },
    });

    revalidateShow(scene.showId, redirectPath);
    return { success: true };
  } catch (error) {
    console.error("updateSceneAction", error);
    return {
      error: error instanceof Error ? error.message : "Szene konnte nicht aktualisiert werden.",
    };
  }
}

export async function deleteSceneAction(formData: FormData): Promise<ActionResult> {
  const auth = await ensureProductionManager();
  if (!auth.ok) return { error: auth.error };
  const redirectPath = parseRedirectPath(formData);
  try {
    const sceneId = readString(formData, "sceneId", { label: "Szene" });
    const scene = await prisma.scene.findUnique({
      where: { id: sceneId },
      select: { showId: true },
    });
    if (!scene) return { error: "Szene wurde nicht gefunden." };

    await prisma.scene.delete({ where: { id: sceneId } });
    revalidateShow(scene.showId, redirectPath);
    return { success: true };
  } catch (error) {
    console.error("deleteSceneAction", error);
    return {
      error: error instanceof Error ? error.message : "Szene konnte nicht entfernt werden.",
    };
  }
}

export async function addSceneCharacterAction(formData: FormData): Promise<ActionResult> {
  const auth = await ensureProductionManager();
  if (!auth.ok) return { error: auth.error };
  const redirectPath = parseRedirectPath(formData);
  try {
    const sceneId = readString(formData, "sceneId", { label: "Szene" });
    const characterId = readString(formData, "characterId", { label: "Rolle" });

    const [scene, character] = await Promise.all([
      prisma.scene.findUnique({ where: { id: sceneId }, select: { showId: true } }),
      prisma.character.findUnique({ where: { id: characterId }, select: { showId: true } }),
    ]);
    if (!scene) return { error: "Szene wurde nicht gefunden." };
    if (!character) return { error: "Rolle wurde nicht gefunden." };
    if (scene.showId !== character.showId) {
      return { error: "Die Figur gehört nicht zur ausgewählten Produktion." };
    }

    const orderValue = readOptionalInt(formData, "order", { label: "Sortierung", min: 0, max: 9999 });
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
    return { success: true };
  } catch (error) {
    console.error("addSceneCharacterAction", error);
    return {
      error: error instanceof Error ? error.message : "Figur konnte nicht hinzugefügt werden.",
    };
  }
}

export async function removeSceneCharacterAction(formData: FormData): Promise<ActionResult> {
  const auth = await ensureProductionManager();
  if (!auth.ok) return { error: auth.error };
  const redirectPath = parseRedirectPath(formData);
  try {
    const assignmentId = readString(formData, "assignmentId", { label: "Zuordnung" });
    const assignment = await prisma.sceneCharacter.findUnique({
      where: { id: assignmentId },
      select: { scene: { select: { showId: true } } },
    });
    if (!assignment) return { error: "Zuordnung wurde nicht gefunden." };

    await prisma.sceneCharacter.delete({ where: { id: assignmentId } });
    revalidateShow(assignment.scene.showId, redirectPath);
    return { success: true };
  } catch (error) {
    console.error("removeSceneCharacterAction", error);
    return {
      error: error instanceof Error ? error.message : "Zuordnung konnte nicht entfernt werden.",
    };
  }
}

export async function createBreakdownItemAction(formData: FormData): Promise<ActionResult> {
  const auth = await ensureProductionManager();
  if (!auth.ok) return { error: auth.error };
  const redirectPath = parseRedirectPath(formData);
  try {
    const sceneId = readString(formData, "sceneId", { label: "Szene" });
    const departmentId = readString(formData, "departmentId", { label: "Gewerk" });
    const title = readString(formData, "title", { label: "Titel", minLength: 2, maxLength: 160 });
    const description = readOptionalString(formData, "description", { label: "Beschreibung", maxLength: 600 });
    const note = readOptionalString(formData, "note", { label: "Notiz", maxLength: 300 });
    const status =
      parseEnumValue(BreakdownStatus, formData.get("status"), "Status", { optional: true }) ??
      BreakdownStatus.planned;
    const neededBy = parseOptionalDate(formData, "neededBy", "Benötigt bis");
    const assignedToId = readOptionalString(formData, "assignedToId", { label: "Zuständig" });

    const scene = await prisma.scene.findUnique({ where: { id: sceneId }, select: { showId: true } });
    if (!scene) return { error: "Szene wurde nicht gefunden." };
    const department = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) return { error: "Gewerk wurde nicht gefunden." };

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
    return { success: true };
  } catch (error) {
    console.error("createBreakdownItemAction", error);
    return {
      error: error instanceof Error ? error.message : "Breakdown-Eintrag konnte nicht erstellt werden.",
    };
  }
}

export async function updateBreakdownItemAction(formData: FormData): Promise<ActionResult> {
  const auth = await ensureProductionManager();
  if (!auth.ok) return { error: auth.error };
  const redirectPath = parseRedirectPath(formData);
  try {
    const itemId = readString(formData, "itemId", { label: "Breakdown" });
    const item = await prisma.sceneBreakdownItem.findUnique({
      where: { id: itemId },
      select: { scene: { select: { showId: true } } },
    });
    if (!item) return { error: "Breakdown-Eintrag wurde nicht gefunden." };

    const title = readString(formData, "title", { label: "Titel", minLength: 2, maxLength: 160 });
    const description = readOptionalString(formData, "description", { label: "Beschreibung", maxLength: 600 });
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
    return { success: true };
  } catch (error) {
    console.error("updateBreakdownItemAction", error);
    return {
      error: error instanceof Error ? error.message : "Breakdown-Eintrag konnte nicht aktualisiert werden.",
    };
  }
}

export async function removeBreakdownItemAction(formData: FormData): Promise<ActionResult> {
  const auth = await ensureProductionManager();
  if (!auth.ok) return { error: auth.error };
  const redirectPath = parseRedirectPath(formData);
  try {
    const itemId = readString(formData, "itemId", { label: "Breakdown" });
    const item = await prisma.sceneBreakdownItem.findUnique({
      where: { id: itemId },
      select: { scene: { select: { showId: true } } },
    });
    if (!item) return { error: "Breakdown-Eintrag wurde nicht gefunden." };

    await prisma.sceneBreakdownItem.delete({ where: { id: itemId } });
    revalidateShow(item.scene.showId, redirectPath);
    return { success: true };
  } catch (error) {
    console.error("removeBreakdownItemAction", error);
    return {
      error: error instanceof Error ? error.message : "Breakdown-Eintrag konnte nicht entfernt werden.",
    };
  }
}

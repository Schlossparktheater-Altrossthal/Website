"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";

import { FINAL_WEEK_MANAGE_PERMISSION_KEY } from "./constants";

type ReadOptions = {
  label?: string;
  minLength?: number;
  maxLength?: number;
};

function isString(value: FormDataEntryValue | null | undefined): value is string {
  return typeof value === "string";
}

function readString(formData: FormData, key: string, options?: ReadOptions): string {
  const raw = formData.get(key);
  if (!isString(raw)) {
    throw new Error(`${options?.label ?? key} ist erforderlich.`);
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error(`${options?.label ?? key} ist erforderlich.`);
  }
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

function readOptionalString(formData: FormData, key: string, options?: ReadOptions): string | undefined {
  const raw = formData.get(key);
  if (!isString(raw)) {
    return undefined;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
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

function parseDateOnly(value: string, label: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    throw new Error(`${label} muss im Format JJJJ-MM-TT angegeben werden.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${label} ist ungültig.`);
  }
  return parsed;
}

function parseDateField(formData: FormData, key: string, label: string): Date {
  const raw = readString(formData, key, { label });
  return normalizeDateOnly(parseDateOnly(raw, label));
}

function parseOptionalTime(formData: FormData, key: string, label: string): number | null {
  const raw = formData.get(key);
  if (!isString(raw)) {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(trimmed)) {
    throw new Error(`${label} muss im Format HH:MM angegeben werden.`);
  }
  const [hourPart, minutePart] = trimmed.split(":");
  const hours = Number.parseInt(hourPart, 10);
  const minutes = Number.parseInt(minutePart, 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    throw new Error(`${label} ist ungültig.`);
  }
  return hours * 60 + minutes;
}

function parseRedirectPath(formData: FormData): string | null {
  const raw = formData.get("redirectPath");
  if (!isString(raw)) return null;
  const trimmed = raw.trim();
  return trimmed || null;
}

function normalizeDateOnly(date: Date): Date {
  const iso = date.toISOString().slice(0, 10);
  return new Date(`${iso}T00:00:00.000Z`);
}

function toDateIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function ensureAssigneeExists(assigneeId: string): Promise<void> {
  const assignee = await prisma.user.findFirst({
    where: { id: assigneeId, deactivatedAt: null },
    select: { id: true },
  });
  if (!assignee) {
    throw new Error("Die ausgewählte Person konnte nicht gefunden werden oder ist deaktiviert.");
  }
}

function assertWithinFinalWeek(date: Date, weekStart: Date) {
  const normalizedStart = normalizeDateOnly(weekStart);
  const normalizedEnd = new Date(normalizedStart.getTime() + 6 * 86_400_000);
  const dateIso = toDateIso(date);
  const startIso = toDateIso(normalizedStart);
  const endIso = toDateIso(normalizedEnd);
  if (dateIso < startIso || dateIso > endIso) {
    throw new Error("Der Dienst muss innerhalb der definierten Endprobenwoche liegen.");
  }
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

export async function createFinalRehearsalDutyAction(formData: FormData): Promise<void> {
  const redirectPath = parseRedirectPath(formData);
  try {
    const session = await requireAuth();
    const allowed = await hasPermission(session.user, FINAL_WEEK_MANAGE_PERMISSION_KEY);
    if (!allowed) {
      throw new Error("Du darfst keinen Dienstplan für die Endprobenwoche bearbeiten.");
    }
    const userId = session.user?.id;
    if (!userId) {
      throw new Error("Ungültige Sitzung: Benutzerkennung fehlt.");
    }

    const showId = readString(formData, "showId", { label: "Produktion" });
    const date = parseDateField(formData, "date", "Datum");
    const title = readString(formData, "title", { label: "Titel", minLength: 3, maxLength: 120 });
    const location = readOptionalString(formData, "location", { label: "Ort", maxLength: 160 });
    const description = readOptionalString(formData, "description", { label: "Beschreibung", maxLength: 1000 });
    const startTime = parseOptionalTime(formData, "startTime", "Startzeit");
    const endTime = parseOptionalTime(formData, "endTime", "Endzeit");
    if (startTime !== null && endTime !== null && endTime < startTime) {
      throw new Error("Die Endzeit darf nicht vor der Startzeit liegen.");
    }
    const assigneeId = readOptionalString(formData, "assigneeId", { label: "Zuständige Person" });

    const show = await prisma.show.findUnique({
      where: { id: showId },
      select: { finalRehearsalWeekStart: true },
    });
    if (!show) {
      throw new Error("Produktion wurde nicht gefunden.");
    }
    if (!show.finalRehearsalWeekStart) {
      throw new Error("Für diese Produktion ist noch kein Start der Endprobenwoche hinterlegt.");
    }

    assertWithinFinalWeek(date, show.finalRehearsalWeekStart);

    if (assigneeId) {
      await ensureAssigneeExists(assigneeId);
    }

    await prisma.finalRehearsalDuty.create({
      data: {
        showId,
        date,
        title,
        location: location ?? null,
        description: description ?? null,
        startTime,
        endTime,
        assigneeId: assigneeId ?? null,
        createdById: userId,
      },
    });

    revalidatePath("/mitglieder/endproben-woche/dienstplan");
    revalidatePath("/mitglieder/endproben-woche");
    if (redirectPath) {
      revalidatePath(redirectPath);
    }
  } catch (error) {
    console.error("createFinalRehearsalDutyAction", error);
    throw new Error(getErrorMessage(error, "Dienst konnte nicht angelegt werden."));
  }
}

export async function updateFinalRehearsalDutyAssignmentAction(formData: FormData): Promise<void> {
  const redirectPath = parseRedirectPath(formData);
  try {
    const session = await requireAuth();
    const allowed = await hasPermission(session.user, FINAL_WEEK_MANAGE_PERMISSION_KEY);
    if (!allowed) {
      throw new Error("Du darfst den Dienstplan nicht bearbeiten.");
    }

    const dutyId = readString(formData, "dutyId", { label: "Dienst" });
    const assigneeId = readOptionalString(formData, "assigneeId", { label: "Zuständige Person" });

    if (assigneeId) {
      await ensureAssigneeExists(assigneeId);
    }

    await prisma.finalRehearsalDuty.update({
      where: { id: dutyId },
      data: { assigneeId: assigneeId ?? null },
    });

    revalidatePath("/mitglieder/endproben-woche/dienstplan");
    revalidatePath("/mitglieder/endproben-woche");
    if (redirectPath) {
      revalidatePath(redirectPath);
    }
  } catch (error) {
    console.error("updateFinalRehearsalDutyAssignmentAction", error);
    throw new Error(getErrorMessage(error, "Dienst konnte nicht aktualisiert werden."));
  }
}

export async function deleteFinalRehearsalDutyAction(formData: FormData): Promise<void> {
  const redirectPath = parseRedirectPath(formData);
  try {
    const session = await requireAuth();
    const allowed = await hasPermission(session.user, FINAL_WEEK_MANAGE_PERMISSION_KEY);
    if (!allowed) {
      throw new Error("Du darfst den Dienstplan nicht bearbeiten.");
    }

    const dutyId = readString(formData, "dutyId", { label: "Dienst" });

    await prisma.finalRehearsalDuty.delete({ where: { id: dutyId } });

    revalidatePath("/mitglieder/endproben-woche/dienstplan");
    revalidatePath("/mitglieder/endproben-woche");
    if (redirectPath) {
      revalidatePath(redirectPath);
    }
  } catch (error) {
    console.error("deleteFinalRehearsalDutyAction", error);
    throw new Error(getErrorMessage(error, "Dienst konnte nicht entfernt werden."));
  }
}

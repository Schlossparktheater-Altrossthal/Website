"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { getActiveProduction } from "@/lib/active-production";
import { listRolePreferenceDefinitions } from "@/lib/onboarding/role-preferences";

export type ProductionActionResult = { ok: true; message?: string } | { ok: false; error: string };

export function actionSuccess(message?: string): ProductionActionResult {
  return message ? { ok: true, message } : { ok: true };
}

export function actionFailure(error: unknown, fallbackMessage: string): ProductionActionResult {
  const message = error instanceof Error ? error.message : fallbackMessage;
  return { ok: false, error: message };
}

export type ReadOptions = {
  minLength?: number;
  maxLength?: number;
  label?: string;
};

export const ACTING_ROLE_PREFERENCE_CODES = new Set(
  listRolePreferenceDefinitions("acting").map((definition) => definition.code),
);

export function isString(value: FormDataEntryValue | null | undefined): value is string {
  return typeof value === "string";
}

export function readOptionalString(
  formData: FormData,
  key: string,
  options?: ReadOptions,
): string | undefined {
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

export function readOptionalRolePreferenceCode(
  formData: FormData,
  key: string,
  options?: ReadOptions,
): string | undefined {
  const value = readOptionalString(formData, key, options);
  if (!value) return undefined;
  if (!ACTING_ROLE_PREFERENCE_CODES.has(value)) {
    throw new Error(`${options?.label ?? key} ist ungültig.`);
  }
  return value;
}

export function readString(formData: FormData, key: string, options?: ReadOptions): string {
  const value = readOptionalString(formData, key, options);
  if (value === undefined) {
    throw new Error(`${options?.label ?? key} ist erforderlich.`);
  }
  return value;
}

export function readOptionalInt(
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

export function readInt(
  formData: FormData,
  key: string,
  options?: { label?: string; min?: number; max?: number },
) {
  const value = readOptionalInt(formData, key, options);
  if (value === undefined) {
    throw new Error(`${options?.label ?? key} ist erforderlich.`);
  }
  return value;
}

export function parseEnumValue<T extends Record<string, string>>(
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

export function parseCheckbox(value: FormDataEntryValue | null | undefined) {
  if (!isString(value)) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "on" || normalized === "true" || normalized === "1";
}

export function parseColor(raw?: string) {
  if (!raw) return undefined;
  const value = raw.trim();
  if (!value) return undefined;
  if (!/^#(?:[0-9a-fA-F]{6})$/.test(value)) {
    throw new Error("Farbwert muss im Format #RRGGBB angegeben werden.");
  }
  return value.toLowerCase();
}

export function parseOptionalDate(formData: FormData, key: string, label: string) {
  const raw = readOptionalString(formData, key, { label });
  if (!raw) return undefined;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} enthält kein gültiges Datum.`);
  }
  return date;
}

export function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-")
    .slice(0, 60);
}

export async function ensureUniqueDepartmentSlug(base: string, excludeId?: string) {
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

export async function ensureUniqueSceneSlug(showId: string, base: string, excludeId?: string) {
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

export function parseRedirectPath(formData: FormData) {
  const raw = formData.get("redirectPath");
  if (!isString(raw)) return undefined;
  const trimmed = raw.trim();
  if (!trimmed || !trimmed.startsWith("/")) return undefined;
  return trimmed;
}

export async function requireProductionManager() {
  const session = await requireAuth();
  const userId = session.user?.id;
  if (!userId) {
    throw new Error("Keine Berechtigung.");
  }
  const allowed = await hasPermission(session.user, "PRIVATE.PRODUCTION.SHOW.MANAGE");
  if (!allowed) {
    throw new Error("Keine Berechtigung.");
  }
  return { userId };
}

export async function requireActiveProductionManager() {
  const { userId } = await requireProductionManager();
  const activeProduction = await getActiveProduction(userId);
  if (!activeProduction) {
    throw new Error("Bitte wähle zunächst eine aktive Produktion aus.");
  }
  return { userId, activeProduction };
}

export async function ensureProductionManager() {
  try {
    const { userId } = await requireProductionManager();
    return { ok: true as const, userId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Keine Berechtigung.";
    return { ok: false as const, error: message };
  }
}

export function revalidateDepartments(redirectPath?: string) {
  revalidatePath("/mitglieder/produktionen");
  revalidatePath("/mitglieder/meine-gewerke");
  if (redirectPath && redirectPath !== "/mitglieder/produktionen") {
    revalidatePath(redirectPath);
  }
}

export function revalidateShow(showId: string, redirectPath?: string, includeList = false) {
  const target = `/mitglieder/produktionen/${showId}`;
  if (includeList) {
    revalidatePath("/mitglieder/produktionen");
  }
  revalidatePath(target);
  if (redirectPath && redirectPath !== target && redirectPath !== "/mitglieder/produktionen") {
    revalidatePath(redirectPath);
  }
}

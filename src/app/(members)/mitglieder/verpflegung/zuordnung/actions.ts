"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  assignPendingRestriction,
  deletePendingRestriction,
  splitPendingRestriction,
  unassignPendingRestriction,
} from "@/lib/food/pending";
import { createLogger } from "@/lib/logger";
import { FOOD_PERMISSION_KEYS, hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

const logger = createLogger("food.pending");
const PATH = "/mitglieder/verpflegung/zuordnung";

type Result = { ok: true; count: number } | { ok: false; error: string };

async function authorize() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, FOOD_PERMISSION_KEYS.taxonomyManage);
  return allowed && session.user?.id ? session.user.id : null;
}

const keySchema = z.string().min(1).max(300);

async function run(
  action: string,
  key: string,
  operation: (userId: string) => Promise<number>,
): Promise<Result> {
  const userId = await authorize();
  if (!userId) return { ok: false, error: "Keine Berechtigung." };
  if (!keySchema.safeParse(key).success) return { ok: false, error: "Ungültiger Eintrag." };
  try {
    const count = await operation(userId);
    // Gesundheitsdaten Dritter: jede Änderung wird protokolliert (ohne Personenbezug).
    logger.info(`Allergie-Zuordnung: ${action}`, { userId, key, count });
    revalidatePath(PATH);
    return { ok: true, count };
  } catch (error) {
    logger.error(`Allergie-Zuordnung fehlgeschlagen: ${action}`, { userId, key, error });
    return { ok: false, error: "Änderung fehlgeschlagen." };
  }
}

export async function assignPendingAction(key: string, taxonCode: string): Promise<Result> {
  if (!z.string().min(3).max(120).safeParse(taxonCode).success) {
    return { ok: false, error: "Ungültige Zuordnung." };
  }
  return run("zuordnen", key, (userId) => assignPendingRestriction(key, taxonCode, userId));
}

export async function splitPendingAction(key: string): Promise<Result> {
  return run("aufteilen", key, () => splitPendingRestriction(key));
}

export async function deletePendingAction(key: string): Promise<Result> {
  return run("löschen", key, () => deletePendingRestriction(key));
}

const itemsSchema = z
  .array(z.object({ key: keySchema, taxonCode: z.string().min(3).max(120) }))
  .min(1)
  .max(200);

/** Mehrere eindeutige Treffer auf einmal bestätigen. */
export async function assignManyPendingAction(
  items: { key: string; taxonCode: string }[],
): Promise<Result> {
  const userId = await authorize();
  if (!userId) return { ok: false, error: "Keine Berechtigung." };
  const parsed = itemsSchema.safeParse(items);
  if (!parsed.success) return { ok: false, error: "Ungültige Auswahl." };
  try {
    let count = 0;
    for (const item of parsed.data) {
      count += await assignPendingRestriction(item.key, item.taxonCode, userId);
    }
    logger.info("Allergie-Zuordnung: alle eindeutigen", {
      userId,
      items: parsed.data.length,
      count,
    });
    revalidatePath(PATH);
    return { ok: true, count };
  } catch (error) {
    logger.error("Allergie-Zuordnung fehlgeschlagen: alle eindeutigen", { userId, error });
    return { ok: false, error: "Änderung fehlgeschlagen." };
  }
}

/** Rückgängig für einzelne oder gesammelte Zuordnungen. */
export async function unassignManyPendingAction(
  items: { key: string; taxonCode: string }[],
): Promise<Result> {
  const userId = await authorize();
  if (!userId) return { ok: false, error: "Keine Berechtigung." };
  const parsed = itemsSchema.safeParse(items);
  if (!parsed.success) return { ok: false, error: "Ungültige Auswahl." };
  try {
    let count = 0;
    for (const item of parsed.data) {
      count += await unassignPendingRestriction(item.key, item.taxonCode);
    }
    logger.info("Allergie-Zuordnung: rückgängig", { userId, items: parsed.data.length, count });
    revalidatePath(PATH);
    return { ok: true, count };
  } catch (error) {
    logger.error("Allergie-Zuordnung fehlgeschlagen: rückgängig", { userId, error });
    return { ok: false, error: "Rückgängig fehlgeschlagen." };
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  assignPendingRestriction,
  deletePendingRestriction,
  splitPendingRestriction,
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

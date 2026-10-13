"use server";

import { z } from "zod";

import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import {
  ScriptLearnError,
  recordReviews,
  resetRole,
  reviewSchema,
  setWeeklyDays,
} from "@/lib/skript/learn/service";
import { SCRIPT_READ_PERMISSION } from "@/lib/skript/service";

/** Speichern im Lernmodus (docs/Plan/lernmodus-plan.md); jede Person nur ihren eigenen Stand. */
async function requireLearner(showId: string) {
  const session = await requireAuth();
  const userId = session.user?.id;
  if (!userId || !(await hasPermission(session.user, SCRIPT_READ_PERMISSION, { showId }))) {
    throw new ScriptLearnError("Keine Berechtigung.");
  }
  return userId;
}

type Result = { ok: true; saved?: number } | { ok: false; error: string };

async function run(task: () => Promise<number | void>): Promise<Result> {
  try {
    const saved = await task();
    return { ok: true, saved: saved ?? undefined };
  } catch (error) {
    if (error instanceof ScriptLearnError) return { ok: false, error: error.message };
    if (error instanceof z.ZodError) return { ok: false, error: "Ungültige Eingabe." };
    console.error("[lernen] Aktion fehlgeschlagen", error);
    return { ok: false, error: "Das hat nicht geklappt." };
  }
}

export async function submitReviewsAction(showId: string, entries: unknown) {
  return run(async () =>
    recordReviews(
      await requireLearner(showId),
      showId,
      z.array(reviewSchema).max(500).parse(entries),
    ),
  );
}

export async function setWeeklyDaysAction(showId: string, days: number) {
  return run(async () =>
    setWeeklyDays(await requireLearner(showId), z.number().int().min(1).max(7).parse(days)),
  );
}

export async function resetRoleAction(showId: string, roleId: string) {
  return run(async () =>
    resetRole(await requireLearner(showId), showId, z.string().min(1).max(100).parse(roleId)),
  );
}

"use server";

import { revalidatePath } from "next/cache";

import { createLogger } from "@/lib/logger";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import {
  anonymizeAccount,
  collectRetentionCandidates,
  purgeDietaryData,
  purgePhotoConsents,
} from "@/lib/retention";

export type RetentionActionResult = { ok: true; message: string } | { ok: false; error: string };

const logger = createLogger("retention");
const PAGE_PATH = "/mitglieder/mitgliederverwaltung/aufbewahrung";

async function ensureAdmin() {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "PRIVATE.ADMIN.MEMBERS.MANAGE"))) {
    throw new Error("Keine Berechtigung für die Mitgliederverwaltung.");
  }
  return session;
}

function failure(error: unknown, fallback: string): RetentionActionResult {
  console.error("[retention]", error);
  return { ok: false, error: error instanceof Error ? error.message : fallback };
}

/** Kandidaten werden serverseitig neu ermittelt – der Client schickt keine IDs. */
export async function purgeExpiredDietaryAction(): Promise<RetentionActionResult> {
  try {
    const session = await ensureAdmin();
    const { dietary } = await collectRetentionCandidates();
    const count = await purgeDietaryData(dietary.map((entry) => entry.id));
    await logger.info("Allergie-/Ernährungsdaten nach Frist gelöscht", {
      description: `${count} Personen, ausgelöst von ${session.user?.id ?? "unbekannt"}`,
    });
    revalidatePath(PAGE_PATH);
    return { ok: true, message: `Ernährungs- und Allergiedaten von ${count} Personen gelöscht.` };
  } catch (error) {
    return failure(error, "Löschen fehlgeschlagen.");
  }
}

export async function purgeExpiredPhotoConsentsAction(): Promise<RetentionActionResult> {
  try {
    const session = await ensureAdmin();
    const { photoConsents } = await collectRetentionCandidates();
    const count = await purgePhotoConsents(photoConsents.map((entry) => entry.id));
    await logger.info("Fotoerlaubnisse nach Frist gelöscht", {
      description: `${count} Einträge, ausgelöst von ${session.user?.id ?? "unbekannt"}`,
    });
    revalidatePath(PAGE_PATH);
    return { ok: true, message: `${count} Fotoerlaubnisse samt Dokumenten gelöscht.` };
  } catch (error) {
    return failure(error, "Löschen fehlgeschlagen.");
  }
}

export async function anonymizeExpiredAccountAction(
  formData: FormData,
): Promise<RetentionActionResult> {
  try {
    const session = await ensureAdmin();
    const userId = formData.get("userId");
    if (typeof userId !== "string" || !userId) {
      throw new Error("Konto fehlt.");
    }
    const { accounts } = await collectRetentionCandidates();
    if (!accounts.some((entry) => entry.id === userId)) {
      throw new Error("Für dieses Konto ist die Aufbewahrungsfrist nicht abgelaufen.");
    }
    await anonymizeAccount(userId);
    await logger.info("Konto nach Frist anonymisiert", {
      description: `Konto ${userId}, ausgelöst von ${session.user?.id ?? "unbekannt"}`,
    });
    revalidatePath(PAGE_PATH);
    return { ok: true, message: "Konto wurde anonymisiert." };
  } catch (error) {
    return failure(error, "Anonymisieren fehlgeschlagen.");
  }
}

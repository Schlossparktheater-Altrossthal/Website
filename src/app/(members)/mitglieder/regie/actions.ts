"use server";

import type { DirectionWishTargetStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { requireAuth } from "@/lib/rbac";
import { DIRECTION_HOME_PATH } from "@/lib/regie/paths";
import {
  PLANNER_WISHES_PATH,
  RECIPIENT_WISHES_PATH,
  WISH_TARGETS_MAX,
  WISH_TEXT_MAX,
  createDirectionWish,
  loadTargetForViewer,
  loadWishAccess,
  loadWishViewer,
  replyToDirectionWish,
  setWishTargetStatus,
  updateDirectionWishText,
  type WishTargetInput,
} from "@/lib/regie/wishes";

export type WishActionResult = { ok: true } | { ok: false; error: string };

const STATUSES: readonly DirectionWishTargetStatus[] = [
  "open",
  "accepted",
  "planned",
  "done",
  "declined",
];
const TARGET_KINDS = ["planning", "department", "character", "user"] as const;

function parseDay(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return new Date(`${value}T12:00:00.000Z`);
}

function revalidate() {
  revalidatePath(DIRECTION_HOME_PATH, "layout");
  revalidatePath(PLANNER_WISHES_PATH);
  revalidatePath(RECIPIENT_WISHES_PATH);
  revalidatePath("/mitglieder");
  revalidatePath("/mitglieder/meine-gewerke", "layout");
}

async function sessionUserId() {
  const session = await requireAuth();
  return session.user?.id ?? null;
}

function parseTargets(input: unknown): WishTargetInput[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, WISH_TARGETS_MAX).flatMap((entry): WishTargetInput[] => {
    if (!entry || typeof entry !== "object") return [];
    const { kind, id } = entry as { kind?: unknown; id?: unknown };
    if (typeof kind !== "string" || !(TARGET_KINDS as readonly string[]).includes(kind)) return [];
    if (kind === "planning") return [{ kind: "planning" }];
    return typeof id === "string" && id
      ? [{ kind: kind as Exclude<WishTargetInput["kind"], "planning">, id }]
      : [];
  });
}

export async function createWishAction(input: {
  showId: string;
  text: string;
  targets?: WishTargetInput[];
  sceneIds?: string[];
  userIds?: string[];
  dateFrom?: string | null;
  dateTo?: string | null;
}): Promise<WishActionResult> {
  const userId = await sessionUserId();
  if (!userId) return { ok: false, error: "Nicht angemeldet" };
  const text = input.text?.trim() ?? "";
  if (!text) return { ok: false, error: "Bitte beschreibe deinen Wunsch." };
  if (text.length > WISH_TEXT_MAX) return { ok: false, error: "Der Text ist zu lang." };
  if (!(await loadWishViewer(userId, input.showId)).direction) {
    return { ok: false, error: "Nicht berechtigt" };
  }
  // Ohne Angabe wie bisher an die Planung.
  const targets = input.targets ? parseTargets(input.targets) : [{ kind: "planning" as const }];
  if (!targets.length) return { ok: false, error: "Bitte wähle mindestens einen Empfänger." };
  let dateFrom = parseDay(input.dateFrom);
  let dateTo = parseDay(input.dateTo);
  if (dateFrom && dateTo && dateTo < dateFrom) [dateFrom, dateTo] = [dateTo, dateFrom];

  try {
    await createDirectionWish({
      showId: input.showId,
      authorId: userId,
      text,
      targets,
      sceneIds: (input.sceneIds ?? []).slice(0, 50),
      userIds: (input.userIds ?? []).slice(0, 50),
      dateFrom,
      dateTo,
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Fehler beim Senden" };
  }
  revalidate();
  return { ok: true };
}

/** Wunschtext nachträglich ändern (Regieteam). */
export async function editWishAction(input: {
  wishId: string;
  text: string;
}): Promise<WishActionResult> {
  const userId = await sessionUserId();
  if (!userId) return { ok: false, error: "Nicht angemeldet" };
  const text = input.text?.trim() ?? "";
  if (!text) return { ok: false, error: "Der Wunsch darf nicht leer sein." };
  if (text.length > WISH_TEXT_MAX) return { ok: false, error: "Der Text ist zu lang." };
  const viewer = await loadWishAccess(input.wishId, userId);
  if (!viewer?.direction) return { ok: false, error: "Nicht berechtigt" };
  await updateDirectionWishText(input.wishId, userId, text);
  revalidate();
  return { ok: true };
}

export async function replyWishAction(input: {
  wishId: string;
  text: string;
}): Promise<WishActionResult> {
  const userId = await sessionUserId();
  if (!userId) return { ok: false, error: "Nicht angemeldet" };
  const text = input.text?.trim() ?? "";
  if (!text) return { ok: false, error: "Bitte schreibe eine Antwort." };
  if (text.length > WISH_TEXT_MAX) return { ok: false, error: "Der Text ist zu lang." };
  if (!(await loadWishAccess(input.wishId, userId))) {
    return { ok: false, error: "Nicht berechtigt" };
  }
  await replyToDirectionWish(input.wishId, userId, text);
  revalidate();
  return { ok: true };
}

/**
 * Status eines Empfängers setzen. Planung: eingeplant/erledigt/abgelehnt; Gewerk: annehmen und
 * erledigen alle Mitglieder, ablehnen nur die Leitung; Figur/Person: alles inkl. ablehnen;
 * Regieteam: erledigt (Planung) und wieder öffnen.
 */
export async function setWishTargetStatusAction(input: {
  targetId: string;
  status: DirectionWishTargetStatus;
  reason?: string | null;
  eventId?: string | null;
}): Promise<WishActionResult> {
  const userId = await sessionUserId();
  if (!userId) return { ok: false, error: "Nicht angemeldet" };
  if (!STATUSES.includes(input.status)) return { ok: false, error: "Ungültiger Status" };
  const loaded = await loadTargetForViewer(input.targetId, userId);
  if (!loaded) return { ok: false, error: "Wunsch nicht gefunden" };
  if (!loaded.allowed.includes(input.status)) {
    return {
      ok: false,
      error:
        input.status === "declined" && loaded.target.kind === "department"
          ? "Ablehnen kann nur die Gewerksleitung."
          : "Nicht berechtigt",
    };
  }
  const reason = input.reason?.trim() || null;
  if (input.status === "declined" && !reason) {
    return { ok: false, error: "Bitte gib einen Grund an." };
  }
  if (reason && reason.length > WISH_TEXT_MAX) return { ok: false, error: "Der Text ist zu lang." };

  await setWishTargetStatus(input.targetId, userId, input.status, {
    reason,
    eventId: input.eventId ?? null,
  });
  revalidate();
  return { ok: true };
}

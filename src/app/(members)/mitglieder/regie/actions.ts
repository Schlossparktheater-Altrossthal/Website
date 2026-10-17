"use server";

import type { DirectionWishStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { getDirectionShows } from "@/lib/regie/access";
import { DIRECTION_HOME_PATH } from "@/lib/regie/paths";
import {
  PLANNER_WISHES_PATH,
  WISH_TEXT_MAX,
  canPlanForShow,
  createDirectionWish,
  replyToDirectionWish,
  setDirectionWishStatus,
} from "@/lib/regie/wishes";

export type WishActionResult = { ok: true } | { ok: false; error: string };

const STATUSES: readonly DirectionWishStatus[] = ["open", "planned", "done", "declined"];

function parseDay(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return new Date(`${value}T12:00:00.000Z`);
}

function revalidate() {
  revalidatePath(DIRECTION_HOME_PATH, "layout");
  revalidatePath(PLANNER_WISHES_PATH);
}

async function sessionUserId() {
  const session = await requireAuth();
  return session.user?.id ?? null;
}

async function isDirectionMember(userId: string, showId: string) {
  return (await getDirectionShows(userId)).some((show) => show.id === showId);
}

/** Wer einen Wunsch sehen und beantworten darf: Regieteam oder Planung der Produktion. */
async function wishAccess(userId: string, wishId: string) {
  const wish = await prisma.directionWish.findUnique({
    where: { id: wishId },
    select: { showId: true },
  });
  if (!wish) return null;
  const [direction, planner] = await Promise.all([
    isDirectionMember(userId, wish.showId),
    canPlanForShow({ id: userId }, wish.showId),
  ]);
  return { showId: wish.showId, direction, planner };
}

export async function createWishAction(input: {
  showId: string;
  text: string;
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
  if (!(await isDirectionMember(userId, input.showId))) {
    return { ok: false, error: "Nicht berechtigt" };
  }
  let dateFrom = parseDay(input.dateFrom);
  let dateTo = parseDay(input.dateTo);
  if (dateFrom && dateTo && dateTo < dateFrom) [dateFrom, dateTo] = [dateTo, dateFrom];

  await createDirectionWish({
    showId: input.showId,
    authorId: userId,
    text,
    sceneIds: (input.sceneIds ?? []).slice(0, 50),
    userIds: (input.userIds ?? []).slice(0, 50),
    dateFrom,
    dateTo,
  });
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
  const access = await wishAccess(userId, input.wishId);
  if (!access || (!access.direction && !access.planner)) {
    return { ok: false, error: "Nicht berechtigt" };
  }
  await replyToDirectionWish(input.wishId, userId, text);
  revalidate();
  return { ok: true };
}

/**
 * Status setzen: Die Planung entscheidet (eingeplant, erledigt, abgelehnt mit Grund); das
 * Regieteam kann einen eigenen Wunsch als erledigt markieren oder wieder öffnen.
 */
export async function setWishStatusAction(input: {
  wishId: string;
  status: DirectionWishStatus;
  reason?: string | null;
  eventId?: string | null;
}): Promise<WishActionResult> {
  const userId = await sessionUserId();
  if (!userId) return { ok: false, error: "Nicht angemeldet" };
  if (!STATUSES.includes(input.status)) return { ok: false, error: "Ungültiger Status" };
  const access = await wishAccess(userId, input.wishId);
  if (!access) return { ok: false, error: "Wunsch nicht gefunden" };
  const allowed =
    access.planner || (access.direction && (input.status === "done" || input.status === "open"));
  if (!allowed) return { ok: false, error: "Nicht berechtigt" };
  const reason = input.reason?.trim() || null;
  if (input.status === "declined" && !reason) {
    return { ok: false, error: "Bitte gib einen Grund an." };
  }
  if (reason && reason.length > WISH_TEXT_MAX) return { ok: false, error: "Der Text ist zu lang." };

  await setDirectionWishStatus(input.wishId, userId, input.status, {
    reason,
    eventId: input.status === "planned" ? (input.eventId ?? null) : undefined,
  });
  revalidate();
  return { ok: true };
}

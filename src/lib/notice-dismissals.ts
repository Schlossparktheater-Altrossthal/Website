import { z } from "zod";

import { prisma } from "@/lib/prisma";

/** Schlüssel ausblendbarer Hinweise, z. B. `whatsapp:<showId>`. */
export const noticeKeySchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9-]*(?::[A-Za-z0-9_-]+)?$/)
  .max(120);

export function getWhatsappNoticeKey(showId: string) {
  return `whatsapp:${showId}`;
}

export async function readDismissedNoticeKeys(userId: string, keys: readonly string[]) {
  if (!keys.length) return new Set<string>();
  const rows = await prisma.userNoticeDismissal.findMany({
    where: { userId, key: { in: [...keys] } },
    select: { key: true },
  });
  return new Set(rows.map((row) => row.key));
}

export async function saveNoticeDismissal(userId: string, key: string) {
  await prisma.userNoticeDismissal.upsert({
    where: { userId_key: { userId, key } },
    update: {},
    create: { userId, key },
  });
}

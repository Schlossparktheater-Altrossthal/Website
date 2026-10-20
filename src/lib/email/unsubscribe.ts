import { createHmac, timingSafeEqual } from "node:crypto";

import { getAppBaseUrl } from "@/lib/app-url";
import { getAuthSecret } from "@/lib/auth-secret";
import { NOTIFICATION_CATEGORIES } from "@/lib/notifications/types";
import { prisma } from "@/lib/prisma";

/** Signierter Abmeldelink je Person – gültig ohne Anmeldung, ohne Ablauf (RFC 8058). */
function sign(userId: string) {
  return createHmac("sha256", getAuthSecret())
    .update(`mail-unsubscribe:${userId}`)
    .digest("base64url")
    .slice(0, 32);
}

export function verifyUnsubscribeSignature(userId: string, signature: string) {
  const expected = Buffer.from(sign(userId));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

function query(userId: string) {
  return `u=${encodeURIComponent(userId)}&s=${sign(userId)}`;
}

export function unsubscribePageUrl(userId: string) {
  return `${getAppBaseUrl()}/email/abmelden?${query(userId)}`;
}

/** Header für Benachrichtigungs-Mails: Ein-Klick-Abmeldung direkt im Mailprogramm. */
export function unsubscribeHeaders(userId: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${getAppBaseUrl()}/api/email/unsubscribe?${query(userId)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

export const NOTIFICATION_SETTINGS_PATH = "/mitglieder/profil?bereich=benachrichtigungen";

/**
 * Abmelden: alle Bereiche auf „Aus“, Zusammenfassung aus. Dringendes und Aufgaben kommen weiter –
 * das sagt die Abmeldeseite deutlich.
 */
export async function unsubscribeFromNotificationMails(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return false;
  await prisma.$transaction([
    ...NOTIFICATION_CATEGORIES.map((category) =>
      prisma.notificationPreference.upsert({
        where: { userId_category: { userId, category } },
        create: { userId, category, push: false, emailMode: "off" },
        update: { emailMode: "off" },
      }),
    ),
    prisma.notificationSettings.upsert({
      where: { userId },
      create: { userId, digest: "off" },
      update: { digest: "off" },
    }),
  ]);
  return true;
}

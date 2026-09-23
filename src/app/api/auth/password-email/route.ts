import { NextResponse } from "next/server";
import { z } from "zod";

import { sendAuthentikPasswordEmail } from "@/lib/authentik/client";
import { isAuthentikProvisioningEnabled } from "@/lib/authentik/config";
import {
  ensureAuthentikUserForMember,
  memberIdentitySelect,
  toMemberIdentity,
} from "@/lib/authentik/sync";
import { getRequestIp, recordPasswordEmailAttempt } from "@/lib/auth/rate-limit";
import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const PASSWORD_EMAIL_SUCCESS_MESSAGE =
  "Falls ein Konto mit dieser E-Mail existiert, erhältst du in Kürze eine E-Mail.";

const requestSchema = z.object({ email: z.string().email() });
const logger = createLogger("authentik-password-email");

/**
 * "Passwort vergessen": verschickt über Authentik den Link "Passwort festlegen".
 * Fehlt das Mitglied noch in Authentik, wird das Konto vorher angelegt. Die
 * Antwort verrät nicht, ob die Adresse bekannt ist.
 */
export async function POST(request: Request) {
  if (!isAuthentikProvisioningEnabled()) {
    return NextResponse.json(
      { error: "Passwort-Zurücksetzen ist derzeit nicht verfügbar." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Bitte gib eine gültige E-Mail-Adresse ein." },
      { status: 400 },
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  const rateLimit = recordPasswordEmailAttempt(email, getRequestIp(request));
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Zu viele Versuche, bitte später erneut versuchen." },
      {
        status: 429,
        headers: rateLimit.retryAfterSeconds
          ? { "Retry-After": String(rateLimit.retryAfterSeconds) }
          : undefined,
      },
    );
  }

  const member = await prisma.user.findUnique({
    where: { email },
    select: { ...memberIdentitySelect, deactivatedAt: true },
  });
  const identity = member && !member.deactivatedAt ? toMemberIdentity(member) : null;
  if (!identity) {
    return NextResponse.json({ message: PASSWORD_EMAIL_SUCCESS_MESSAGE });
  }

  try {
    // Findet das Konto auch nach einer E-Mail-Änderung über die Profil-ID und
    // trägt die aktuelle Adresse ein, bevor die Mail verschickt wird.
    const { user: authentikUser } = await ensureAuthentikUserForMember(identity);
    await sendAuthentikPasswordEmail(authentikUser);
    // ÜBERGANGSPHASE: Das neue Passwort entsteht in Authentik. Ein alter
    // lokaler Hash würde sonst beim nächsten Login über das alte Formular das
    // neue Passwort in Authentik wieder überschreiben.
    await prisma.user.update({ where: { id: identity.userId }, data: { passwordHash: null } });
    await logger.info("Passwort-Mail über Authentik verschickt", { description: identity.email });
  } catch (error) {
    console.error("[authentik] Passwort-Mail fehlgeschlagen", error);
    await logger.error("Passwort-Mail über Authentik fehlgeschlagen", {
      description: identity.email,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return NextResponse.json({ message: PASSWORD_EMAIL_SUCCESS_MESSAGE });
}

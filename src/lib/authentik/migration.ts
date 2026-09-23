/**
 * ÜBERGANGSPHASE (befristet, siehe `isLegacyPasswordLoginActive`):
 * Überträgt Passwörter aus dem Mitgliederbereich nach Authentik.
 *
 * - Beim erfolgreichen Login über das alte Passwortformular wird das gerade
 *   geprüfte Klartext-Passwort in Authentik gesetzt, das Konto verknüpft und
 *   der lokale Hash sofort gelöscht. Danach funktioniert nur noch der Login
 *   über Authentik.
 * - Setzt der Mitgliederbereich an anderer Stelle ein Passwort (Profil,
 *   Onboarding, Admin), landet es auf demselben Weg direkt in Authentik.
 *
 * Nach dem Stichtag AUTHENTIK_LEGACY_LOGIN_UNTIL wird diese Datei zusammen
 * mit `User.passwordHash` entfernt; Passwörter werden dann ausschließlich in
 * Authentik gesetzt (Passwort-Mail bzw. Authentik-Einstellungen).
 */
import { linkAuthentikAccount } from "@/lib/authentik/account-link";
import {
  ensureAuthentikUser,
  isManagedAuthentikUser,
  setAuthentikPassword,
} from "@/lib/authentik/client";
import { isAuthentikEnabled } from "@/lib/authentik/config";
import { createLogger } from "@/lib/logger";
import { combineNameParts } from "@/lib/names";
import { prisma } from "@/lib/prisma";

const logger = createLogger("authentik-migration");

export type PasswordMigrationResult =
  | { status: "migrated" }
  | { status: "skipped"; reason: "disabled" | "no-email" | "unmanaged-account" }
  | { status: "failed" };

/**
 * Setzt das Passwort in Authentik und löscht bei Erfolg den lokalen Hash.
 * Fehler werden geloggt und nicht geworfen: Der Login bzw. das Speichern im
 * Mitgliederbereich soll daran nicht scheitern, der nächste Versuch migriert.
 */
export async function migratePasswordToAuthentik(
  userId: string,
  password: string,
): Promise<PasswordMigrationResult> {
  if (!isAuthentikEnabled()) {
    return { status: "skipped", reason: "disabled" };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, firstName: true, lastName: true, name: true },
  });
  if (!user?.email) {
    return { status: "skipped", reason: "no-email" };
  }

  try {
    const authentikUser = await ensureAuthentikUser({
      userId: user.id,
      email: user.email,
      name: combineNameParts(user.firstName, user.lastName) ?? user.name,
    });

    if (!isManagedAuthentikUser(authentikUser)) {
      // Konto mit gleicher E-Mail, das nicht vom Mitgliederbereich stammt
      // (z. B. Infrastruktur-Admin). Passwort dort nicht überschreiben; der
      // Login über Authentik verknüpft das Konto trotzdem per E-Mail.
      console.warn(
        `[authentik] Konto ${authentikUser.username} ist nicht verwaltet, Passwort bleibt lokal`,
      );
      return {
        status: "skipped",
        reason: "unmanaged-account",
      };
    }

    await setAuthentikPassword(authentikUser, password);
    await linkAuthentikAccount(user.id, authentikUser.uid);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: null } });
    await logger.info("Passwort nach Authentik übertragen", { description: user.email });
    return { status: "migrated" };
  } catch (error) {
    console.error("[authentik] Passwort-Übertragung fehlgeschlagen", error);
    await logger.error("Passwort-Übertragung nach Authentik fehlgeschlagen", {
      description: user.email,
      error: error instanceof Error ? error.message : String(error),
    });
    return { status: "failed" };
  }
}

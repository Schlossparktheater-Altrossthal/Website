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
  hasAuthentikPasswordSinceCreation,
  isManagedAuthentikUser,
  setAuthentikPassword,
} from "@/lib/authentik/client";
import { isAuthentikEnabled } from "@/lib/authentik/config";
import { memberIdentitySelect, toMemberIdentity } from "@/lib/authentik/sync";
import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const logger = createLogger("authentik-migration");

export type PasswordMigrationResult =
  | { status: "migrated" }
  /** In Authentik gilt bereits ein neueres Passwort; der lokale Hash wurde verworfen. */
  | { status: "superseded" }
  | { status: "skipped"; reason: "disabled" | "no-email" | "unmanaged-account" }
  | { status: "failed" };

export type PasswordMigrationSource =
  /** Altes Login-Formular: Passwort nur übernehmen, wenn Authentik keins hat. */
  | "legacy-login"
  /** Passwort wurde im Mitgliederbereich bewusst neu gesetzt: immer übernehmen. */
  | "password-set";

/**
 * Setzt das Passwort in Authentik und löscht bei Erfolg den lokalen Hash.
 * Fehler werden geloggt und nicht geworfen: Der Login bzw. das Speichern im
 * Mitgliederbereich soll daran nicht scheitern, der nächste Versuch migriert.
 */
export async function migratePasswordToAuthentik(
  userId: string,
  password: string,
  source: PasswordMigrationSource,
): Promise<PasswordMigrationResult> {
  if (!isAuthentikEnabled()) {
    return { status: "skipped", reason: "disabled" };
  }

  const member = await prisma.user.findUnique({
    where: { id: userId },
    select: memberIdentitySelect,
  });
  const identity = member ? toMemberIdentity(member) : null;
  if (!identity) {
    return { status: "skipped", reason: "no-email" };
  }

  try {
    const { user: authentikUser, created } = await ensureAuthentikUser(identity);

    if (!isManagedAuthentikUser(authentikUser)) {
      // Konto mit gleicher E-Mail, das nicht vom Mitgliederbereich stammt
      // (z. B. Infrastruktur-Admin). Passwort dort nicht überschreiben; der
      // Login über Authentik verknüpft das Konto trotzdem per E-Mail.
      console.warn(
        `[authentik] Konto ${authentikUser.username} ist nicht verwaltet, Passwort bleibt lokal`,
      );
      return { status: "skipped", reason: "unmanaged-account" };
    }

    if (source === "legacy-login" && !created && hasAuthentikPasswordSinceCreation(authentikUser)) {
      // Das Mitglied hat sein Passwort bereits in Authentik gesetzt (z. B. über
      // "Passwort vergessen" auf der Authentik-Seite). Das alte Passwort aus dem
      // Mitgliederbereich darf das neuere nicht überschreiben.
      await linkAuthentikAccount(identity.userId, authentikUser.uid);
      await prisma.user.update({ where: { id: identity.userId }, data: { passwordHash: null } });
      await logger.info("Altes Passwort verworfen, Authentik-Passwort ist neuer", {
        description: identity.email,
      });
      return { status: "superseded" };
    }

    await setAuthentikPassword(authentikUser, password);
    await linkAuthentikAccount(identity.userId, authentikUser.uid);
    await prisma.user.update({ where: { id: identity.userId }, data: { passwordHash: null } });
    await logger.info("Passwort nach Authentik übertragen", { description: identity.email });
    return { status: "migrated" };
  } catch (error) {
    console.error("[authentik] Passwort-Übertragung fehlgeschlagen", error);
    await logger.error("Passwort-Übertragung nach Authentik fehlgeschlagen", {
      description: identity.email,
      error: error instanceof Error ? error.message : String(error),
    });
    return { status: "failed" };
  }
}

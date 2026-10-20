"use server";

import { revalidatePath } from "next/cache";

import { getAppBaseUrl } from "@/lib/app-url";
import { applyMailEnv, loadEffectiveMailSettings } from "@/lib/email/config";
import { renderMail } from "@/lib/email/layout";
import { queueMail, retryMail } from "@/lib/email/outbox";
import {
  stripEnvManagedFields,
  validateServerSettingsPayload,
  type FieldErrors,
} from "@/lib/email/settings-validation";
import { isMailDisabled, verifyMailTransport } from "@/lib/email/transporter";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import {
  applyServerSettingsPatch,
  formatSenderAddress,
  loadResolvedServerSettings,
  saveServerSettings,
  type ServerSettingsInput,
} from "@/lib/server-settings";
import {
  autoDetectMailServerSettings,
  type MailServerSuggestion,
} from "@/lib/server-settings-autodetect";

const PAGE_PATH = "/mitglieder/server-einstellungen";

type RawInput = Partial<Record<keyof ServerSettingsInput, unknown>>;

async function ensureAdmin() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "PRIVATE.ADMIN.SERVER.SETTINGS");
  return allowed ? session : null;
}

export type SaveServerSettingsResult =
  | { success: true }
  | {
      success: false;
      error: "not_authorized" | "validation_failed" | "update_failed";
      fieldErrors?: FieldErrors;
    };

export async function saveServerSettingsAction(input: RawInput): Promise<SaveServerSettingsResult> {
  if (!(await ensureAdmin())) return { success: false, error: "not_authorized" };

  const parsed = validateServerSettingsPayload(input);
  if (!parsed.success) {
    return { success: false, error: "validation_failed", fieldErrors: parsed.fieldErrors };
  }

  try {
    const effective = await loadEffectiveMailSettings();
    await saveServerSettings(stripEnvManagedFields(parsed.data, effective));
    revalidatePath(PAGE_PATH);
    return { success: true };
  } catch (error) {
    console.error("[server-settings] Speichern fehlgeschlagen", error);
    return { success: false, error: "update_failed" };
  }
}

export type MailActionResult =
  | { success: true; message: string }
  | { success: false; message: string; fieldErrors?: FieldErrors };

/** Verbindung prüfen – mit den Formularwerten, ohne zu speichern. Secret-Werte haben Vorrang. */
export async function testMailServerConnectionAction(input: RawInput): Promise<MailActionResult> {
  if (!(await ensureAdmin())) return { success: false, message: "Keine Berechtigung." };

  const parsed = validateServerSettingsPayload(input);
  if (!parsed.success) {
    return { success: false, message: "Bitte Eingaben prüfen.", fieldErrors: parsed.fieldErrors };
  }

  try {
    const current = await loadResolvedServerSettings();
    const { settings } = applyMailEnv(applyServerSettingsPatch(current, parsed.data));
    if (!settings.mailHost) {
      return {
        success: false,
        message: "Bitte gib einen SMTP-Server an.",
        fieldErrors: { mailHost: ["Bitte gib einen SMTP-Server an."] },
      };
    }
    await verifyMailTransport(settings);
    return { success: true, message: "Verbindung zum SMTP-Server klappt." };
  } catch (error) {
    console.error("[server-settings] SMTP-Test fehlgeschlagen", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Verbindung zum SMTP-Server konnte nicht aufgebaut werden.",
    };
  }
}

/**
 * Testmail an die eigene Adresse. Geht immer – auch mit `MAIL_DISABLED` (Staging), weil sie nur
 * an die angemeldete Person geht.
 */
export async function sendTestMailAction(): Promise<MailActionResult> {
  const session = await ensureAdmin();
  if (!session) return { success: false, message: "Keine Berechtigung." };

  const user = await prisma.user.findUnique({
    where: { id: session.user?.id ?? "" },
    select: { email: true, firstName: true, name: true },
  });
  if (!user?.email) {
    return { success: false, message: "In deinem Profil ist keine E-Mail-Adresse hinterlegt." };
  }

  const { settings, source } = await loadEffectiveMailSettings();
  const sender = formatSenderAddress(settings) ?? "–";
  const now = new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Europe/Berlin",
  }).format(new Date());

  const mail = renderMail({
    subject: "Testmail aus dem Mitgliederbereich",
    preheader: "Wenn du das liest, funktioniert der Mailversand.",
    greeting: `Hallo ${user.firstName ?? user.name ?? ""}`.trim() + ",",
    blocks: [
      { type: "paragraph", text: "wenn du das liest, funktioniert der Mailversand. 🎭" },
      {
        type: "details",
        rows: [
          ["Gesendet", now],
          ["Absender", sender],
          ["Server", `${settings.mailHost ?? "–"}:${settings.mailPort}`],
          ["Zugang aus", source === "env" ? "Secret" : "Oberfläche"],
          ...(isMailDisabled()
            ? ([["Hinweis", "Normale Mails sind hier abgeschaltet (MAIL_DISABLED)."]] as [
                string,
                string,
              ][])
            : []),
        ],
      },
      { type: "button", label: "Zu den Einstellungen", url: `${getAppBaseUrl()}${PAGE_PATH}` },
    ],
  });

  try {
    const result = await queueMail({
      kind: "test",
      to: user.email,
      userId: session.user?.id ?? null,
      mail,
      bypassDisabled: true,
    });
    revalidatePath(PAGE_PATH);
    if (result.status === "sent") {
      return { success: true, message: `Testmail an ${user.email} verschickt.` };
    }
    return {
      success: false,
      message: `Testmail ging nicht raus: ${result.error ?? "unbekannter Fehler"}`,
    };
  } catch (error) {
    console.error("[server-settings] Testmail fehlgeschlagen", error);
    return { success: false, message: "Testmail konnte nicht verschickt werden." };
  }
}

export async function retryMailAction(id: string): Promise<MailActionResult> {
  if (!(await ensureAdmin())) return { success: false, message: "Keine Berechtigung." };
  try {
    const result = await retryMail(id);
    revalidatePath(PAGE_PATH);
    if (!result) return { success: false, message: "Inhalt nicht mehr vorhanden." };
    return result.status === "sent"
      ? { success: true, message: "Mail verschickt." }
      : { success: false, message: result.error ?? "Erneut fehlgeschlagen." };
  } catch (error) {
    console.error("[server-settings] Erneut senden fehlgeschlagen", error);
    return { success: false, message: "Erneut senden fehlgeschlagen." };
  }
}

export type AutoDetectMailServerResult =
  | { success: true; suggestion: MailServerSuggestion }
  | { success: false; message: string; fieldErrors?: FieldErrors };

export async function autoDetectMailServerSettingsAction(
  input: RawInput,
): Promise<AutoDetectMailServerResult> {
  if (!(await ensureAdmin())) return { success: false, message: "Keine Berechtigung." };

  const parsed = validateServerSettingsPayload(input);
  if (!parsed.success) {
    return { success: false, message: "Bitte Eingaben prüfen.", fieldErrors: parsed.fieldErrors };
  }

  const { mailHost = null, mailFromAddress = null, mailUsername = null } = parsed.data;
  if (!mailHost && !mailFromAddress) {
    return {
      success: false,
      message: "Für die Erkennung brauchen wir die Absenderadresse oder den SMTP-Server.",
    };
  }

  const suggestion = await autoDetectMailServerSettings({
    email: mailFromAddress,
    host: mailHost,
    username: mailUsername,
  });
  return suggestion
    ? { success: true, suggestion }
    : {
        success: false,
        message: "Es konnten keine passenden SMTP-Einstellungen ermittelt werden.",
      };
}

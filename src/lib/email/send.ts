import { formatSenderAddress } from "@/lib/server-settings";

import { loadEffectiveMailSettings } from "./config";
import { renderMail, renderPlainTextMail, type MailContent } from "./layout";
import { queueMail, type MailKind } from "./outbox";
import { isMailDisabled } from "./transporter";

export type OutgoingMail = {
  to: string;
  subject: string;
  /** Reiner Text (Altbestand); wird ins Layout übernommen. */
  text: string;
  /** Bausteine fürs Layout – ersetzt `text`, wenn gesetzt. */
  content?: Omit<MailContent, "subject">;
  kind?: MailKind;
  userId?: string | null;
  headers?: Record<string, string>;
};

export type MailSender = (mail: OutgoingMail) => Promise<void>;

/** Ist ein Versand möglich (SMTP + Absender, nicht abgeschaltet)? */
export async function isMailConfigured(): Promise<boolean> {
  if (isMailDisabled()) return false;
  const { settings } = await loadEffectiveMailSettings();
  return Boolean(settings.mailHost && formatSenderAddress(settings));
}

/**
 * Liefert einen Versender oder `null`, wenn kein Mailserver bzw. Absender konfiguriert ist (oder
 * `MAIL_DISABLED`). Jede Mail läuft über die Outbox: Scheitert der erste Versuch, wird sie später
 * wiederholt – der Aufruf gilt dann trotzdem als angenommen.
 */
export async function createConfiguredMailSender(): Promise<MailSender | null> {
  if (!(await isMailConfigured())) return null;
  return async (mail) => {
    const rendered = mail.content
      ? renderMail({ ...mail.content, subject: mail.subject })
      : renderPlainTextMail(mail.subject, mail.text);
    const result = await queueMail({
      kind: mail.kind ?? "system",
      to: mail.to,
      userId: mail.userId,
      mail: rendered,
      headers: mail.headers,
    });
    if (result.status === "failed" || result.status === "blocked") {
      throw new Error(result.error ?? "Mail konnte nicht verschickt werden.");
    }
  };
}

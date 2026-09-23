import { formatSenderAddress, loadResolvedServerSettings } from "@/lib/server-settings";

import { createTransporterFromSettings } from "./transporter";

export type OutgoingMail = {
  to: string;
  subject: string;
  text: string;
};

export type MailSender = (mail: OutgoingMail) => Promise<void>;

/**
 * Liefert einen Versender mit den SMTP-Daten aus den Server-Einstellungen oder `null`,
 * wenn kein Mailserver bzw. Absender konfiguriert ist.
 */
export async function createConfiguredMailSender(): Promise<MailSender | null> {
  const settings = await loadResolvedServerSettings();
  const from = formatSenderAddress(settings);
  if (!settings.mailHost || !from) {
    return null;
  }
  const transporter = createTransporterFromSettings(settings);
  return async (mail) => {
    await transporter.sendMail({
      from,
      replyTo: settings.mailReplyTo ?? undefined,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
    });
  };
}

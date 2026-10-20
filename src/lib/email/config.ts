import {
  DEFAULT_MAIL_PORT,
  loadResolvedServerSettings,
  type ResolvedServerSettings,
} from "@/lib/server-settings";

/**
 * SMTP-Zugang: Ist `MAIL_HOST` gesetzt (Secret aus Vault), gilt der Server-Block aus der Umgebung
 * und ist in der Oberfläche nur lesbar. Absenderfelder gelten einzeln – Umgebung vor Datenbank.
 */
export type MailConfigSource = "env" | "database";

export type MailSenderField = "mailFromAddress" | "mailFromName" | "mailReplyTo";

export type EffectiveMailSettings = {
  settings: ResolvedServerSettings;
  /** Woher Server und Zugangsdaten kommen. */
  source: MailConfigSource;
  /** Absenderfelder, die aus der Umgebung kommen und daher nicht änderbar sind. */
  envSenderFields: MailSenderField[];
};

function env(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function envBoolean(name: string, fallback: boolean) {
  const value = env(name)?.toLowerCase();
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value);
}

function envPort(fallback: number) {
  const value = Number(env("MAIL_PORT"));
  return Number.isInteger(value) && value > 0 && value < 65536 ? value : fallback;
}

/** Legt die Umgebungswerte über die Werte aus der Datenbank (rein, für Tests). */
export function applyMailEnv(base: ResolvedServerSettings): EffectiveMailSettings {
  const host = env("MAIL_HOST");
  const settings: ResolvedServerSettings = { ...base };
  let source: MailConfigSource = "database";

  if (host) {
    source = "env";
    const port = envPort(DEFAULT_MAIL_PORT);
    settings.mailHost = host;
    settings.mailPort = port;
    settings.mailSecure = envBoolean("MAIL_SECURE", port === 465);
    settings.mailUsername = env("MAIL_USERNAME");
    settings.mailPassword = env("MAIL_PASSWORD");
  }

  const envSenderFields: MailSenderField[] = [];
  const senderEnv: Record<MailSenderField, string> = {
    mailFromAddress: "MAIL_FROM_ADDRESS",
    mailFromName: "MAIL_FROM_NAME",
    mailReplyTo: "MAIL_REPLY_TO",
  };
  for (const [field, name] of Object.entries(senderEnv) as [MailSenderField, string][]) {
    const value = env(name);
    if (value) {
      settings[field] = value;
      envSenderFields.push(field);
    }
  }

  return { settings, source, envSenderFields };
}

export async function loadEffectiveMailSettings(): Promise<EffectiveMailSettings> {
  return applyMailEnv(await loadResolvedServerSettings());
}

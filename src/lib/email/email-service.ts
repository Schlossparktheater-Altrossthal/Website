export type EmailService = {
  to: string;
  subject: string;
  html: string;
};

type SendGridModule = {
  setApiKey(apiKey: string | undefined): void;
  send(data: { to: string; from?: string; subject: string; html: string }): Promise<unknown>;
};

function isSendGridModule(value: unknown): value is SendGridModule {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { setApiKey?: unknown }).setApiKey === 'function' &&
    typeof (value as { send?: unknown }).send === 'function'
  );
}

// Diese Funktion muss je nach gewähltem E-Mail-Service implementiert werden
// (z.B. SendGrid, Amazon SES, etc.)
export async function sendEmail({ to, subject, html }: EmailService): Promise<void> {
  if (process.env.EMAIL_SERVICE === 'sendgrid') {
    const importedModule = (await import('@sendgrid/mail')) as unknown;
    const candidate =
      typeof importedModule === 'object' && importedModule !== null && 'default' in importedModule
        ? (importedModule as { default: unknown }).default
        : importedModule;

    if (!isSendGridModule(candidate)) {
      throw new Error('SendGrid Modul konnte nicht geladen werden');
    }

    candidate.setApiKey(process.env.SENDGRID_API_KEY);

    await candidate.send({
      to,
      from: process.env.EMAIL_FROM,
      subject,
      html,
    });
  } else {
    // Andere E-Mail-Service-Implementierungen hier...
    throw new Error('Kein E-Mail-Service konfiguriert');
  }
}
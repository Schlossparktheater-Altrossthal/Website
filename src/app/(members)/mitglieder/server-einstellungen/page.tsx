import { loadEffectiveMailSettings } from "@/lib/email/config";
import { readMailOverview } from "@/lib/email/outbox";
import { isMailDisabled } from "@/lib/email/transporter";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { formatSenderAddress, readServerSettings } from "@/lib/server-settings";

import { MailSettings, type MailSettingsData } from "./mail-settings";

export default async function ServerSettingsPage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "PRIVATE.ADMIN.SERVER.SETTINGS");

  if (!allowed) {
    return (
      <div className="space-y-6">
        <div className="text-sm text-muted-foreground">
          Kein Zugriff auf die Servereinstellungen.
        </div>
      </div>
    );
  }

  let data: MailSettingsData;
  try {
    const [effective, record, overview, me] = await Promise.all([
      loadEffectiveMailSettings(),
      readServerSettings(),
      readMailOverview(),
      prisma.user.findUnique({ where: { id: session.user?.id ?? "" }, select: { email: true } }),
    ]);
    const { settings } = effective;
    data = {
      source: effective.source,
      envSenderFields: effective.envSenderFields,
      disabled: isMailDisabled(),
      configured: Boolean(settings.mailHost && formatSenderAddress(settings)),
      myEmail: me?.email ?? null,
      // Formular zeigt die gespeicherten Werte; Secret-Werte nur zur Anzeige.
      form: {
        mailHost: record?.mailHost ?? "",
        mailPort: String(record?.mailPort ?? 587),
        mailSecure: record?.mailSecure ?? false,
        mailUsername: record?.mailUsername ?? "",
        mailFromAddress: record?.mailFromAddress ?? "",
        mailFromName: record?.mailFromName ?? "",
        mailReplyTo: record?.mailReplyTo ?? "",
        passwordSet: Boolean(record?.mailPassword),
      },
      effective: {
        mailHost: settings.mailHost ?? "",
        mailPort: settings.mailPort,
        mailSecure: settings.mailSecure,
        mailUsername: settings.mailUsername ?? "",
        passwordSet: Boolean(settings.mailPassword),
        mailFromAddress: settings.mailFromAddress ?? "",
        mailFromName: settings.mailFromName ?? "",
        mailReplyTo: settings.mailReplyTo ?? "",
        sender: formatSenderAddress(settings),
      },
      overview: {
        lastSentAt: overview.lastSentAt?.toISOString() ?? null,
        sent7: overview.sent7,
        failed7: overview.failed7,
        pending: overview.pending,
        blocked7: overview.blocked7,
        recent: overview.recent.map((row) => ({
          ...row,
          sentAt: row.sentAt?.toISOString() ?? null,
          createdAt: row.createdAt.toISOString(),
          nextAttemptAt: row.nextAttemptAt.toISOString(),
        })),
      },
    };
  } catch (error) {
    console.error("[server-settings] Laden fehlgeschlagen", error);
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Servereinstellungen konnten nicht geladen werden.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">E-Mail-Versand</h1>
        <p className="text-sm text-muted-foreground">
          Zustand des Mailversands, Testmail und Verlauf. Die Zugangsdaten kommen aus dem Secret
          oder werden hier eingetragen.
        </p>
      </div>
      <MailSettings data={data} />
    </div>
  );
}

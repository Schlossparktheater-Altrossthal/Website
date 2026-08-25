import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import {
  loadResolvedServerSettings,
  toClientServerSettings,
  type ClientServerSettings,
} from "@/lib/server-settings";

import { ServerSettingsContent } from "./server-settings-content";

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

  if (!process.env.DATABASE_URL) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Die Datenbank ist nicht konfiguriert. Servereinstellungen können nicht geladen werden.
        </div>
      </div>
    );
  }

  try {
    const resolved = await loadResolvedServerSettings();
    const clientSettings: ClientServerSettings = toClientServerSettings(resolved);

    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Servereinstellungen</h1>
          <p className="text-sm text-muted-foreground">
            Hinterlege den SMTP-Server für Systemnachrichten und teste die Verbindung direkt aus dem
            Backend.
          </p>
        </div>
        <ServerSettingsContent initialSettings={clientSettings} />
      </div>
    );
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
}

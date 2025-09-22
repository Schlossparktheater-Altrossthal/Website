import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import {
  ensureWebsiteSettingsRecord,
  resolveWebsiteSettings,
  toClientWebsiteSettings,
} from "@/lib/website-settings";

import { WebsiteThemeSettingsManager } from "./theme-settings-manager";

export default async function WebsiteSettingsPage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.website.settings");

  if (!allowed) {
    return <div className="text-sm text-muted-foreground">Kein Zugriff auf die Website-Einstellungen.</div>;
  }

  if (!process.env.DATABASE_URL) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        Die Datenbank ist nicht konfiguriert. Website-Einstellungen können nicht geladen werden.
      </div>
    );
  }

  try {
    const record = await ensureWebsiteSettingsRecord();
    const resolved = resolveWebsiteSettings(record);
    const clientSettings = toClientWebsiteSettings(resolved);

    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Website & Theme</h1>
          <p className="text-sm text-muted-foreground">
            Passe Farben, Branding und Darstellung der öffentlichen Website an. Änderungen werden sofort im aktuellen Fenster sichtbar.
          </p>
        </div>
        <WebsiteThemeSettingsManager initialSettings={clientSettings} />
      </div>
    );
  } catch (error) {
    console.error("Failed to load website settings", error);
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        Website-Einstellungen konnten nicht geladen werden.
      </div>
    );
  }
}

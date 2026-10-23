import { PageHeader } from "@/components/members/page-header";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import {
  ensureWebsiteSettingsRecord,
  ensurePresetWebsiteThemes,
  listWebsiteThemes,
  resolveWebsiteSettings,
  toClientWebsiteSettings,
} from "@/lib/website-settings";

import { WebsiteThemeSettingsManager } from "./theme-settings-manager";

export default async function WebsiteSettingsPage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "PRIVATE.SETTINGS.THEME.MANAGE");

  if (!allowed) {
    return (
      <div className="space-y-6">
        <div className="text-sm text-muted-foreground">
          Kein Zugriff auf die Website-Einstellungen.
        </div>
      </div>
    );
  }

  if (!process.env.DATABASE_URL) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Die Datenbank ist nicht konfiguriert. Website-Einstellungen können nicht geladen werden.
        </div>
      </div>
    );
  }

  let resolved: ReturnType<typeof resolveWebsiteSettings>;
  let clientSettings: ReturnType<typeof toClientWebsiteSettings>;
  let themes: Awaited<ReturnType<typeof listWebsiteThemes>>;

  try {
    await ensurePresetWebsiteThemes();
    const record = await ensureWebsiteSettingsRecord();
    resolved = resolveWebsiteSettings(record);
    clientSettings = toClientWebsiteSettings(resolved);
    themes = await listWebsiteThemes();
  } catch (error) {
    console.error("Failed to load website settings", error);
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Website-Einstellungen konnten nicht geladen werden.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Website & Theme"
        description="Farben und Darstellung des Mitgliederbereichs für alle festlegen."
      />
      <WebsiteThemeSettingsManager initialSettings={clientSettings} initialThemes={themes} />
    </div>
  );
}

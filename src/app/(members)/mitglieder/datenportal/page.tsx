import { resolvePortalAccess } from "@/lib/datenportal/access";
import { allowedFields, DATA_SOURCES } from "@/lib/datenportal/fields";
import { ensurePermissionDefinitions } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

import { DataPortalClient, type PortalShow } from "./data-portal-client";

export default async function DatenportalPage() {
  const session = await requireAuth();
  await ensurePermissionDefinitions();

  const shows = await prisma.show.findMany({
    orderBy: { year: "desc" },
    select: { id: true, title: true, year: true },
  });
  const accessible: PortalShow[] = [];
  for (const show of shows) {
    const access = await resolvePortalAccess(session.user, show.id);
    if (!access.canView) continue;
    const sources = DATA_SOURCES.filter(
      (source) => allowedFields(source, access.grants).length > 0,
    );
    accessible.push({
      id: show.id,
      label: show.title?.trim() || `Produktion ${show.year}`,
      canExport: access.canExport,
      fields: Object.fromEntries(
        sources.map((source) => [
          source,
          allowedFields(source, access.grants).map((field) => ({
            key: field.key,
            label: field.label,
            group: field.group,
            type: field.type,
          })),
        ]),
      ),
    });
  }

  if (accessible.length === 0) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-border/70 bg-background/60 p-6 text-sm text-muted-foreground">
          Du hast keinen Zugriff auf das Datenportal.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Datenportal</h1>
        <p className="text-sm text-muted-foreground">
          Auswertungen zu Teilnehmenden einer Produktion. Abfragen und Exporte werden protokolliert
          (Aufbewahrung des Protokolls: 12 Monate). Personenbezogene Daten nur für den vorgesehenen
          Zweck nutzen und Exporte nach Gebrauch löschen.
        </p>
      </div>
      <DataPortalClient shows={accessible} />
    </div>
  );
}

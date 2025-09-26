import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/members/page-header";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import {
  formatFileLibraryFileSize,
  resolveFileLibraryAccessContext,
  userHasFileLibraryAccess,
} from "@/lib/file-library";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import { FileLibraryAccessTargetType } from "@prisma/client";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { formatRelativeWithAbsolute } from "@/lib/datetime";
import { createFileLibraryFolder } from "./actions";

export const metadata: Metadata = {
  title: "Dateisystem",
  description:
    "Verwalte gemeinsame Dokumente, teile Dateien in strukturierten Ordnern und steuere zielgerichtete Freigaben für das Ensemble.",
};

function summarizeViewAccess(
  folder: {
    allowAllView: boolean;
    accessRules: { targetType: FileLibraryAccessTargetType; systemRole: Role | null; appRoleId: string | null }[];
  },
  appRoleNames: Map<string, string>,
) {
  if (folder.allowAllView) {
    return "Alle Mitglieder";
  }
  const entries = folder.accessRules
    .filter((rule) => rule.targetType === FileLibraryAccessTargetType.SYSTEM_ROLE)
    .map((rule) => {
      const label = rule.systemRole ? ROLE_LABELS[rule.systemRole] : null;
      return label ?? rule.systemRole ?? "Unbekannte Rolle";
    });
  const appRoleEntries = folder.accessRules
    .filter((rule) => rule.targetType === FileLibraryAccessTargetType.APP_ROLE)
    .map((rule) => (rule.appRoleId ? appRoleNames.get(rule.appRoleId) ?? "Unbenannte Gruppe" : "Unbenannte Gruppe"));
  const labels = [...entries, ...appRoleEntries];
  if (!labels.length) {
    return "Keine Freigaben";
  }
  return labels.join(", ");
}

const latestFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatLatest(date: Date | null) {
  if (!date) {
    return "Noch keine Uploads";
  }
  return formatRelativeWithAbsolute(date, {
    absoluteFormatter: latestFormatter,
  }).combined;
}

export default async function FileLibraryOverviewPage() {
  const session = await requireAuth();
  const canAccess = await hasPermission(session.user, "mitglieder.dateisystem");
  const baseBreadcrumb = membersNavigationBreadcrumb("/mitglieder/dateisystem");

  if (!canAccess) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Dateisystem"
          description="Du benötigst eine zusätzliche Freigabe, um auf das Dateisystem zugreifen zu können."
          breadcrumbs={baseBreadcrumb ? [baseBreadcrumb] : []}
        />
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">
            Ohne entsprechende Berechtigung bleibt das Dateisystem im Mitgliederbereich ausgeblendet.
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentUser = session.user ?? { id: null };
  const accessContext = await resolveFileLibraryAccessContext(currentUser);

  const [folders, appRoles] = await Promise.all([
    prisma.fileLibraryFolder.findMany({
      where: { parentId: null },
      include: {
        accessRules: true,
        files: { select: { id: true, fileSize: true, createdAt: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.appRole.findMany({ orderBy: { sortIndex: "asc" }, select: { id: true, name: true } }),
  ]);

  const appRoleNames = new Map(appRoles.map((role) => [role.id, role.name ?? "Unbenannte Gruppe"]));

  const accessible = [] as {
    id: string;
    name: string;
    description: string | null;
    fileCount: number;
    totalSize: number;
    latestUpload: Date | null;
    accessLabel: string;
  }[];

  for (const folder of folders) {
    const canViewFolder = await userHasFileLibraryAccess(currentUser, folder, "view", accessContext);
    if (!canViewFolder) continue;

    let totalSize = 0;
    let latest: Date | null = null;
    for (const file of folder.files) {
      totalSize += file.fileSize;
      const created = new Date(file.createdAt);
      if (!latest || created > latest) {
        latest = created;
      }
    }

    accessible.push({
      id: folder.id,
      name: folder.name,
      description: folder.description,
      fileCount: folder.files.length,
      totalSize,
      latestUpload: latest,
      accessLabel: summarizeViewAccess(folder, appRoleNames),
    });
  }

  const canManage = accessContext.canManage;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dateisystem"
        description="Organisiere Dateien in strukturierten Ordnern, teile Unterlagen mit ausgewählten Rollen und behalte Freigaben im Blick."
        breadcrumbs={baseBreadcrumb ? [baseBreadcrumb] : []}
      />

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Neuen Hauptordner anlegen</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createFileLibraryFolder} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="file-library-name">Name</Label>
                <Input id="file-library-name" name="name" required maxLength={120} placeholder="z. B. Verträge" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="file-library-description">Beschreibung (optional)</Label>
                <Textarea
                  id="file-library-description"
                  name="description"
                  maxLength={500}
                  placeholder="Kurze Hinweise zum Inhalt des Ordners"
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit">Ordner erstellen</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {accessible.length ? (
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {accessible.map((folder) => (
            <Card key={folder.id} className="flex h-full flex-col justify-between">
              <CardHeader className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-lg font-semibold">{folder.name}</CardTitle>
                  <Badge variant="outline">{folder.fileCount} Dateien</Badge>
                </div>
                {folder.description ? (
                  <p className="text-sm text-muted-foreground">{folder.description}</p>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>
                    Speicher: <span className="text-foreground">{formatFileLibraryFileSize(folder.totalSize)}</span>
                  </p>
                  <p>Letztes Update: {formatLatest(folder.latestUpload)}</p>
                  <p>Zugriff: {folder.accessLabel}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button asChild>
                    <Link href={`/mitglieder/dateisystem/${folder.id}`}>Ordner öffnen</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">
            Aktuell sind keine freigegebenen Ordner sichtbar. Bitte wende dich an das Admin-Team, wenn du Zugriff benötigst.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

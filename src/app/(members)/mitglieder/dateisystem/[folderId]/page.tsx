import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/members/page-header";
import { FileLibraryManager, type FileLibraryItemEntry } from "@/components/members/file-library/file-library-manager";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import {
  computeFolderStats,
  formatFileLibraryFileSize,
  getFolderBreadcrumb,
  loadFolderItems,
  loadFolderWithDetails,
  resolveFileLibraryAccessContext,
  userHasFileLibraryAccess,
} from "@/lib/file-library";
import { createMembersBreadcrumbItems, membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { formatRelativeWithAbsolute } from "@/lib/datetime";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/roles";
import { FileLibraryAccessTargetType, FileLibraryAccessType } from "@prisma/client";
import { createFileLibraryFolder, updateFileLibraryPermissions } from "../actions";

const latestFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

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
    .map((rule) => (rule.systemRole ? ROLE_LABELS[rule.systemRole] ?? rule.systemRole : "Unbekannte Rolle"));
  const appRoleEntries = folder.accessRules
    .filter((rule) => rule.targetType === FileLibraryAccessTargetType.APP_ROLE)
    .map((rule) => (rule.appRoleId ? appRoleNames.get(rule.appRoleId) ?? "Unbenannte Gruppe" : "Unbenannte Gruppe"));
  const labels = [...entries, ...appRoleEntries];
  if (!labels.length) {
    return "Keine Freigaben";
  }
  return labels.join(", ");
}

function formatLatest(date: Date | null) {
  if (!date) {
    return "Noch keine Uploads";
  }
  return formatRelativeWithAbsolute(date, {
    absoluteFormatter: latestFormatter,
  }).combined;
}

function collectRoleSet(
  rules: {
    accessType: FileLibraryAccessType;
    targetType: FileLibraryAccessTargetType;
    systemRole: Role | null;
    appRoleId: string | null;
  }[],
  type: FileLibraryAccessType,
  target: FileLibraryAccessTargetType,
) {
  return new Set(
    rules
      .filter((rule) => rule.accessType === type && rule.targetType === target)
      .map((rule) => (target === FileLibraryAccessTargetType.SYSTEM_ROLE ? rule.systemRole : rule.appRoleId))
      .filter((value): value is string | Role => Boolean(value)),
  );
}

export default async function FileLibraryFolderPage({
  params,
}: {
  params: Promise<{ folderId: string }>;
}) {
  const { folderId } = await params;
  if (!folderId) {
    notFound();
  }

  const session = await requireAuth();
  const canAccess = await hasPermission(session.user, "mitglieder.dateisystem");
  const baseBreadcrumb = membersNavigationBreadcrumb("/mitglieder/dateisystem");

  if (!canAccess) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Dateisystem"
          description="Du benötigst eine zusätzliche Freigabe, um diesen Ordner zu öffnen."
          breadcrumbs={baseBreadcrumb ? [baseBreadcrumb] : []}
          actions={
            <Button asChild variant="outline">
              <Link href="/mitglieder/dateisystem">
                <ArrowLeft className="mr-2 h-4 w-4" /> Zur Übersicht
              </Link>
            </Button>
          }
        />
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">
            Bitte kontaktiere das Admin-Team, um Zugriff auf das Dateisystem zu erhalten.
          </CardContent>
        </Card>
      </div>
    );
  }

  const folder = await loadFolderWithDetails(folderId);
  if (!folder) {
    notFound();
  }

  const currentUser = session.user ?? { id: null };
  const accessContext = await resolveFileLibraryAccessContext(currentUser);
  const canViewFolder = await userHasFileLibraryAccess(currentUser, folder, "view", accessContext);

  const trail = await getFolderBreadcrumb(folder.id);
  const breadcrumbs = [baseBreadcrumb, ...trail.map((entry) => ({ id: entry.id, label: entry.name }))].filter(Boolean);
  const breadcrumbItems = createMembersBreadcrumbItems(
    breadcrumbs.map((entry, index) => {
      if (!entry) return null;
      const href =
        index === 0
          ? (entry as { href?: string }).href ?? "/mitglieder/dateisystem"
          : `/mitglieder/dateisystem/${entry.id}`;
      const isCurrent = index === breadcrumbs.length - 1;
      return {
        id: `folder-${entry.id ?? href}`,
        label: entry.label,
        href: isCurrent ? undefined : href,
        isCurrent,
      };
    }),
  );

  if (!canViewFolder) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={folder.name}
          description="Dir fehlt die Freigabe, um diesen Ordner einzusehen."
          breadcrumbs={breadcrumbItems}
          actions={
            <Button asChild variant="outline">
              <Link href="/mitglieder/dateisystem">
                <ArrowLeft className="mr-2 h-4 w-4" /> Zur Übersicht
              </Link>
            </Button>
          }
        />
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">
            Frage bitte im Admin-Team nach einer entsprechenden Freigabe.
          </CardContent>
        </Card>
      </div>
    );
  }

  const [rawItems, appRoles] = await Promise.all([
    loadFolderItems(folder.id),
    prisma.appRole.findMany({ orderBy: { sortIndex: "asc" }, select: { id: true, name: true } }),
  ]);

  const canUpload = await userHasFileLibraryAccess(currentUser, folder, "upload", accessContext);
  const canDownload = await userHasFileLibraryAccess(currentUser, folder, "download", accessContext);
  const canManage = accessContext.canManage;
  const userId = session.user?.id ?? "";

  const initialItems: FileLibraryItemEntry[] = rawItems.map((item) => ({
    id: item.id,
    fileName: item.fileName,
    mimeType: item.mimeType,
    fileSize: item.fileSize,
    description: item.description ?? null,
    createdAt: item.createdAt.toISOString(),
    uploadedBy: item.uploadedBy
      ? { id: item.uploadedBy.id, name: item.uploadedBy.name, email: item.uploadedBy.email }
      : null,
    downloadUrl: `/api/file-library/items/${item.id}/file`,
    canDelete: canManage || item.uploadedById === userId,
  }));

  const stats = computeFolderStats(
    rawItems.map((item) => ({
      id: item.id,
      fileName: item.fileName,
      mimeType: item.mimeType,
      fileSize: item.fileSize,
      description: item.description ?? null,
      uploadedById: item.uploadedById,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      uploadedBy: item.uploadedBy,
    })),
  );

  const appRoleNames = new Map(appRoles.map((role) => [role.id, role.name ?? "Unbenannte Gruppe"]));

  const viewSystemRoles = collectRoleSet(folder.accessRules, FileLibraryAccessType.VIEW, FileLibraryAccessTargetType.SYSTEM_ROLE) as Set<Role>;
  const downloadSystemRoles = collectRoleSet(
    folder.accessRules,
    FileLibraryAccessType.DOWNLOAD,
    FileLibraryAccessTargetType.SYSTEM_ROLE,
  ) as Set<Role>;
  const uploadSystemRoles = collectRoleSet(
    folder.accessRules,
    FileLibraryAccessType.UPLOAD,
    FileLibraryAccessTargetType.SYSTEM_ROLE,
  ) as Set<Role>;

  const viewAppRoles = collectRoleSet(
    folder.accessRules,
    FileLibraryAccessType.VIEW,
    FileLibraryAccessTargetType.APP_ROLE,
  ) as Set<string>;
  const downloadAppRoles = collectRoleSet(
    folder.accessRules,
    FileLibraryAccessType.DOWNLOAD,
    FileLibraryAccessTargetType.APP_ROLE,
  ) as Set<string>;
  const uploadAppRoles = collectRoleSet(
    folder.accessRules,
    FileLibraryAccessType.UPLOAD,
    FileLibraryAccessTargetType.APP_ROLE,
  ) as Set<string>;

  const childFolders = [] as {
    id: string;
    name: string;
    description: string | null;
    fileCount: number;
    totalSize: number;
    latestUpload: Date | null;
    accessLabel: string;
  }[];

  for (const child of folder.children) {
    const canViewChild = await userHasFileLibraryAccess(currentUser, child, "view", accessContext);
    if (!canViewChild) continue;

    let totalSize = 0;
    let latest: Date | null = null;
    for (const file of child.files) {
      totalSize += file.fileSize;
      const created = new Date(file.createdAt);
      if (!latest || created > latest) {
        latest = created;
      }
    }

    childFolders.push({
      id: child.id,
      name: child.name,
      description: child.description,
      fileCount: child.files.length,
      totalSize,
      latestUpload: latest,
      accessLabel: summarizeViewAccess(child, appRoleNames),
    });
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={folder.name}
        description={folder.description ?? ""}
        breadcrumbs={breadcrumbItems}
        actions={
          <Button asChild variant="outline">
            <Link href="/mitglieder/dateisystem">
              <ArrowLeft className="mr-2 h-4 w-4" /> Zur Übersicht
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[2fr,3fr]">
        <Card>
          <CardHeader>
            <CardTitle>Ordnerinformationen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Dateien: <span className="text-foreground">{stats.fileCount}</span>
            </p>
            <p>
              Gesamtgröße: <span className="text-foreground">{formatFileLibraryFileSize(stats.totalSize)}</span>
            </p>
            <p>Letztes Update: {formatLatest(stats.latestUpload)}</p>
            <p>
              Uploads erlaubt:{" "}
              {folder.allowAllUpload
                ? "Alle Mitglieder"
                : uploadSystemRoles.size + uploadAppRoles.size > 0
                  ? `${uploadSystemRoles.size + uploadAppRoles.size} definierte Freigaben`
                  : "Keine"}
            </p>
            <p>
              Downloads erlaubt:{" "}
              {folder.allowAllDownload
                ? "Alle Mitglieder"
                : downloadSystemRoles.size + downloadAppRoles.size > 0
                  ? `${downloadSystemRoles.size + downloadAppRoles.size} definierte Freigaben`
                  : "Keine"}
            </p>
            <p>Zugriff sichtbar: {summarizeViewAccess(folder, appRoleNames)}</p>
          </CardContent>
        </Card>

        {canManage ? (
          <Card>
            <CardHeader>
              <CardTitle>Unterordner erstellen</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createFileLibraryFolder} className="space-y-4">
                <input type="hidden" name="parentId" value={folder.id} />
                <div className="grid gap-2">
                  <Label htmlFor="subfolder-name">Name</Label>
                  <Input id="subfolder-name" name="name" required maxLength={120} placeholder="z. B. Verträge" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="subfolder-description">Beschreibung (optional)</Label>
                  <Textarea
                    id="subfolder-description"
                    name="description"
                    maxLength={500}
                    placeholder="Kurze Hinweise zum Ordnerinhalt"
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit">Unterordner anlegen</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {childFolders.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Unterordner</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {childFolders.map((child) => (
                <Card key={child.id} className="flex h-full flex-col justify-between border border-border/60">
                  <CardHeader className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-base font-semibold">{child.name}</CardTitle>
                      <Badge variant="outline">{child.fileCount} Dateien</Badge>
                    </div>
                    {child.description ? (
                      <p className="text-sm text-muted-foreground">{child.description}</p>
                    ) : null}
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>Speicher: {formatFileLibraryFileSize(child.totalSize)}</p>
                    <p>Letztes Update: {formatLatest(child.latestUpload)}</p>
                    <p>Zugriff: {child.accessLabel}</p>
                    <Button asChild>
                      <Link href={`/mitglieder/dateisystem/${child.id}`}>Ordner öffnen</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Zugriffsrechte verwalten</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateFileLibraryPermissions} className="space-y-6">
              <input type="hidden" name="folderId" value={folder.id} />
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="font-semibold">Ansehen</Label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="allowAllView" defaultChecked={folder.allowAllView} className="h-4 w-4" />
                    Alle Mitglieder dürfen diesen Ordner sehen
                  </label>
                  <div className="grid gap-2 pl-1 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Systemrollen</p>
                    <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                      {ROLES.map((role) => (
                        <label key={`view-${role}`} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            name="viewSystemRoles"
                            value={role}
                            defaultChecked={viewSystemRoles.has(role)}
                            className="h-4 w-4"
                          />
                          {ROLE_LABELS[role] ?? role}
                        </label>
                      ))}
                    </div>
                    <p className="font-medium text-foreground">Gruppenrollen</p>
                    <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                      {appRoles.map((role) => (
                        <label key={`view-app-${role.id}`} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            name="viewAppRoles"
                            value={role.id}
                            defaultChecked={viewAppRoles.has(role.id)}
                            className="h-4 w-4"
                          />
                          {role.name ?? "Unbenannte Gruppe"}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="font-semibold">Downloads</Label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="allowAllDownload"
                      defaultChecked={folder.allowAllDownload}
                      className="h-4 w-4"
                    />
                    Alle Mitglieder dürfen Dateien herunterladen
                  </label>
                  <div className="grid gap-2 pl-1 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Systemrollen</p>
                    <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                      {ROLES.map((role) => (
                        <label key={`download-${role}`} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            name="downloadSystemRoles"
                            value={role}
                            defaultChecked={downloadSystemRoles.has(role)}
                            className="h-4 w-4"
                          />
                          {ROLE_LABELS[role] ?? role}
                        </label>
                      ))}
                    </div>
                    <p className="font-medium text-foreground">Gruppenrollen</p>
                    <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                      {appRoles.map((role) => (
                        <label key={`download-app-${role.id}`} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            name="downloadAppRoles"
                            value={role.id}
                            defaultChecked={downloadAppRoles.has(role.id)}
                            className="h-4 w-4"
                          />
                          {role.name ?? "Unbenannte Gruppe"}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="font-semibold">Uploads</Label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="allowAllUpload"
                      defaultChecked={folder.allowAllUpload}
                      className="h-4 w-4"
                    />
                    Alle Mitglieder dürfen Dateien hochladen
                  </label>
                  <div className="grid gap-2 pl-1 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Systemrollen</p>
                    <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                      {ROLES.map((role) => (
                        <label key={`upload-${role}`} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            name="uploadSystemRoles"
                            value={role}
                            defaultChecked={uploadSystemRoles.has(role)}
                            className="h-4 w-4"
                          />
                          {ROLE_LABELS[role] ?? role}
                        </label>
                      ))}
                    </div>
                    <p className="font-medium text-foreground">Gruppenrollen</p>
                    <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                      {appRoles.map((role) => (
                        <label key={`upload-app-${role.id}`} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            name="uploadAppRoles"
                            value={role.id}
                            defaultChecked={uploadAppRoles.has(role.id)}
                            className="h-4 w-4"
                          />
                          {role.name ?? "Unbenannte Gruppe"}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit">Speichern</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <FileLibraryManager
        folderId={folder.id}
        canUpload={canUpload}
        canDownload={canDownload}
        canManage={canManage}
        initialItems={initialItems}
      />
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/members/page-header";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { formatRelativeWithAbsolute } from "@/lib/datetime";
import {
  GALLERY_START_YEAR,
  createGalleryYearRange,
  formatGalleryFileSize,
  getGalleryYearDescription,
} from "@/lib/gallery";
import { GalleryMediaType } from "@prisma/client";

export const metadata: Metadata = {
  title: "Archiv und Bilder",
  description:
    "Pflege Jahrgangsordner mit Fotos und Videos der vergangenen Spielzeiten und organisiere gemeinsam das Ensemble-Archiv.",
};

type FolderStats = {
  year: number;
  imageCount: number;
  videoCount: number;
  totalCount: number;
  latestUpload: Date | null;
  totalSize: number;
};

const latestUploadFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatRelative(date: Date | null) {
  if (!date) {
    return "Noch keine Uploads";
  }
  return formatRelativeWithAbsolute(date, { absoluteFormatter: latestUploadFormatter }).combined;
}

export default async function ArchiveOverviewPage() {
  const session = await requireAuth();
  const [canView, canUpload, canModerate] = await Promise.all([
    hasPermission(session.user, "mitglieder.galerie"),
    hasPermission(session.user, "mitglieder.galerie.upload"),
    hasPermission(session.user, "mitglieder.galerie.delete"),
  ]);

  if (!canView) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Archiv und Bilder"
          description="Du benötigst eine spezielle Berechtigung, um auf das Archiv zuzugreifen. Bitte wende dich an das Team für die Freischaltung."
        />
        <Card>
          <CardContent className="py-10 text-sm text-muted-foreground">
            Ohne Freigabe ist das Archiv im Mitgliederbereich nicht sichtbar.
          </CardContent>
        </Card>
      </div>
    );
  }

  const years = createGalleryYearRange(GALLERY_START_YEAR);
  const currentYear = years[0] ?? new Date().getFullYear();

  const [countsRaw, latestRaw, sizesRaw] = await Promise.all([
    prisma.galleryItem.groupBy({
      by: ["year", "mediaType"],
      _count: { _all: true },
    }),
    prisma.galleryItem.groupBy({
      by: ["year"],
      _max: { createdAt: true },
    }),
    prisma.galleryItem.groupBy({
      by: ["year"],
      _sum: { fileSize: true },
    }),
  ]);

  const statsByYear = new Map<number, FolderStats>();
  years.forEach((year) => {
    statsByYear.set(year, {
      year,
      imageCount: 0,
      videoCount: 0,
      totalCount: 0,
      latestUpload: null,
      totalSize: 0,
    });
  });

  countsRaw.forEach((entry) => {
    const bucket = statsByYear.get(entry.year);
    if (!bucket) return;
    const count = entry._count?._all ?? 0;
    bucket.totalCount += count;
    if (entry.mediaType === GalleryMediaType.image) {
      bucket.imageCount += count;
    } else if (entry.mediaType === GalleryMediaType.video) {
      bucket.videoCount += count;
    }
  });

  latestRaw.forEach((entry) => {
    const bucket = statsByYear.get(entry.year);
    if (!bucket) return;
    bucket.latestUpload = entry._max?.createdAt ?? bucket.latestUpload;
  });

  sizesRaw.forEach((entry) => {
    const bucket = statsByYear.get(entry.year);
    if (!bucket) return;
    bucket.totalSize = entry._sum?.fileSize ?? 0;
  });

  const stats = years.map((year) => statsByYear.get(year) ?? {
    year,
    imageCount: 0,
    videoCount: 0,
    totalCount: 0,
    latestUpload: null,
    totalSize: 0,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Archiv und Bilder"
        description="Ordne Bilder und Videos den passenden Jahrgängen zu, entdecke Erinnerungen vergangener Spielzeiten und ergänze das Archiv gemeinsam mit dem Team."
      />

      <Card>
        <CardContent className="space-y-2 py-6 text-sm text-muted-foreground">
          <p>
            In jedem Ordner findest du hochgeladene Fotos und Videos eines Jahrgangs. Du kannst bestehende Dateien öffnen
            und – sofern freigeschaltet – eigene Inhalte mit kurzer Beschreibung ergänzen.
          </p>
          {canUpload || canModerate ? (
            <p className="text-success">
              {canUpload && canModerate
                ? "Du kannst neue Medien ergänzen und das gesamte Archiv moderieren – inklusive Löschen fremder Beiträge."
                : canUpload
                  ? "Du darfst neue Medien hochladen und deine eigenen Beiträge entfernen."
                  : "Du darfst Beiträge aus allen Jahrgängen entfernen."}
            </p>
          ) : (
            <p>Zum Hochladen benötigst du eine zusätzliche Berechtigung. Frage bei Bedarf im Admin-Team nach.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {stats.map((folder) => {
          const description = getGalleryYearDescription(folder.year, currentYear);
          const latestLabel = formatRelative(folder.latestUpload);
          const sizeLabel = folder.totalSize > 0 ? formatGalleryFileSize(folder.totalSize) : "0 B";

          return (
            <Card key={folder.year} className="flex h-full flex-col justify-between">
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-lg font-semibold">Jahrgang {folder.year}</CardTitle>
                  {folder.year === currentYear ? (
                    <Badge variant="accent">Aktuelle Saison</Badge>
                  ) : folder.year === GALLERY_START_YEAR ? (
                    <Badge variant="outline">Projektstart</Badge>
                  ) : null}
                </div>
                <p className="text-sm text-muted-foreground">{description}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span>
                    <strong className="text-foreground">{folder.imageCount}</strong> Bilder
                  </span>
                  <span>
                    <strong className="text-foreground">{folder.videoCount}</strong> Videos
                  </span>
                  <span>
                    Gesamt: <strong className="text-foreground">{folder.totalCount}</strong>
                  </span>
                  <span>Volumen: {sizeLabel}</span>
                </div>
                <div className="flex flex-col gap-2 text-xs text-muted-foreground">
                  <span>{latestLabel}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button asChild>
                    <Link href={`/mitglieder/archiv-und-bilder/${folder.year}`}>Ordner öffnen</Link>
                  </Button>
                  {canUpload ? (
                    <Button asChild variant="outline">
                      <Link href={`/mitglieder/archiv-und-bilder/${folder.year}#upload`}>Direkt zum Upload</Link>
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/members/page-header";
import { MemberGalleryManager, type MemberGalleryItem } from "@/components/members/gallery/member-gallery-manager";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { GalleryMediaType } from "@prisma/client";
import { getGalleryYearDescription, isValidGalleryYear } from "@/lib/gallery";

export default async function GalleryYearPage({ params }: { params: { year: string } }) {
  const session = await requireAuth();
  const yearParam = params.year ?? "";
  const year = Number.parseInt(yearParam, 10);

  if (!isValidGalleryYear(year)) {
    notFound();
  }

  const [canView, canUpload] = await Promise.all([
    hasPermission(session.user, "mitglieder.galerie"),
    hasPermission(session.user, "mitglieder.galerie.upload"),
  ]);

  if (!canView) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={`Galerie ${year}`}
          description="Du benötigst eine spezielle Berechtigung, um auf diese Galerie zuzugreifen."
          actions={
            <Button asChild variant="outline">
              <Link href="/mitglieder/galerie">
                <ArrowLeft className="mr-2 h-4 w-4" /> Zur Übersicht
              </Link>
            </Button>
          }
        />
        <p className="text-sm text-muted-foreground">
          Bitte wende dich an das Admin-Team, wenn du Zugriff auf die Galerie benötigst.
        </p>
      </div>
    );
  }

  const userId = session.user?.id ?? "";
  const records = await prisma.galleryItem.findMany({
    where: { year },
    orderBy: { createdAt: "desc" },
    include: { uploadedBy: { select: { id: true, name: true, email: true } } },
  });

  const initialItems: MemberGalleryItem[] = records.map((item) => ({
    id: item.id,
    fileName: item.fileName,
    mimeType: item.mimeType,
    fileSize: item.fileSize,
    type: item.mediaType === GalleryMediaType.image ? "image" : "video",
    description: item.description ?? null,
    createdAt: item.createdAt.toISOString(),
    uploadedBy: item.uploadedBy
      ? { id: item.uploadedBy.id, name: item.uploadedBy.name, email: item.uploadedBy.email }
      : null,
    downloadUrl: `/api/gallery/items/${item.id}/file`,
    canDelete: item.uploadedById === userId,
  }));

  const description = getGalleryYearDescription(year, new Date().getFullYear());

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Galerie ${year}`}
        description={description}
        actions={
          <Button asChild variant="outline">
            <Link href="/mitglieder/galerie">
              <ArrowLeft className="mr-2 h-4 w-4" /> Zur Übersicht
            </Link>
          </Button>
        }
      />
      <MemberGalleryManager year={year} canUpload={canUpload} initialItems={initialItems} />
    </div>
  );
}

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: itemId } = await context.params;
  const session = await requireAuth();
  const userId = session.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const [canView, canUpload] = await Promise.all([
    hasPermission(session.user, "mitglieder.galerie"),
    hasPermission(session.user, "mitglieder.galerie.upload"),
  ]);

  if (!canView || !canUpload) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  if (!itemId) {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  const item = await prisma.galleryItem.findUnique({
    where: { id: itemId },
    select: { uploadedById: true },
  });

  if (!item) {
    return NextResponse.json({ error: "Datei nicht gefunden" }, { status: 404 });
  }

  if (item.uploadedById !== userId) {
    return NextResponse.json({ error: "Nur eigene Uploads können gelöscht werden." }, { status: 403 });
  }

  try {
    await prisma.galleryItem.delete({ where: { id: itemId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[gallery] delete", error);
    return NextResponse.json(
      { error: "Löschen fehlgeschlagen. Bitte versuche es erneut." },
      { status: 500 },
    );
  }
}

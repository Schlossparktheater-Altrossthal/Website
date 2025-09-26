import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { resolveFileLibraryAccessContext, userHasFileLibraryAccess } from "@/lib/file-library";
import { revalidatePath } from "next/cache";

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await requireAuth();
  const userId = session.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const canAccessArea = await hasPermission(session.user, "mitglieder.dateisystem");
  if (!canAccessArea) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const item = await prisma.fileLibraryItem.findUnique({
    where: { id },
    include: {
      folder: { include: { accessRules: true } },
    },
  });

  if (!item) {
    return NextResponse.json({ error: "Datei nicht gefunden" }, { status: 404 });
  }

  const currentUser = session.user ?? { id: null };
  const accessContext = await resolveFileLibraryAccessContext(currentUser);
  const canManage = accessContext.canManage;
  const canUpload = await userHasFileLibraryAccess(currentUser, item.folder, "upload", accessContext);
  const canView = await userHasFileLibraryAccess(currentUser, item.folder, "view", accessContext);

  if (!canView) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  if (!canManage && (!canUpload || item.uploadedById !== userId)) {
    return NextResponse.json({ error: "Nur eigene Uploads können gelöscht werden." }, { status: 403 });
  }

  try {
    await prisma.fileLibraryItem.delete({ where: { id } });
    revalidatePath(`/mitglieder/dateisystem/${item.folderId}`);
    revalidatePath("/mitglieder/dateisystem");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[file-library] delete", error);
    return NextResponse.json({ error: "Löschen fehlgeschlagen." }, { status: 500 });
  }
}

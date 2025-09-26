import { NextRequest, NextResponse } from "next/server";
import { Buffer } from "node:buffer";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { resolveFileLibraryAccessContext, userHasFileLibraryAccess } from "@/lib/file-library";

function buildContentDisposition(filename: string) {
  const encoded = encodeURIComponent(filename);
  const fallback = filename.replace(/"/g, "'");
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await requireAuth();

  const currentUser = session.user ?? { id: null };
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

  if (!item || !item.data) {
    return NextResponse.json({ error: "Datei nicht gefunden" }, { status: 404 });
  }

  const accessContext = await resolveFileLibraryAccessContext(currentUser);
  const canDownload = await userHasFileLibraryAccess(currentUser, item.folder, "download", accessContext);
  const canView = await userHasFileLibraryAccess(currentUser, item.folder, "view", accessContext);

  if (!canView || !canDownload) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const headers = new Headers();
  headers.set("Content-Type", item.mimeType);
  headers.set("Content-Length", String(item.fileSize));
  headers.set("Content-Disposition", buildContentDisposition(item.fileName));
  headers.set("Cache-Control", "private, max-age=0, must-revalidate");
  headers.set("Last-Modified", item.updatedAt.toUTCString());

  const buffer = item.data instanceof Buffer ? item.data : Buffer.from(item.data);
  const body = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

  return new NextResponse(body, { status: 200, headers });
}

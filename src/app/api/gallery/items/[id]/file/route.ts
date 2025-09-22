import { NextRequest, NextResponse } from "next/server";
import { Buffer } from "node:buffer";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";

function buildContentDisposition(filename: string) {
  const encoded = encodeURIComponent(filename);
  const fallback = filename.replace(/"/g, "'");
  return `inline; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: itemId } = await context.params;
  const session = await requireAuth();
  const canView = await hasPermission(session.user, "mitglieder.galerie");

  if (!canView) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  if (!itemId) {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  const item = await prisma.galleryItem.findUnique({
    where: { id: itemId },
    select: {
      data: true,
      mimeType: true,
      fileName: true,
      fileSize: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!item || !item.data) {
    return NextResponse.json({ error: "Datei nicht gefunden" }, { status: 404 });
  }

  const headers = new Headers();
  headers.set("Content-Type", item.mimeType);
  headers.set("Content-Length", String(item.fileSize ?? item.data.length));
  headers.set("Content-Disposition", buildContentDisposition(item.fileName));
  headers.set("Cache-Control", "private, max-age=0, must-revalidate");
  headers.set("Last-Modified", (item.updatedAt ?? item.createdAt).toUTCString());

  const buffer = item.data instanceof Buffer ? item.data : Buffer.from(item.data);
  const body = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

  return new NextResponse(body, {
    status: 200,
    headers,
  });
}

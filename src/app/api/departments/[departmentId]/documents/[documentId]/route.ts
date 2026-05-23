import { Buffer } from "node:buffer";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ departmentId: string; documentId: string }> },
) {
  const session = await requireAuth();
  const userId = session.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const { departmentId, documentId } = await context.params;
  if (!departmentId || !documentId) {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  const document = await prisma.departmentDocument.findFirst({
    where: { id: documentId, departmentId },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      data: true,
      departmentId: true,
    },
  });

  if (!document) {
    return NextResponse.json({ error: "Dokument nicht gefunden" }, { status: 404 });
  }

  const [hasGlobalAccess, membership] = await Promise.all([
    hasPermission(session.user, "PRIVATE.PRODUCTION.SHOW.MANAGE"),
    prisma.departmentMembership.findFirst({
      where: { departmentId, userId },
      select: { id: true },
    }),
  ]);

  if (!hasGlobalAccess && !membership) {
    return NextResponse.json({ error: "Kein Zugriff auf dieses Dokument" }, { status: 403 });
  }

  const safeName = document.fileName.replace(/"/g, "'");
  const encodedName = encodeURIComponent(document.fileName);

  const fileBuffer = Buffer.from(document.data);

  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": document.mimeType,
      "Content-Length": document.fileSize.toString(),
      "Content-Disposition": `attachment; filename="${safeName}"; filename*=UTF-8''${encodedName}`,
    },
  });
}

import { withRoute } from "@/lib/api/route";
import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";

export const GET = withRoute<{ departmentId: string; documentId: string }>(
  { name: "departments/[departmentId]/documents/[documentId].get" },
  async ({ session, userId, params }) => {
    const { departmentId, documentId } = params;
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
        where: { departmentId, userId, status: "active" },
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
  },
);

import { withRoute } from "@/lib/api/route";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

function sanitizeForHeader(value: string): string {
  return value.replace(/"/g, "").replace(/\r|\n/g, "");
}

export const GET = withRoute<{ id: string }>(
  { name: "photo-consents/[id]/document.get", permission: "PRIVATE.ADMIN.PHOTOCONSENT.MANAGE" },
  async ({ request, params }) => {
    const id = params.id?.trim();
    if (!id) {
      return NextResponse.json({ error: "Fehlende ID" }, { status: 400 });
    }

    const consent = await prisma.photoConsent.findUnique({
      where: { id },
      select: {
        documentData: true,
        documentMime: true,
        documentName: true,
        documentSize: true,
      },
    });

    if (!consent || !consent.documentData) {
      return NextResponse.json({ error: "Dokument nicht gefunden" }, { status: 404 });
    }

    const buffer = Buffer.from(consent.documentData);
    const mime = consent.documentMime || "application/octet-stream";
    const fileName = consent.documentName || "foto-einverstaendnis.pdf";
    const safeFileName = sanitizeForHeader(fileName);
    const encodedFileName = encodeURIComponent(fileName);

    const mode = request.nextUrl.searchParams.get("mode");
    const disposition = mode === "inline" ? "inline" : "attachment";

    const response = new NextResponse(buffer, {
      headers: {
        "Content-Type": mime,
        "Content-Length": consent.documentSize
          ? String(consent.documentSize)
          : String(buffer.byteLength),
        "Content-Disposition": `${disposition}; filename="${safeFileName}"; filename*=UTF-8''${encodedFileName}`,
        "Cache-Control": "no-store",
      },
    });

    return response;
  },
);

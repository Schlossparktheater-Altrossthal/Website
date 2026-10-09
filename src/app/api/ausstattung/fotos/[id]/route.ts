import { NextResponse, type NextRequest } from "next/server";

import { canViewShowObjects } from "@/lib/ausstattung/service";
import { prisma } from "@/lib/prisma";

/** Fotos von Ausstattungsstücken – nur für Beteiligte der Produktion. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const photo = await prisma.productionObjectPhoto.findUnique({
    where: { id },
    select: { data: true, mimeType: true, object: { select: { showId: true } } },
  });
  if (!photo) return NextResponse.json({ error: "Foto nicht gefunden" }, { status: 404 });
  if (!(await canViewShowObjects(photo.object.showId))) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  return new NextResponse(new Uint8Array(photo.data), {
    status: 200,
    headers: {
      "Content-Type": photo.mimeType,
      "Content-Length": String(photo.data.byteLength),
      // Fotos werden nie verändert, nur gelöscht – die ID wechselt dann.
      "Cache-Control": "private, max-age=86400, immutable",
    },
  });
}

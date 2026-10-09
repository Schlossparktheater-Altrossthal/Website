import { NextResponse, type NextRequest } from "next/server";

import { canViewShowObjects } from "@/lib/ausstattung/service";
import { prisma } from "@/lib/prisma";

/** Foto einer Anforderung aus der Szene. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const requirement = await prisma.sceneRequirement.findUnique({
    where: { id },
    select: { photo: true, photoMimeType: true, showId: true },
  });
  if (!requirement?.photo || !requirement.photoMimeType) {
    return NextResponse.json({ error: "Foto nicht gefunden" }, { status: 404 });
  }
  if (!(await canViewShowObjects(requirement.showId))) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  return new NextResponse(new Uint8Array(requirement.photo), {
    status: 200,
    headers: {
      "Content-Type": requirement.photoMimeType,
      "Content-Length": String(requirement.photo.byteLength),
      "Cache-Control": "private, max-age=86400",
    },
  });
}

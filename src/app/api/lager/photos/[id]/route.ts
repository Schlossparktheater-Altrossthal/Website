import { NextResponse, type NextRequest } from "next/server";

import { getInventoryAccess } from "@/lib/inventory/service";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/rbac";

/**
 * Fotos aus dem Lager. Fotos von Artikeltypen und Exemplaren sind öffentlich (Scan-Seite ohne Login), Fotos von
 * Mängeln nur mit Lagerzugriff.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const photo = await prisma.inventoryPhoto.findUnique({
    where: { id },
    select: {
      data: true,
      mimeType: true,
      defectId: true,
      productId: true,
      asset: { select: { status: true } },
    },
  });
  if (!photo) {
    return NextResponse.json({ error: "Foto nicht gefunden" }, { status: 404 });
  }
  const isPublic =
    !photo.defectId &&
    (Boolean(photo.productId) || (photo.asset && photo.asset.status !== "retired"));
  if (!isPublic) {
    const session = await getSession();
    const access = await getInventoryAccess(session?.user);
    if (!access.canUse) {
      return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
    }
  }
  return new NextResponse(new Uint8Array(photo.data), {
    status: 200,
    headers: {
      "Content-Type": photo.mimeType,
      "Content-Length": String(photo.data.byteLength),
      // Fotos werden nie verändert, nur gelöscht – die ID wechselt dann.
      "Cache-Control": isPublic ? "public, max-age=31536000, immutable" : "private, max-age=86400",
    },
  });
}

import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/rbac";

/** Rezeptbilder – nur für angemeldete Mitglieder (fremde Fotos nicht öffentlich weitergeben). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const { id } = await params;
  const image = await prisma.recipeImage.findUnique({
    where: { id },
    select: { data: true, mimeType: true },
  });
  if (!image) return NextResponse.json({ error: "Bild nicht gefunden" }, { status: 404 });
  return new NextResponse(new Uint8Array(image.data), {
    status: 200,
    headers: {
      "Content-Type": image.mimeType,
      "Content-Length": String(image.data.byteLength),
      // Bilder werden nie verändert, nur gelöscht – die ID wechselt dann.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}

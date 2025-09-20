import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      avatarImage: true,
      avatarImageMime: true,
      avatarImageUpdatedAt: true,
    },
  });

  if (!user || !user.avatarImage || !user.avatarImageMime) {
    return new NextResponse(null, { status: 404 });
  }

  const updatedAt = user.avatarImageUpdatedAt?.toUTCString();
  const headers = new Headers({
    "Content-Type": user.avatarImageMime,
    "Cache-Control": "public, max-age=31536000, immutable",
  });
  if (updatedAt) {
    headers.set("Last-Modified", updatedAt);
  }
  const avatarData = user.avatarImage as Uint8Array | ArrayBuffer;
  const byteLength = avatarData.byteLength;
  const body: ArrayBuffer =
    avatarData instanceof ArrayBuffer
      ? avatarData.slice(0)
      : new Uint8Array(avatarData).buffer;

  headers.set("Content-Length", String(byteLength));

  return new NextResponse(body, {
    status: 200,
    headers,
  });
}

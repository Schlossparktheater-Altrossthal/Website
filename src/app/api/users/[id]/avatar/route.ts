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
  headers.set("Content-Length", String(user.avatarImage.length));

  return new NextResponse(user.avatarImage, {
    status: 200,
    headers,
  });
}

import { NextResponse, type NextRequest } from "next/server";

import { getInventoryAccess } from "@/lib/inventory/service";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/rbac";
import type { Prisma } from "@prisma/client";

async function authorize() {
  const session = await getSession();
  const access = await getInventoryAccess(session?.user);
  return access.canUse;
}

/** Datei-Anhang eines Merkmals herunterladen. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  if (!(await authorize())) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  const { fileId } = await params;
  const file = await prisma.inventoryProductFile.findUnique({
    where: { id: fileId },
    select: { name: true, mime: true, data: true },
  });
  if (!file) return NextResponse.json({ error: "Datei nicht gefunden" }, { status: 404 });
  const filename = encodeURIComponent(file.name);
  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mime,
      "Content-Disposition": `inline; filename*=UTF-8''${filename}`,
      "Cache-Control": "private, no-store",
    },
  });
}

/** Datei-Anhang samt Merkmals-Verweis entfernen. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ fileId: string }> },
) {
  if (!(await authorize())) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  const { fileId } = await params;
  const file = await prisma.inventoryProductFile.findUnique({
    where: { id: fileId },
    select: { productId: true, fieldKey: true },
  });
  if (!file) return NextResponse.json({ error: "Datei nicht gefunden" }, { status: 404 });

  const product = await prisma.inventoryProduct.findUnique({
    where: { id: file.productId },
    select: { specs: true },
  });
  const specs = (product?.specs as Record<string, unknown> | null) ?? {};
  if (file.fieldKey in specs) delete specs[file.fieldKey];

  await prisma.$transaction([
    prisma.inventoryProductFile.delete({ where: { id: fileId } }),
    prisma.inventoryProduct.update({
      where: { id: file.productId },
      data: { specs: specs as Prisma.InputJsonValue },
    }),
  ]);
  return NextResponse.json({ ok: true });
}

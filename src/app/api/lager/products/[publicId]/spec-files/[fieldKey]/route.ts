import { NextResponse, type NextRequest } from "next/server";

import { loadEffectiveFields } from "@/lib/inventory/catalog";
import { getInventoryAccess } from "@/lib/inventory/service";
import type { FileValue } from "@/lib/inventory/specs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/rbac";
import type { Prisma } from "@prisma/client";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "text/plain",
  "text/csv",
]);

async function authorize() {
  const session = await getSession();
  const access = await getInventoryAccess(session?.user);
  return access.canUse;
}

/** Datei zu einem Merkmal vom Typ `file` hochladen (überschreibt eine vorhandene Datei). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ publicId: string; fieldKey: string }> },
) {
  if (!(await authorize())) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  try {
    const { publicId, fieldKey } = await params;

    const product = await prisma.inventoryProduct.findUnique({
      where: { publicId },
      select: { id: true, areaId: true, categoryId: true, specs: true },
    });
    if (!product) return NextResponse.json({ error: "Artikeltyp nicht gefunden" }, { status: 404 });

    const fields = await loadEffectiveFields(prisma, product.areaId, product.categoryId);
    const field = fields.find((entry) => entry.key === fieldKey && entry.type === "file");
    if (!field) {
      return NextResponse.json(
        { error: "Kein Datei-Merkmal mit diesem Schlüssel" },
        { status: 400 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Keine Datei" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Bitte PDF, Foto oder Textdatei hochladen" },
        { status: 400 },
      );
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "Datei ist größer als 10 MB" }, { status: 413 });
    }

    const created = await prisma.inventoryProductFile.upsert({
      where: { productId_fieldKey: { productId: product.id, fieldKey } },
      create: {
        productId: product.id,
        fieldKey,
        name: file.name.slice(0, 200),
        mime: file.type,
        size: file.size,
        data: new Uint8Array(await file.arrayBuffer()),
      },
      update: {
        name: file.name.slice(0, 200),
        mime: file.type,
        size: file.size,
        data: new Uint8Array(await file.arrayBuffer()),
      },
      select: { id: true, name: true, mime: true, size: true },
    });

    const value: FileValue = {
      id: created.id,
      name: created.name,
      mime: created.mime,
      size: created.size,
    };
    const specs = (product.specs as Record<string, unknown> | null) ?? {};
    specs[fieldKey] = value;
    await prisma.inventoryProduct.update({
      where: { id: product.id },
      data: { specs: specs as Prisma.InputJsonValue },
    });

    return NextResponse.json({ ok: true, file: value });
  } catch (error) {
    console.error("upload spec file", error);
    return NextResponse.json({ error: "Datei konnte nicht gespeichert werden." }, { status: 500 });
  }
}

import { NextResponse, type NextRequest } from "next/server";

import { inventoryAssetPath } from "@/lib/inventory/constants";
import { getInventoryAccess } from "@/lib/inventory/service";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

async function authorize() {
  const session = await getSession();
  const access = await getInventoryAccess(session?.user);
  return access.canUse;
}

/** Prüfprotokoll herunterladen. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authorize())) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  const { id } = await params;
  const inspection = await prisma.inventoryInspection.findUnique({
    where: { id },
    select: { documentData: true, documentMime: true, documentName: true },
  });
  if (!inspection?.documentData || !inspection.documentMime) {
    return NextResponse.json({ error: "Kein Protokoll hinterlegt" }, { status: 404 });
  }
  const filename = encodeURIComponent(inspection.documentName ?? "pruefprotokoll");
  return new NextResponse(new Uint8Array(inspection.documentData), {
    headers: {
      "Content-Type": inspection.documentMime,
      "Content-Disposition": `inline; filename*=UTF-8''${filename}`,
      "Cache-Control": "private, no-store",
    },
  });
}

/** Prüfprotokoll (PDF oder Foto) an eine Prüfung hängen. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await authorize())) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }
  const { id } = await params;
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Keine Datei" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Bitte PDF oder Foto hochladen" }, { status: 400 });
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return NextResponse.json({ error: "Datei ist größer als 10 MB" }, { status: 413 });
  }
  const inspection = await prisma.inventoryInspection.update({
    where: { id },
    data: {
      documentData: new Uint8Array(await file.arrayBuffer()),
      documentMime: file.type,
      documentName: file.name.slice(0, 200),
    },
    select: { asset: { select: { code: true } } },
  });
  revalidatePath(inventoryAssetPath(inspection.asset.code));
  return NextResponse.json({ ok: true });
}

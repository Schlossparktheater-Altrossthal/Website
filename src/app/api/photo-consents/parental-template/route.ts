import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";

const MAX_SIZE = 8 * 1024 * 1024; // 8 MB
const TEMPLATE_FILENAME = "einverstaendnis-eltern.pdf";

function sanitizeForHeader(value: string): string {
  return value.replace(/"/g, "").replace(/\r|\n/g, "");
}

export async function GET() {
  await requireAuth();

  const settings = await prisma.serverSettings.findUnique({
    where: { id: "default" },
    select: {
      parentalConsentData: true,
      parentalConsentMime: true,
    },
  });

  if (!settings?.parentalConsentData) {
    return NextResponse.json({ error: "Kein Elternformular hinterlegt" }, { status: 404 });
  }

  const buffer = Buffer.from(settings.parentalConsentData);
  const mime = settings.parentalConsentMime || "application/pdf";
  const safeFileName = sanitizeForHeader(TEMPLATE_FILENAME);
  const encodedFileName = encodeURIComponent(TEMPLATE_FILENAME);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(buffer.byteLength),
      "Content-Disposition": `attachment; filename="${safeFileName}"; filename*=UTF-8''${encodedFileName}`,
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: NextRequest) {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "PRIVATE.ADMIN.PHOTOCONSENT.MANAGE"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  const file = formData.get("template");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Datei fehlt" }, { status: 400 });
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Nur PDF-Dateien sind erlaubt" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Datei zu groß (max 8 MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = file.name || TEMPLATE_FILENAME;
  const now = new Date();

  const userId = session.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Ungültige Sitzung" }, { status: 401 });
  }

  await prisma.serverSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      parentalConsentData: buffer,
      parentalConsentName: fileName,
      parentalConsentMime: file.type,
      parentalConsentSize: file.size,
      parentalConsentUploadedAt: now,
      parentalConsentUploadedBy: { connect: { id: userId } },
    },
    update: {
      parentalConsentData: buffer,
      parentalConsentName: fileName,
      parentalConsentMime: file.type,
      parentalConsentSize: file.size,
      parentalConsentUploadedAt: now,
      parentalConsentUploadedBy: { connect: { id: userId } },
    },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "PRIVATE.ADMIN.PHOTOCONSENT.MANAGE"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.serverSettings.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {
      parentalConsentData: null,
      parentalConsentName: null,
      parentalConsentMime: null,
      parentalConsentSize: null,
      parentalConsentUploadedAt: null,
      parentalConsentUploadedById: null,
    },
  });

  return NextResponse.json({ success: true });
}

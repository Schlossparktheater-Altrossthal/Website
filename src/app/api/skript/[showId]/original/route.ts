import { NextResponse, type NextRequest } from "next/server";

import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { SCRIPT_MANAGE_PERMISSION, SCRIPT_READ_PERMISSION } from "@/lib/skript/service";
import { getObject } from "@/lib/storage/s3";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/**
 * Original-PDF herunterladen: `?fassung=<id>` (freigegebene Fassungen für alle Leser, Entwürfe
 * nur für Verwalter) oder `?upload=<id>` (noch nicht lesbare Uploads, nur Verwalter).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ showId: string }> },
) {
  const session = await requireAuth();
  const { showId } = await params;
  const search = request.nextUrl.searchParams;
  const [canRead, canManage] = await Promise.all([
    hasPermission(session.user, SCRIPT_READ_PERMISSION, { showId }),
    hasPermission(session.user, SCRIPT_MANAGE_PERMISSION, { showId }),
  ]);
  if (!canRead && !canManage) return fail("Keine Berechtigung.", 403);

  const versionId = search.get("fassung");
  const uploadId = search.get("upload");
  let source: { bucket: string; key: string; name: string } | null = null;
  if (versionId) {
    const version = await prisma.scriptVersion.findUnique({
      where: { id: versionId },
      select: { showId: true, status: true, sourceBucket: true, sourceKey: true, sourceName: true },
    });
    if (
      version?.showId === showId &&
      (canManage || version.status === "released") &&
      version.sourceBucket &&
      version.sourceKey
    ) {
      source = { bucket: version.sourceBucket, key: version.sourceKey, name: version.sourceName };
    }
  } else if (uploadId && canManage) {
    const pending = await prisma.scriptPendingImport.findUnique({ where: { id: uploadId } });
    if (pending?.showId === showId) {
      source = { bucket: pending.sourceBucket, key: pending.sourceKey, name: pending.sourceName };
    }
  }
  if (!source) return fail("Original-PDF nicht gefunden.", 404);

  const object = await getObject(source.bucket, source.key).catch(() => null);
  if (!object?.body) return fail("Original-PDF nicht gefunden.", 404);
  const name = source.name.toLowerCase().endsWith(".pdf") ? source.name : `${source.name}.pdf`;
  return new Response(object.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="skript.pdf"; filename*=UTF-8''${encodeURIComponent(name)}`,
      ...(object.contentLength ? { "Content-Length": String(object.contentLength) } : {}),
      "Cache-Control": "private, no-store",
    },
  });
}

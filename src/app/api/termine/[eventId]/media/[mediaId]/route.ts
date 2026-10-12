import { NextResponse } from "next/server";

import { deleteEventMedia } from "@/lib/media/event-media";
import { loadMediaContext } from "@/lib/media/event-media-route";
import { prisma } from "@/lib/prisma";
import { broadcastRehearsalUpdated } from "@/lib/realtime/triggers";
import { getObject, isStorageConfigured } from "@/lib/storage/s3";

type RouteParams = { params: Promise<{ eventId: string; mediaId: string }> };

/** Datei ausliefern; `?vorschau=1` Vorschaubild, `?download=1` als Download. Unterstützt Range. */
export async function GET(request: Request, { params }: RouteParams) {
  const { eventId, mediaId } = await params;
  const context = await loadMediaContext(eventId);
  if ("error" in context) return context.error;
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "Medienspeicher nicht eingerichtet." }, { status: 503 });
  }
  const media = await prisma.eventMedia.findFirst({
    where: { id: mediaId, eventId },
    select: { bucket: true, storageKey: true, thumbKey: true, mimeType: true, fileName: true },
  });
  if (!media) return NextResponse.json({ error: "Datei nicht gefunden." }, { status: 404 });

  const url = new URL(request.url);
  const preview = url.searchParams.get("vorschau") === "1" && media.thumbKey;
  const key = preview ? media.thumbKey! : media.storageKey;
  const range = preview ? null : request.headers.get("range");
  let object;
  try {
    object = await getObject(media.bucket, key, range);
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 416) return new NextResponse(null, { status: 416 });
    if (status === 404) {
      return NextResponse.json({ error: "Datei fehlt im Speicher." }, { status: 404 });
    }
    throw error;
  }

  const headers = new Headers({
    "Content-Type": preview ? "image/webp" : media.mimeType,
    "Accept-Ranges": "bytes",
    // Inhalte ändern sich nie (neue Datei = neue ID); nur im eigenen Browser zwischenspeichern.
    "Cache-Control": "private, max-age=604800, immutable",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": `${url.searchParams.get("download") === "1" ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(media.fileName)}`,
  });
  if (object.contentLength !== null) headers.set("Content-Length", String(object.contentLength));
  if (object.contentRange) headers.set("Content-Range", object.contentRange);
  if (object.etag) headers.set("ETag", object.etag);
  return new NextResponse(object.body, { status: object.contentRange ? 206 : 200, headers });
}

/** Datei löschen: eigene oder – mit Protokollführung – alle. */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { eventId, mediaId } = await params;
  const context = await loadMediaContext(eventId);
  if ("error" in context) return context.error;
  const media = await prisma.eventMedia.findFirst({
    where: { id: mediaId, eventId },
    select: { uploadedById: true },
  });
  if (!media) return NextResponse.json({ error: "Datei nicht gefunden." }, { status: 404 });
  if (media.uploadedById !== context.user.id && !context.access.canManage) {
    return NextResponse.json({ error: "Nur eigene Dateien löschen." }, { status: 403 });
  }
  await deleteEventMedia({ id: { in: [mediaId] } });
  await broadcastRehearsalUpdated({
    rehearsalId: eventId,
    changes: { protocol: true },
    targetUserIds: [],
  }).catch((error) => console.error("[media] Live-Meldung fehlgeschlagen", error));
  return NextResponse.json({ ok: true });
}

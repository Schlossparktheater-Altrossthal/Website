import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import {
  MEDIA_MAX_BYTES,
  VOICE_MEMO_MAX_SECONDS,
  eventFolder,
  mediaKeys,
  mediaKindFor,
  processImage,
  deleteAbandonedMedia,
  readEventMedia,
} from "@/lib/media/event-media";
import { toEventMediaItem } from "@/lib/media/event-media-item";
import { loadMediaContext } from "@/lib/media/event-media-route";
import { prisma } from "@/lib/prisma";
import { broadcastRehearsalUpdated } from "@/lib/realtime/triggers";
import { deleteObjects, isStorageConfigured, putObject } from "@/lib/storage/s3";

type RouteParams = { params: Promise<{ eventId: string }> };

const MB = 1024 * 1024;

/** Medien eines Termins (Eingeladene, Anwesende, Protokollführung). */
export async function GET(_request: Request, { params }: RouteParams) {
  const { eventId } = await params;
  const context = await loadMediaContext(eventId);
  if ("error" in context) return context.error;
  return NextResponse.json({
    media: await readEventMedia(eventId),
    canManage: context.access.canManage,
    userId: context.user.id,
    available: isStorageConfigured(),
  });
}

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

/**
 * Eine Datei hochladen (Formularfelder: `file`, optional `noteId`, `blockId`, `gallery=1`,
 * `memo=1` mit `durationSec`, `caption`). Fotos werden verkleinert und ohne Metadaten abgelegt.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { eventId } = await params;
  const context = await loadMediaContext(eventId);
  if ("error" in context) return context.error;
  if (!isStorageConfigured()) return fail("Der Medienspeicher ist hier nicht eingerichtet.", 503);
  const { event, user, access } = context;

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Keine Datei erhalten.", 400);
  const kind = mediaKindFor(file.type);
  if (!kind) return fail("Dieser Dateityp wird nicht unterstützt.", 415);
  if (file.size > MEDIA_MAX_BYTES[kind]) {
    return fail(`Die Datei ist zu groß (höchstens ${MEDIA_MAX_BYTES[kind] / MB} MB).`, 413);
  }

  const text = (name: string) => {
    const value = form?.get(name);
    return typeof value === "string" && value.trim() ? value.trim() : null;
  };
  const noteId = text("noteId");
  const blockId = text("blockId");
  const gallery = text("gallery") === "1" && kind === "IMAGE";
  const memo = text("memo") === "1" && kind === "AUDIO";
  const caption = text("caption")?.slice(0, 500) ?? null;
  const durationRaw = Number(text("durationSec"));
  const durationSec =
    kind === "AUDIO" && Number.isFinite(durationRaw) && durationRaw > 0
      ? Math.round(durationRaw)
      : null;
  if (memo && durationSec && durationSec > VOICE_MEMO_MAX_SECONDS + 5) {
    return fail("Sprachmemos dürfen höchstens 10 Minuten lang sein.", 413);
  }

  if (noteId) {
    const note = await prisma.eventNote.findFirst({
      where: { id: noteId, eventId },
      select: { authorId: true },
    });
    if (!note) return fail("Eintrag nicht gefunden.", 404);
    if (note.authorId !== user.id && !access.canManage) {
      return fail("Anhänge gehen nur an eigene Einträge.", 403);
    }
  }
  if (blockId) {
    if (!access.canManage) return fail("Dateien am Ablauf hängt die Protokollführung an.", 403);
    const block = await prisma.eventBlock.findFirst({
      where: { id: blockId, eventId },
      select: { id: true },
    });
    if (!block) return fail("Ablaufpunkt nicht gefunden.", 404);
  }

  await deleteAbandonedMedia(user.id).catch((error) =>
    console.error("[media] Alte Uploads nicht aufgeräumt", error),
  );

  const id = randomUUID();
  let data = new Uint8Array(await file.arrayBuffer());
  let thumb: Uint8Array | null = null;
  let mimeType = file.type.split(";")[0].trim().toLowerCase();
  let width: number | null = null;
  let height: number | null = null;
  if (kind === "IMAGE") {
    try {
      const image = await processImage(data);
      data = image.data;
      thumb = image.thumb;
      width = image.width;
      height = image.height;
      mimeType = "image/webp";
    } catch (error) {
      console.error("[media] Bild nicht lesbar", error);
      return fail("Das Bild konnte nicht gelesen werden (HEIC bitte als JPEG senden).", 415);
    }
  }

  const fileName = file.name || (memo ? "sprachmemo" : "datei");
  const { storageKey, thumbKey } = mediaKeys(eventFolder(event), {
    id,
    kind,
    fileName,
    ext: kind === "IMAGE" ? "webp" : undefined,
  });
  const stored = await putObject(storageKey, data, mimeType);
  if (thumb && thumbKey) await putObject(thumbKey, thumb, "image/webp");

  try {
    const row = await prisma.eventMedia.create({
      data: {
        id,
        eventId,
        blockId,
        noteId,
        kind,
        gallery,
        fileName: kind === "IMAGE" ? fileName.replace(/\.[^.]+$/, "") + ".webp" : fileName,
        mimeType,
        fileSize: data.byteLength,
        durationSec,
        width,
        height,
        caption,
        bucket: stored.bucket,
        storageKey,
        thumbKey,
        uploadedById: user.id,
      },
    });
    revalidatePath(`/mitglieder/termine/${eventId}`, "layout");
    await broadcastRehearsalUpdated({
      rehearsalId: eventId,
      changes: { protocol: true },
      targetUserIds: [],
    }).catch((error) => console.error("[media] Live-Meldung fehlgeschlagen", error));
    return NextResponse.json({ media: toEventMediaItem(row) }, { status: 201 });
  } catch (error) {
    await deleteObjects([
      { bucket: stored.bucket, key: storageKey },
      ...(thumbKey ? [{ bucket: stored.bucket, key: thumbKey }] : []),
    ]).catch(() => {});
    throw error;
  }
}

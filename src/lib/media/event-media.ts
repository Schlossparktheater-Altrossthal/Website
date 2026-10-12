import type { EventMediaKind } from "@prisma/client";
import sharp from "sharp";

import { getProtocolAccess } from "@/lib/calendar/protocol-server";
import { DEFAULT_TIME_ZONE } from "@/lib/date-time";
import { hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/produktionen/actions-helpers";
import { deleteObjects } from "@/lib/storage/s3";

/**
 * Medien zu Terminen (Probenfotos, Sprachmemos, Musik, Dokumente), Plan
 * docs/Plan/probenablauf-medien-plan.md. Metadaten in `EventMedia`, Bytes im Objektspeicher
 * unter lesbaren Pfaden je Produktion und Probe.
 */

const MB = 1024 * 1024;

/** Höchstgröße der hochgeladenen Datei je Art (Fotos werden danach verkleinert). */
export const MEDIA_MAX_BYTES: Record<EventMediaKind, number> = {
  IMAGE: 25 * MB,
  AUDIO: 25 * MB,
  FILE: 15 * MB,
};

/** Fotos: längste Kante nach dem Verkleinern; Vorschaubild für Listen und Galerie. */
export const IMAGE_MAX_EDGE = 2000;
const THUMB_EDGE = 480;

/** Sprachmemos sind auf 10 Minuten begrenzt (Musikdateien nicht). */
export const VOICE_MEMO_MAX_SECONDS = 10 * 60;

const AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/aac",
  "audio/ogg",
  "audio/opus",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/flac",
]);
const FILE_TYPES = new Set(["application/pdf"]);

/** Art einer Datei aus ihrem MIME-Typ (ohne Parameter wie `;codecs=opus`); `null` = nicht erlaubt. */
export function mediaKindFor(mimeType: string): EventMediaKind | null {
  const type = mimeType.split(";")[0].trim().toLowerCase();
  if (type.startsWith("image/")) return "IMAGE";
  if (AUDIO_TYPES.has(type)) return "AUDIO";
  if (FILE_TYPES.has(type)) return "FILE";
  return null;
}

export const MEDIA_FOLDER: Record<EventMediaKind, string> = {
  IMAGE: "fotos",
  AUDIO: "audio",
  FILE: "dateien",
};

const DATE = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: DEFAULT_TIME_ZONE,
});

/** Dateiname, der in S3-Pfaden und Downloads ohne Ärger funktioniert. */
export function safeFileName(input: string) {
  const name = input.split(/[\\/]/).pop() ?? "";
  const dot = name.lastIndexOf(".");
  const base = slugify(dot > 0 ? name.slice(0, dot) : name) || "datei";
  const ext =
    dot > 0
      ? name
          .slice(dot + 1)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "")
          .slice(0, 8)
      : "";
  return ext ? `${base}.${ext}` : base;
}

/**
 * Ordner eines Termins im Speicher, z. B.
 * `produktionen/2027-sommernachtstraum/proben/2027-05-14-szenenprobe-1-3/`.
 * Der Pfad gilt ab dem Hochladen; verschiebt sich der Termin, bleibt er (die DB ist maßgeblich).
 */
export function eventFolder(event: {
  title: string;
  start: Date;
  show: { year: number; title: string | null } | null;
}) {
  const day = DATE.format(event.start);
  const termin = `${day}-${slugify(event.title) || "termin"}`;
  if (!event.show) return `termine/${termin}/`;
  const production = `${event.show.year}${event.show.title ? `-${slugify(event.show.title)}` : ""}`;
  return `produktionen/${production}/proben/${termin}/`;
}

export function mediaKeys(
  folder: string,
  media: { id: string; kind: EventMediaKind; fileName: string; ext?: string },
) {
  const name = safeFileName(media.fileName);
  const file = media.ext ? `${name.replace(/\.[a-z0-9]+$/, "")}.${media.ext}` : name;
  return {
    storageKey: `${folder}${MEDIA_FOLDER[media.kind]}/${media.id}-${file}`,
    thumbKey:
      media.kind === "IMAGE" ? `${folder}${MEDIA_FOLDER.IMAGE}/vorschau/${media.id}.webp` : null,
  };
}

/** Foto drehen (EXIF), verkleinern, Metadaten (GPS) entfernen; dazu ein Vorschaubild. */
export async function processImage(input: Uint8Array) {
  const source = sharp(input, { limitInputPixels: 80_000_000, failOn: "error" }).rotate();
  const { data, info } = await source
    .clone()
    .resize({
      width: IMAGE_MAX_EDGE,
      height: IMAGE_MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  const thumb = await source
    .clone()
    .resize({ width: THUMB_EDGE, height: THUMB_EDGE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 72 })
    .toBuffer();
  return {
    data: new Uint8Array(data),
    thumb: new Uint8Array(thumb),
    width: info.width,
    height: info.height,
  };
}

type PermissionUser = Parameters<typeof hasPermission>[0];

export type EventMediaAccess = {
  /** Ansehen und Hochladen: Eingeladene, tatsächlich Anwesende und wer das Protokoll führt. */
  canUse: boolean;
  /** Alle Medien löschen (Protokollführung); sonst nur die eigenen. */
  canManage: boolean;
};

const HERE = ["PRESENT", "LATE", "LEFT_EARLY"] as const;

export async function getEventMediaAccess(
  user: PermissionUser,
  event: { id: string; showId: string | null },
): Promise<EventMediaAccess> {
  if (!user?.id) return { canUse: false, canManage: false };
  const [protocol, participant] = await Promise.all([
    getProtocolAccess(user, event.showId),
    prisma.eventParticipant.findFirst({
      where: {
        eventId: event.id,
        userId: user.id,
        OR: [{ invited: true }, { attendance: { in: [...HERE] } }],
      },
      select: { id: true },
    }),
  ]);
  return { canUse: Boolean(protocol || participant), canManage: protocol === "full" };
}

/** Löscht Medien samt Dateien im Speicher. */
export async function deleteEventMedia(where: { id?: { in: string[] }; noteId?: string }) {
  const rows = await prisma.eventMedia.findMany({
    where,
    select: { id: true, bucket: true, storageKey: true, thumbKey: true },
  });
  if (!rows.length) return 0;
  await prisma.eventMedia.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } });
  await deleteObjects(
    rows.flatMap((row) => [
      { bucket: row.bucket, key: row.storageKey },
      ...(row.thumbKey ? [{ bucket: row.bucket, key: row.thumbKey }] : []),
    ]),
  ).catch((error) => console.error("[media] Dateien im Speicher nicht gelöscht", error));
  return rows.length;
}

/** Gespeicherte Dateien von Terminen – vor dem Löschen der Termine merken, danach entfernen. */
export async function storedObjectsOfEvents(eventIds: readonly string[]) {
  const rows = await prisma.eventMedia.findMany({
    where: { eventId: { in: [...eventIds] } },
    select: { bucket: true, storageKey: true, thumbKey: true },
  });
  return rows.flatMap((row) => [
    { bucket: row.bucket, key: row.storageKey },
    ...(row.thumbKey ? [{ bucket: row.bucket, key: row.thumbKey }] : []),
  ]);
}

/** Nach dem Löschen von Terminen deren Dateien entfernen (Fehler nur protokollieren). */
export async function removeStoredObjects(objects: readonly { bucket: string; key: string }[]) {
  if (!objects.length) return;
  await deleteObjects(objects).catch((error) =>
    console.error("[media] Dateien gelöschter Termine nicht entfernt", error),
  );
}

/** Medien eines Termins für die Anzeige (ohne Speicherpfade). */
export type EventMediaItem = {
  id: string;
  kind: EventMediaKind;
  gallery: boolean;
  blockId: string | null;
  noteId: string | null;
  fileName: string;
  mimeType: string;
  fileSize: number;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  caption: string | null;
  uploadedById: string | null;
  createdAt: string;
  url: string;
  thumbUrl: string | null;
};

export function mediaUrl(eventId: string, mediaId: string, thumb = false) {
  return `/api/termine/${eventId}/media/${mediaId}${thumb ? "?vorschau=1" : ""}`;
}

export function toEventMediaItem(row: {
  id: string;
  eventId: string;
  kind: EventMediaKind;
  gallery: boolean;
  blockId: string | null;
  noteId: string | null;
  fileName: string;
  mimeType: string;
  fileSize: number;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  caption: string | null;
  uploadedById: string | null;
  thumbKey: string | null;
  createdAt: Date;
}): EventMediaItem {
  return {
    id: row.id,
    kind: row.kind,
    gallery: row.gallery,
    blockId: row.blockId,
    noteId: row.noteId,
    fileName: row.fileName,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
    durationSec: row.durationSec,
    width: row.width,
    height: row.height,
    caption: row.caption,
    uploadedById: row.uploadedById,
    createdAt: row.createdAt.toISOString(),
    url: mediaUrl(row.eventId, row.id),
    thumbUrl: row.thumbKey ? mediaUrl(row.eventId, row.id, true) : null,
  };
}

export async function readEventMedia(eventId: string) {
  const rows = await prisma.eventMedia.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toEventMediaItem);
}

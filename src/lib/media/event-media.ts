import type { EventMediaKind } from "@prisma/client";
import sharp from "sharp";

import { getProtocolAccess } from "@/lib/calendar/protocol-server";
import { DEFAULT_TIME_ZONE } from "@/lib/date-time";
import { prisma } from "@/lib/prisma";
import { toEventMediaItem } from "@/lib/media/event-media-item";
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

type PermissionUser = Parameters<typeof getProtocolAccess>[0];

export type EventMediaAccess = {
  /** Ansehen und Hochladen: Eingeladene, tatsächlich Anwesende und wer das Protokoll führt. */
  canUse: boolean;
  /** Alle Medien löschen und an Ablaufpunkte hängen (Protokollführung); sonst nur eigene. */
  canManage: boolean;
};

export async function getEventMediaAccess(
  user: PermissionUser,
  event: { id: string; showId: string | null },
): Promise<EventMediaAccess> {
  const access = await getProtocolAccess(user, event.showId, event.id);
  return { canUse: access !== null, canManage: access === "full" };
}

/**
 * Eigene Uploads, die nie an einen Eintrag gehängt wurden (Eingabe abgebrochen), nach einem Tag
 * entfernen.
 */
export async function deleteAbandonedMedia(userId: string, now = new Date()) {
  const ids = await prisma.eventMedia.findMany({
    where: {
      uploadedById: userId,
      noteId: null,
      blockId: null,
      gallery: false,
      createdAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
    },
    select: { id: true },
  });
  if (ids.length) await deleteEventMedia({ id: { in: ids.map((row) => row.id) } });
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

export async function readEventMedia(eventId: string) {
  const rows = await prisma.eventMedia.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toEventMediaItem);
}

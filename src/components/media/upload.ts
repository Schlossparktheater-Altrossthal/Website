import type { ProtocolMedia } from "@/lib/calendar/protocol";

/** Fotos vor dem Hochladen verkleinern: spart Datenvolumen und wandelt HEIC (iPhone) in JPEG. */
const UPLOAD_MAX_EDGE = 2400;

async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, UPLOAD_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const heic = /hei[cf]/i.test(file.type);
    if (scale === 1 && !heic && file.size < 4 * 1024 * 1024) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.88),
    );
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, "") || "foto";
    return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
  } catch {
    // Browser kann das Format nicht lesen: Original schicken, der Server versucht es selbst.
    return file;
  }
}

export type UploadFields = {
  noteId?: string;
  blockId?: string;
  gallery?: boolean;
  memo?: boolean;
  durationSec?: number;
  caption?: string;
};

/** Lädt eine Datei zum Termin hoch; wirft mit verständlicher Meldung bei Fehlern. */
export async function uploadEventMedia(
  eventId: string,
  input: File,
  fields: UploadFields = {},
): Promise<ProtocolMedia> {
  const file = await shrinkImage(input);
  const form = new FormData();
  form.set("file", file, file.name);
  if (fields.noteId) form.set("noteId", fields.noteId);
  if (fields.blockId) form.set("blockId", fields.blockId);
  if (fields.gallery) form.set("gallery", "1");
  if (fields.memo) form.set("memo", "1");
  if (fields.durationSec) form.set("durationSec", String(Math.round(fields.durationSec)));
  if (fields.caption) form.set("caption", fields.caption);
  let response: Response;
  try {
    response = await fetch(`/api/termine/${eventId}/media`, { method: "POST", body: form });
  } catch {
    throw new Error("Keine Verbindung – Dateien lassen sich nur online hochladen.");
  }
  const data = (await response.json().catch(() => ({}))) as {
    media?: ProtocolMedia;
    error?: string;
  };
  if (!response.ok || !data.media) throw new Error(data.error ?? "Hochladen fehlgeschlagen.");
  return data.media;
}

export async function deleteEventMedia(media: Pick<ProtocolMedia, "url">) {
  const response = await fetch(media.url, { method: "DELETE" });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Löschen fehlgeschlagen.");
  }
}

export function formatDuration(seconds: number | null) {
  if (!seconds) return null;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;
}

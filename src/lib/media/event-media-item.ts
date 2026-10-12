import type { EventMediaKind } from "@prisma/client";

import type { ProtocolMedia } from "@/lib/calendar/protocol";

/** Medien eines Termins für die Anzeige (ohne Speicherpfade). */
export type EventMediaItem = ProtocolMedia;

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

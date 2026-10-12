import type { ProtocolMedia } from "@/lib/calendar/protocol";
import { getEventMediaAccess } from "@/lib/media/event-media";
import { toEventMediaItem } from "@/lib/media/event-media-item";
import { getUserDisplayName } from "@/lib/names";
import { prisma } from "@/lib/prisma";
import { isStorageConfigured } from "@/lib/storage/s3";

/** Probenfotos eines Termins für die Terminseite. */
export type EventGallery = {
  photos: (ProtocolMedia & { uploaderName: string | null })[];
  /** Entfernen dürfen: eigene, mit Protokollführung alle. */
  canManage: boolean;
  userId: string;
  /** Speicher eingerichtet (sonst kein Hochladen). */
  available: boolean;
  /** Beteiligte, die keine Fotos von sich möchten (Fotoerlaubnis „gar nicht“). */
  noPhotos: string[];
};

const HERE = ["PRESENT", "LATE", "LEFT_EARLY"] as const;

/** `null`, wenn die Person die Fotos nicht sehen darf (nur Eingeladene, Anwesende, Protokoll). */
export async function readEventGallery(
  user: Parameters<typeof getEventMediaAccess>[0],
  event: { id: string; showId: string | null },
): Promise<EventGallery | null> {
  if (!user?.id) return null;
  const access = await getEventMediaAccess(user, event);
  if (!access.canUse) return null;
  const [rows, refusals] = await Promise.all([
    prisma.eventMedia.findMany({
      where: { eventId: event.id, gallery: true, kind: "IMAGE" },
      orderBy: { createdAt: "desc" },
      include: {
        uploadedBy: { select: { firstName: true, lastName: true, name: true, email: true } },
      },
    }),
    event.showId
      ? prisma.photoConsent.findMany({
          where: {
            showId: event.showId,
            OR: [{ status: "noPhotos" }, { level: "none" }],
            user: {
              eventParticipations: {
                some: {
                  eventId: event.id,
                  OR: [{ invited: true }, { attendance: { in: [...HERE] } }],
                },
              },
            },
          },
          select: {
            user: { select: { firstName: true, lastName: true, name: true, email: true } },
          },
        })
      : [],
  ]);
  return {
    photos: rows.map((row) => ({
      ...toEventMediaItem(row),
      uploaderName: row.uploadedBy ? getUserDisplayName(row.uploadedBy) : null,
    })),
    canManage: access.canManage,
    userId: user.id,
    available: isStorageConfigured(),
    noPhotos: refusals
      .map((entry) => getUserDisplayName(entry.user))
      .sort((a, b) => a.localeCompare(b, "de")),
  };
}

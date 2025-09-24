import { recordSessionHeartbeat, recordSessionPath } from "@/lib/auth/session";

type PresenceAction = "join" | "leave";

type PresencePayload = {
  userId?: string | null;
  room?: string | null;
  action: PresenceAction;
  occurredAt?: Date;
};

function mapRoomToPath(room: string | null | undefined): string | null {
  if (!room) {
    return null;
  }

  const normalized = room.trim();
  if (!normalized) {
    return null;
  }

  if (normalized === "global") {
    return "/mitglieder";
  }

  if (normalized.startsWith("rehearsal_")) {
    const rehearsalId = normalized.slice("rehearsal_".length);
    if (rehearsalId) {
      return `/mitglieder/proben/${rehearsalId}`;
    }
  }

  if (normalized.startsWith("show_")) {
    const showId = normalized.slice("show_".length);
    if (showId) {
      return `/mitglieder/produktionen/${showId}`;
    }
  }

  if (normalized.startsWith("user_")) {
    return "/mitglieder";
  }

  return null;
}

export async function trackPresenceEvent({
  userId,
  room,
  action,
  occurredAt,
}: PresencePayload) {
  if (!userId) {
    return;
  }

  const timestamp = occurredAt ?? new Date();

  if (action === "join") {
    const path = mapRoomToPath(room);
    if (path) {
      await recordSessionPath({ userId }, path, timestamp);
      return;
    }
  }

  await recordSessionHeartbeat({ userId }, timestamp);
}

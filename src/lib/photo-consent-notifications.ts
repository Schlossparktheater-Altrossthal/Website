import type { Prisma, PrismaClient, PhotoConsentStatus } from "@prisma/client";

import {
  createNotification,
  dispatchNotification,
  type PreparedNotification,
} from "@/lib/notifications/notify";
import { resolveActionNotifications } from "@/lib/notifications/inbox";
import { NOTIFICATION_TYPES } from "@/lib/notifications/types";
import type { Role } from "@/lib/roles";

const BOARD_NOTIFICATION_ROLES: Role[] = ["board", "admin", "owner"];

const STATUS_LABELS: Record<PhotoConsentStatus, string> = {
  pending: "Offen",
  approved: "Freigegeben",
  rejected: "Abgelehnt",
};

export type PhotoConsentBoardNotificationDetails = {
  consentId: string;
  status: PhotoConsentStatus;
  hasDocument: boolean;
  subjectUserId: string;
  subjectName: string;
  changeType: "submitted" | "status-changed";
  actorUserId?: string | null;
  actorName?: string | null;
  rejectionReason?: string | null;
};

export type PhotoConsentBoardNotificationResult = PreparedNotification;

type SupportedClient = PrismaClient | Prisma.TransactionClient;

function uniqueRecipientIds(
  entries: { id: string }[],
  exclude: (string | null | undefined)[],
): string[] {
  const excludeSet = new Set(exclude.filter((value): value is string => Boolean(value)));
  const ids = new Set<string>();

  for (const entry of entries) {
    if (excludeSet.has(entry.id)) continue;
    ids.add(entry.id);
  }

  return Array.from(ids);
}

function resolveSeverity(status: PhotoConsentStatus): "info" | "warning" | "success" | "error" {
  switch (status) {
    case "approved":
      return "success";
    case "rejected":
      return "error";
    case "pending":
      return "warning";
    default:
      return "info";
  }
}

function buildBody(details: PhotoConsentBoardNotificationDetails): string {
  const parts: string[] = [];

  if (details.changeType === "submitted") {
    parts.push(`Neue Einreichung von ${details.subjectName}.`);
  } else if (details.actorName) {
    parts.push(`Aktualisiert von ${details.actorName}.`);
  } else {
    parts.push("Aktualisiert.");
  }

  const statusLabel = STATUS_LABELS[details.status] ?? details.status;
  parts.push(`Status: ${statusLabel}.`);
  parts.push(details.hasDocument ? "Dokument liegt vor." : "Kein Dokument hinterlegt.");

  if (details.status === "rejected") {
    const reason = details.rejectionReason?.trim();
    if (reason) {
      parts.push(`Grund: ${reason}`);
    }
  }

  return parts.join(" ");
}

export async function createPhotoConsentBoardNotification(
  client: SupportedClient,
  details: PhotoConsentBoardNotificationDetails,
): Promise<PhotoConsentBoardNotificationResult | null> {
  const recipients = await client.user.findMany({
    where: {
      OR: [
        { role: { in: BOARD_NOTIFICATION_ROLES } },
        { roles: { some: { role: { in: BOARD_NOTIFICATION_ROLES } } } },
      ],
    },
    select: { id: true },
  });

  // Geprüfte Einreichungen sind für den ganzen Vorstand erledigt.
  if (details.changeType === "status-changed" && details.status !== "pending") {
    await resolveActionNotifications(
      { type: NOTIFICATION_TYPES.PHOTO_CONSENT, groupKey: `photo-consent:${details.consentId}` },
      client,
    );
  }

  const recipientIds = uniqueRecipientIds(recipients, [details.actorUserId]);
  if (!recipientIds.length) {
    return null;
  }

  const title =
    details.changeType === "submitted"
      ? `Fotoerlaubnis eingereicht: ${details.subjectName}`
      : `Fotoerlaubnis aktualisiert: ${details.subjectName}`;
  const body = buildBody(details);

  return createNotification(client, {
    type: NOTIFICATION_TYPES.PHOTO_CONSENT,
    recipients: recipientIds,
    title,
    body,
    actionUrl: "/mitglieder/fotoerlaubnisse",
    actorId: details.actorUserId,
    // Neue Einreichungen muss der Vorstand prüfen.
    kind: details.changeType === "submitted" ? "action" : "info",
    severity: resolveSeverity(details.status),
    groupKey: `photo-consent:${details.consentId}`,
    data: { consentId: details.consentId, status: details.status },
    realtimeMetadata: { scope: "photo-consent", consentId: details.consentId },
  });
}

export async function dispatchPhotoConsentBoardNotification(
  notification: PhotoConsentBoardNotificationResult | null,
): Promise<void> {
  await dispatchNotification(notification);
}

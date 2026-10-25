import type { Prisma, PrismaClient, PhotoConsentStatus } from "@prisma/client";

import {
  createNotification,
  dispatchNotification,
  type PreparedNotification,
} from "@/lib/notifications/notify";
import { resolveActionNotifications } from "@/lib/notifications/inbox";
import { NOTIFICATION_TYPES } from "@/lib/notifications/types";
import { findUserIdsWithPermission } from "@/lib/permissions";

/** Wer Fotoerlaubnisse verwalten darf, wird benachrichtigt – einstellbar in der Rechteverwaltung. */
const PHOTO_CONSENT_MANAGE_PERMISSION = "PRIVATE.ADMIN.PHOTOCONSENT.MANAGE";

const STATUS_LABELS: Record<PhotoConsentStatus, string> = {
  pending: "Offen",
  approved: "Freigegeben",
  rejected: "Abgelehnt",
  noPhotos: "Keine Aufnahmen",
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

function describeBodyStatus(status: PhotoConsentStatus): string {
  if (status === "noPhotos") {
    return "Das Mitglied hat der Nutzung von Aufnahmen widersprochen („gar nicht“).";
  }
  return `Status: ${STATUS_LABELS[status] ?? status}.`;
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

  parts.push(describeBodyStatus(details.status));
  parts.push(details.hasDocument ? "Dokument liegt vor." : "Kein Dokument hinterlegt.");

  if (details.status === "rejected") {
    const reason = details.rejectionReason?.trim();
    if (reason) {
      parts.push(`Grund: ${reason}`);
    }
  }

  return parts.join(" ");
}

/**
 * Fotoerlaubnis-Hinweise an alle, die sie verwalten (Bereich „Verwaltung“, Thema
 * Fotoerlaubnisse).
 *
 * - Einreichung: eine Aufgabe an alle Verwaltenden.
 * - Prüfung durch eine verwaltende Person: die Aufgabe ist für alle erledigt, im Eintrag steht,
 *   wer es war. Die übrigen bekommen keinen weiteren Hinweis – es gibt nichts mehr zu tun.
 * - Änderung durch das Mitglied selbst (z. B. Widerruf): ein Hinweis an alle Verwaltenden.
 */
export async function createPhotoConsentBoardNotification(
  client: SupportedClient,
  details: PhotoConsentBoardNotificationDetails,
): Promise<PhotoConsentBoardNotificationResult | null> {
  const groupKey = `photo-consent:${details.consentId}`;
  const reviewedByBoard =
    details.changeType === "status-changed" &&
    Boolean(details.actorUserId) &&
    details.actorUserId !== details.subjectUserId;

  if (details.changeType === "status-changed" && details.status !== "pending") {
    await resolveForEveryone(client, groupKey, reviewedByBoard ? details.actorName : null);
  }
  if (reviewedByBoard) {
    return null;
  }

  const recipients = (await findUserIdsWithPermission(PHOTO_CONSENT_MANAGE_PERMISSION, client)).map(
    (id) => ({ id }),
  );
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
    category: "verwaltung",
    recipients: recipientIds,
    title,
    body,
    actionUrl: "/mitglieder/fotoerlaubnisse",
    actorId: details.actorUserId,
    // Neue Einreichungen muss der Vorstand prüfen.
    kind: details.changeType === "submitted" ? "action" : "info",
    severity: resolveSeverity(details.status),
    groupKey,
    data: { consentId: details.consentId, status: details.status },
    realtimeMetadata: { scope: "photo-consent", consentId: details.consentId },
  });
}

/** Offene Prüf-Aufgaben für alle abhaken und vermerken, wer geprüft hat. */
async function resolveForEveryone(
  client: SupportedClient,
  groupKey: string,
  resolvedByName: string | null | undefined,
) {
  // Vorher merken, welche Aufgaben noch offen sind – ältere, schon erledigte bleiben unverändert.
  const open = resolvedByName
    ? await client.notification.findMany({
        where: {
          type: NOTIFICATION_TYPES.PHOTO_CONSENT,
          groupKey,
          kind: "action",
          recipients: { some: { doneAt: null } },
        },
        select: { id: true, data: true },
      })
    : [];
  await resolveActionNotifications({ type: NOTIFICATION_TYPES.PHOTO_CONSENT, groupKey }, client);

  for (const notification of open) {
    const data =
      notification.data &&
      typeof notification.data === "object" &&
      !Array.isArray(notification.data)
        ? notification.data
        : {};
    await client.notification.update({
      where: { id: notification.id },
      data: { data: { ...data, resolvedByName } },
    });
  }
}

export async function dispatchPhotoConsentBoardNotification(
  notification: PhotoConsentBoardNotificationResult | null,
): Promise<void> {
  await dispatchNotification(notification);
}

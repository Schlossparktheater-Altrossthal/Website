import type { Prisma, PrismaClient, PhotoConsentStatus } from "@prisma/client";

import { sendNotification } from "@/lib/realtime/triggers";
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

export type PhotoConsentBoardNotificationResult = {
  consentId: string;
  recipientIds: string[];
  title: string;
  body: string;
  severity: "info" | "warning" | "success" | "error";
};

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

  const recipientIds = uniqueRecipientIds(recipients, [details.actorUserId]);
  if (!recipientIds.length) {
    return null;
  }

  const title =
    details.changeType === "submitted"
      ? `Fotoerlaubnis eingereicht: ${details.subjectName}`
      : `Fotoerlaubnis aktualisiert: ${details.subjectName}`;
  const body = buildBody(details);

  await client.notification.create({
    data: {
      title,
      body,
      type: "photo-consent",
      recipients: {
        create: recipientIds.map((userId) => ({ userId })),
      },
    },
  });

  return {
    consentId: details.consentId,
    recipientIds,
    title,
    body,
    severity: resolveSeverity(details.status),
  };
}

export async function dispatchPhotoConsentBoardNotification(
  notification: PhotoConsentBoardNotificationResult,
): Promise<void> {
  if (!notification.recipientIds.length) {
    return;
  }

  await Promise.all(
    notification.recipientIds.map((userId) =>
      sendNotification({
        targetUserId: userId,
        title: notification.title,
        body: notification.body,
        type: notification.severity,
        actionUrl: "/mitglieder/fotoerlaubnisse",
        metadata: { scope: "photo-consent", consentId: notification.consentId },
      }),
    ),
  );
}

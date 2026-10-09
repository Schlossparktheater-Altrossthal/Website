import { notify } from "@/lib/notifications/notify";
import { NOTIFICATION_TYPES } from "@/lib/notifications/types";
import { prisma } from "@/lib/prisma";

/** Wer etwas angefordert hat, erfährt, wenn es fertig ist. */
export async function notifyRequestersIfReady(objectId: string, status: string, actorId?: string) {
  if (status !== "ready") return;
  const object = await prisma.productionObject.findUnique({
    where: { id: objectId },
    select: {
      title: true,
      showId: true,
      department: { select: { name: true } },
      requirements: { where: { status: "assigned" }, select: { requestedById: true } },
    },
  });
  const recipients = [
    ...new Set(
      object?.requirements.map((entry) => entry.requestedById).filter((id): id is string => !!id),
    ),
  ];
  if (!object || !recipients.length) return;
  await notify({
    type: NOTIFICATION_TYPES.SCENE_REQUIREMENT,
    recipients,
    actorId,
    title: `Fertig: ${object.title}`,
    body: `${object.department.name} hat „${object.title}“ als fertig markiert.`,
    actionUrl: "/mitglieder/produktionen/stueck",
    showId: object.showId,
  });
}

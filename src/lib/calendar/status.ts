import type { EventStatus } from "@prisma/client";

/** Status, in denen Mitglieder einen Termin sehen: vorgemerkt oder angesetzt. */
export const VISIBLE_EVENT_STATUSES = ["TENTATIVE", "SCHEDULED"] satisfies EventStatus[];

export const visibleEventStatus = { in: VISIBLE_EVENT_STATUSES };

export function isVisibleStatus(status: EventStatus) {
  return (VISIBLE_EVENT_STATUSES as EventStatus[]).includes(status);
}

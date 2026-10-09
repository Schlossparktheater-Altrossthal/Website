import type { EventStatus } from "@prisma/client";

/** Status, in denen Mitglieder einen Termin sehen: vorgemerkt oder angesetzt. */
export const VISIBLE_EVENT_STATUSES = ["TENTATIVE", "SCHEDULED"] satisfies EventStatus[];

export const visibleEventStatus = { in: VISIBLE_EVENT_STATUSES };

export function isVisibleStatus(status: EventStatus) {
  return (VISIBLE_EVENT_STATUSES as EventStatus[]).includes(status);
}

/**
 * Status in Terminlisten und Kalendern: wie oben, plus abgesagte Termine, damit niemand
 * glaubt, ein Termin sei nur verschwunden. Für Planung, Erinnerungen und Verfügbarkeit
 * zählt weiter nur `visibleEventStatus`.
 */
export const LISTED_EVENT_STATUSES = [
  ...VISIBLE_EVENT_STATUSES,
  "CANCELLED",
] satisfies EventStatus[];

export const listedEventStatus = { in: LISTED_EVENT_STATUSES };

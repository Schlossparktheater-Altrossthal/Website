import type { AttendanceStatus } from "@prisma/client";

/** Zusage-Stufen für Termine ohne Notfall-Absage (Gewerk- und allgemeine Termine). */
export const EVENT_RESPONSE_STATUSES = [
  "yes",
  "maybe",
  "no",
] as const satisfies readonly AttendanceStatus[];

export type EventResponseStatus = (typeof EVENT_RESPONSE_STATUSES)[number];

/** Notfall-Absagen zählen dort als Absage. */
export function toEventResponseStatus(value: AttendanceStatus): EventResponseStatus;
export function toEventResponseStatus(value: AttendanceStatus | null): EventResponseStatus | null;
export function toEventResponseStatus(value: AttendanceStatus | null) {
  return value === "emergency" ? "no" : value;
}

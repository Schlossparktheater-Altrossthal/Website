import { z } from "zod";

import { CALENDAR_EVENT_KINDS } from "@/lib/calendar/event-kinds";
import { parseDateTimeInTimeZone } from "@/lib/date-time";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const time = /^([01]\d|2[0-3]):[0-5]\d$/;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null));

/** Eingabe aus dem Termin-Dialog: Datum und Uhrzeiten in Berliner Ortszeit. */
export const calendarEventInputSchema = z
  .object({
    title: z.string().trim().min(1, "Titel fehlt").max(120),
    kind: z.enum(CALENDAR_EVENT_KINDS),
    date: z.string().regex(isoDate),
    endDate: z.string().regex(isoDate).optional().nullable(),
    allDay: z.boolean(),
    startTime: z.string().regex(time).optional().nullable(),
    endTime: z.string().regex(time).optional().nullable(),
    location: optionalText(160),
    description: optionalText(2000),
    showId: z.string().min(1).optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (!value.allDay && !value.startTime) {
      ctx.addIssue({ code: "custom", path: ["startTime"], message: "Beginn fehlt" });
    }
    if (value.endDate && value.endDate < value.date) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "Ende liegt vor dem Beginn" });
    }
  });

export type CalendarEventInput = z.infer<typeof calendarEventInputSchema>;

/** Wandelt die Dialog-Eingabe in Start/Ende (UTC) um. Ganztägig = 00:00 bis 23:59 Ortszeit. */
export function resolveCalendarEventTimes(input: CalendarEventInput) {
  const endDate = input.endDate ?? input.date;
  if (input.allDay) {
    return {
      start: parseDateTimeInTimeZone(input.date, "00:00"),
      end: parseDateTimeInTimeZone(endDate, "23:59"),
    };
  }
  const start = parseDateTimeInTimeZone(input.date, input.startTime ?? "00:00");
  const end = input.endTime ? parseDateTimeInTimeZone(endDate, input.endTime) : null;
  if (end && end.getTime() <= start.getTime()) {
    return { start, end: null };
  }
  return { start, end };
}

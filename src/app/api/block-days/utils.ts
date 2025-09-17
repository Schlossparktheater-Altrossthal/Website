import { format } from "date-fns";
import { z } from "zod";

export const isoDate = /^\d{4}-\d{2}-\d{2}$/;

export const reasonSchema = z
  .string()
  .max(200, "Der Grund darf höchstens 200 Zeichen lang sein.")
  .optional()
  .nullable();

export type BlockDayResponse = {
  id: string;
  date: string;
  reason: string | null;
};

export function normaliseReason(input?: string | null) {
  if (!input) return null;
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function toDateOnly(date: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Ungültiges Datum");
  }
  return parsed;
}

export function toResponse(entry: { id: string; date: Date; reason: string | null }): BlockDayResponse {
  return {
    id: entry.id,
    date: format(entry.date, "yyyy-MM-dd"),
    reason: entry.reason,
  };
}

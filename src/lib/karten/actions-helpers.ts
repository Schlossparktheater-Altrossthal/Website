import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createLogger } from "@/lib/logger";

import { TicketAccessError } from "./access";
import { BookingError } from "./booking";
import { BOX_OFFICE_PATH, MEMBERS_TICKETS_PATH, PUBLIC_TICKETS_PATH } from "./constants";

const logger = createLogger("karten");

export type TicketActionResult<T = undefined> =
  | ({ ok: true; message?: string } & ([T] extends [undefined]
      ? { data?: undefined }
      : { data: T }))
  | { ok: false; error: string; code?: string };

/** Fachliche Fehler gehen mit Text an die Oberfläche, alles andere nur ins Log. */
export function ticketFailure(
  error: unknown,
  fallback: string,
): { ok: false; error: string; code?: string } {
  if (error instanceof z.ZodError) {
    return { ok: false, error: error.issues[0]?.message ?? fallback };
  }
  if (error instanceof BookingError) {
    return { ok: false, error: error.message, code: error.code };
  }
  if (error instanceof TicketAccessError) {
    return { ok: false, error: error.message, code: "FORBIDDEN" };
  }
  logger.error(fallback, { error });
  return { ok: false, error: fallback };
}

export function revalidateTickets() {
  revalidatePath(MEMBERS_TICKETS_PATH, "layout");
  revalidatePath(BOX_OFFICE_PATH, "layout");
  revalidatePath(PUBLIC_TICKETS_PATH, "layout");
  revalidatePath("/mitglieder/freikarten");
}

export const optionalTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Höchstens ${max} Zeichen.`)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null));

export const itemsSchema = z
  .array(z.object({ categoryId: z.string().min(1), quantity: z.number().int().min(0).max(500) }))
  .max(30);

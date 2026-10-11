"use server";

import { z } from "zod";

import {
  BOX_OFFICE_DEFAULT_DAYS,
  createBoxOfficeAccess,
  requireTicketActor,
  rotateBoxOfficeAccessToken,
} from "@/lib/karten/access";
import {
  optionalTrimmed,
  revalidateTickets,
  ticketFailure,
  type TicketActionResult,
} from "@/lib/karten/actions-helpers";
import { boxOfficeAccessLink, sendBoxOfficeAccess } from "@/lib/karten/mails";
import { prisma } from "@/lib/prisma";

async function requireManager(showId?: string | null) {
  const actor = await requireTicketActor("manage", showId);
  if (actor.kind !== "member") throw new Error("Nur für Mitglieder.");
  return actor;
}

const settingsSchema = z.object({
  enabled: z.boolean(),
  holdMinutes: z
    .number()
    .int()
    .min(15, "Mindestens 15 Minuten.")
    .max(7 * 24 * 60),
  maxSeatsPerBooking: z.number().int().min(1).max(100),
  freeTicketsPerMember: z.number().int().min(0).max(20),
  freeTicketDeadline: z.coerce.date().nullable(),
  infoText: optionalTrimmed(2000),
  retentionDays: z.number().int().min(7).max(730),
});

export async function saveTicketingSettingsAction(
  showId: string,
  input: z.input<typeof settingsSchema>,
): Promise<TicketActionResult> {
  try {
    await requireManager(showId);
    const data = settingsSchema.parse(input);
    await prisma.ticketingSettings.upsert({
      where: { showId },
      create: { showId, ...data },
      update: data,
    });
    revalidateTickets();
    return { ok: true, message: "Einstellungen gespeichert." };
  } catch (error) {
    return ticketFailure(error, "Einstellungen konnten nicht gespeichert werden.");
  }
}

const categorySchema = z.object({
  name: z.string().trim().min(1, "Bitte einen Namen angeben.").max(60),
  description: optionalTrimmed(200),
  priceCents: z.number().int().min(0).max(100_000),
  needsSeat: z.boolean(),
  onlineBookable: z.boolean(),
  isActive: z.boolean(),
});

export async function saveTicketCategoryAction(
  showId: string,
  categoryId: string | null,
  input: z.input<typeof categorySchema>,
): Promise<TicketActionResult> {
  try {
    await requireManager(showId);
    const data = categorySchema.parse(input);
    if (categoryId) {
      await prisma.ticketCategory.update({ where: { id: categoryId, showId }, data });
    } else {
      const last = await prisma.ticketCategory.aggregate({
        where: { showId },
        _max: { sortOrder: true },
      });
      await prisma.ticketCategory.create({
        data: { showId, ...data, sortOrder: (last._max.sortOrder ?? -1) + 1 },
      });
    }
    revalidateTickets();
    return { ok: true, message: categoryId ? "Kartenart gespeichert." : "Kartenart angelegt." };
  } catch (error) {
    return ticketFailure(error, "Kartenart konnte nicht gespeichert werden.");
  }
}

/** Mit Buchungen wird nur ausgeblendet, sonst gelöscht. */
export async function deleteTicketCategoryAction(categoryId: string): Promise<TicketActionResult> {
  try {
    const category = await prisma.ticketCategory.findUniqueOrThrow({
      where: { id: categoryId },
      select: { showId: true, _count: { select: { items: true } } },
    });
    await requireManager(category.showId);
    if (category._count.items > 0) {
      await prisma.ticketCategory.update({ where: { id: categoryId }, data: { isActive: false } });
      revalidateTickets();
      return { ok: true, message: "Kartenart hat Buchungen und wurde deaktiviert." };
    }
    await prisma.ticketCategory.delete({ where: { id: categoryId } });
    revalidateTickets();
    return { ok: true, message: "Kartenart gelöscht." };
  } catch (error) {
    return ticketFailure(error, "Kartenart konnte nicht gelöscht werden.");
  }
}

export async function moveTicketCategoryAction(
  categoryId: string,
  direction: -1 | 1,
): Promise<TicketActionResult> {
  try {
    const category = await prisma.ticketCategory.findUniqueOrThrow({ where: { id: categoryId } });
    await requireManager(category.showId);
    const siblings = await prisma.ticketCategory.findMany({
      where: { showId: category.showId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    });
    const index = siblings.findIndex((entry) => entry.id === categoryId);
    const target = index + direction;
    if (target < 0 || target >= siblings.length) return { ok: true };
    const order = siblings.map((entry) => entry.id);
    [order[index], order[target]] = [order[target], order[index]];
    await prisma.$transaction(
      order.map((id, sortOrder) =>
        prisma.ticketCategory.update({ where: { id }, data: { sortOrder } }),
      ),
    );
    revalidateTickets();
    return { ok: true };
  } catch (error) {
    return ticketFailure(error, "Reihenfolge konnte nicht geändert werden.");
  }
}

const performanceSchema = z
  .object({
    capacity: z.number().int().min(0).max(100_000),
    onlineLimit: z.number().int().min(0).max(100_000).nullable(),
    boxOfficeReserve: z.number().int().min(0).max(100_000),
    salesOpen: z.boolean(),
    salesEndAt: z.coerce.date().nullable(),
  })
  .refine((value) => value.boxOfficeReserve <= value.capacity, {
    message: "Die Reserve kann nicht größer als die Kapazität sein.",
  });

export async function savePerformanceTicketingAction(
  eventIds: string[],
  input: z.input<typeof performanceSchema>,
): Promise<TicketActionResult> {
  try {
    const ids = z.array(z.string().min(1)).min(1).max(100).parse(eventIds);
    const data = performanceSchema.parse(input);
    const events = await prisma.calendarEvent.findMany({
      where: { id: { in: ids }, kind: "PERFORMANCE" },
      select: { id: true, showId: true },
    });
    if (events.length !== ids.length) throw new Error("Vorstellung nicht gefunden.");
    for (const showId of new Set(events.map((event) => event.showId))) {
      await requireManager(showId);
    }
    await prisma.$transaction(
      ids.map((eventId) =>
        prisma.performanceTicketing.upsert({
          where: { eventId },
          create: { eventId, ...data },
          update: data,
        }),
      ),
    );
    revalidateTickets();
    return {
      ok: true,
      message:
        ids.length > 1 ? `${ids.length} Vorstellungen gespeichert.` : "Vorstellung gespeichert.",
    };
  } catch (error) {
    return ticketFailure(error, "Vorstellung konnte nicht gespeichert werden.");
  }
}

export async function setFreeTicketAllowanceAction(
  showId: string,
  userId: string,
  quantity: number | null,
): Promise<TicketActionResult> {
  try {
    await requireManager(showId);
    if (quantity === null) {
      await prisma.freeTicketAllowance.deleteMany({ where: { showId, userId } });
    } else {
      const value = z.number().int().min(0).max(50).parse(quantity);
      await prisma.freeTicketAllowance.upsert({
        where: { showId_userId: { showId, userId } },
        create: { showId, userId, quantity: value },
        update: { quantity: value },
      });
    }
    revalidateTickets();
    return { ok: true };
  } catch (error) {
    return ticketFailure(error, "Kontingent konnte nicht gespeichert werden.");
  }
}

const accessSchema = z.object({
  name: z.string().trim().min(1, "Bitte einen Namen angeben.").max(80),
  email: z.string().trim().email("Bitte eine gültige E-Mail-Adresse angeben."),
  canCheckIn: z.boolean(),
  days: z.number().int().min(1).max(365).default(BOX_OFFICE_DEFAULT_DAYS),
});

export async function createBoxOfficeAccessAction(
  showId: string,
  input: z.input<typeof accessSchema>,
): Promise<TicketActionResult<{ link: string | null; mailed: boolean }>> {
  try {
    const actor = await requireManager(showId);
    const data = accessSchema.parse(input);
    const expiresAt = new Date(Date.now() + data.days * 86_400_000);
    const { access, token } = await createBoxOfficeAccess({
      name: data.name,
      email: data.email,
      showId,
      canCheckIn: data.canCheckIn,
      expiresAt,
      createdById: actor.userId,
    });
    const mailed = await sendBoxOfficeAccess({
      email: access.email,
      name: access.name,
      token,
      expiresAt,
    });
    revalidateTickets();
    return {
      ok: true,
      message: mailed ? `Zugangslink an ${access.email} gesendet.` : "Zugang angelegt.",
      data: { link: mailed ? null : boxOfficeAccessLink(token), mailed },
    };
  } catch (error) {
    return ticketFailure(error, "Zugang konnte nicht angelegt werden.");
  }
}

/** Neuen Link senden (z. B. neues Gerät); der alte Link wird ungültig. */
export async function resendBoxOfficeAccessAction(
  accessId: string,
): Promise<TicketActionResult<{ link: string | null; mailed: boolean }>> {
  try {
    const existing = await prisma.boxOfficeAccess.findUniqueOrThrow({ where: { id: accessId } });
    await requireManager(existing.showId);
    const { access, token } = await rotateBoxOfficeAccessToken(accessId);
    const mailed = await sendBoxOfficeAccess({
      email: access.email,
      name: access.name,
      token,
      expiresAt: access.expiresAt,
    });
    revalidateTickets();
    return {
      ok: true,
      message: mailed ? `Neuer Link an ${access.email} gesendet.` : "Neuer Link erstellt.",
      data: { link: mailed ? null : boxOfficeAccessLink(token), mailed },
    };
  } catch (error) {
    return ticketFailure(error, "Link konnte nicht erneuert werden.");
  }
}

export async function revokeBoxOfficeAccessAction(accessId: string): Promise<TicketActionResult> {
  try {
    const existing = await prisma.boxOfficeAccess.findUniqueOrThrow({ where: { id: accessId } });
    await requireManager(existing.showId);
    await prisma.boxOfficeAccess.update({
      where: { id: accessId },
      data: { revokedAt: new Date() },
    });
    revalidateTickets();
    return { ok: true, message: "Zugang gesperrt." };
  } catch (error) {
    return ticketFailure(error, "Zugang konnte nicht gesperrt werden.");
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DepartmentMembershipRole } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIME = /^\d{2}:\d{2}$/;

const optionalTimeSchema = z
  .string()
  .trim()
  .refine((value) => value.length === 0 || ISO_TIME.test(value), {
    message: "Ungültige Uhrzeit",
  })
  .transform((value) => (value.length ? value : undefined))
  .optional();

const optionalStringSchema = (min: number, max: number, message?: string) =>
  z
    .string()
    .trim()
    .refine((value) => value.length === 0 || value.length >= min, {
      message: message ?? `Mindestens ${min} Zeichen erforderlich`,
    })
    .max(max, `Maximal ${max} Zeichen erlaubt`)
    .transform((value) => (value.length ? value : undefined))
    .optional();

const createSchema = z.object({
  departmentId: z.string().min(1, "Ungültiges Gewerk"),
  departmentSlug: z.string().min(1, "Ungültiges Gewerk"),
  title: z
    .string()
    .trim()
    .min(3, "Titel ist zu kurz")
    .max(120, "Titel ist zu lang"),
  date: z.string().regex(ISO_DATE, "Ungültiges Datum"),
  startTime: z.string().regex(ISO_TIME, "Ungültige Uhrzeit"),
  endTime: optionalTimeSchema,
  location: optionalStringSchema(2, 120, "Ort ist zu kurz"),
  description: optionalStringSchema(0, 2000),
});

const deleteSchema = z.object({
  eventId: z.string().min(1, "Ungültiger Termin"),
});

function combineDateTime(date: string, time: string) {
  const value = new Date(`${date}T${time}`);
  if (Number.isNaN(value.getTime())) {
    throw new Error("Ungültige Kombination aus Datum und Uhrzeit.");
  }
  return value;
}

function ensureEndAfterStart(start: Date, end: Date) {
  if (end.getTime() <= start.getTime()) {
    throw new Error("Ende muss nach dem Start liegen.");
  }
}

async function ensureDepartmentLead(departmentId: string) {
  const session = await requireAuth();
  const userId = session.user?.id;
  if (!userId) {
    return { ok: false as const, error: "Keine Berechtigung." };
  }

  const membership = await prisma.departmentMembership.findFirst({
    where: { departmentId, userId },
    select: { role: true },
  });

  if (!membership || membership.role !== DepartmentMembershipRole.lead) {
    return { ok: false as const, error: "Nur die Leitung kann Termine planen." };
  }

  return { ok: true as const, userId };
}

export async function createDepartmentEventAction(input: {
  departmentId: string;
  departmentSlug: string;
  title: string;
  date: string;
  startTime: string;
  endTime?: string;
  location?: string;
  description?: string;
}) {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.message ?? "Eingaben konnten nicht verarbeitet werden." } as const;
  }

  const auth = await ensureDepartmentLead(parsed.data.departmentId);
  if (!auth.ok) {
    return { error: auth.error } as const;
  }

  const start = combineDateTime(parsed.data.date, parsed.data.startTime);
  let end: Date | null = null;
  if (parsed.data.endTime) {
    end = combineDateTime(parsed.data.date, parsed.data.endTime);
    ensureEndAfterStart(start, end);
  } else {
    end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  }

  const event = await prisma.departmentEvent.create({
    data: {
      departmentId: parsed.data.departmentId,
      title: parsed.data.title,
      start,
      end,
      location: parsed.data.location ?? null,
      description: parsed.data.description ?? null,
      createdById: auth.userId,
    },
    select: { id: true },
  });

  revalidatePath(`/mitglieder/meine-gewerke/${parsed.data.departmentSlug}`);
  revalidatePath("/mitglieder/meine-gewerke");

  return { success: true as const, id: event.id };
}

export async function deleteDepartmentEventAction(input: { eventId: string }) {
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.message ?? "Der Termin konnte nicht entfernt werden." } as const;
  }

  const event = await prisma.departmentEvent.findUnique({
    where: { id: parsed.data.eventId },
    select: {
      departmentId: true,
      department: { select: { slug: true } },
    },
  });

  if (!event) {
    return { error: "Der Termin existiert nicht mehr." } as const;
  }

  const auth = await ensureDepartmentLead(event.departmentId);
  if (!auth.ok) {
    return { error: auth.error } as const;
  }

  await prisma.departmentEvent.delete({ where: { id: parsed.data.eventId } });

  const slug = event.department?.slug;
  if (slug) {
    revalidatePath(`/mitglieder/meine-gewerke/${slug}`);
  }
  revalidatePath("/mitglieder/meine-gewerke");

  return { success: true as const };
}

"use server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { z } from "zod";

const EntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind: z.enum(["FULL_AVAILABLE", "FULL_UNAVAILABLE", "PARTIAL"]),
  from: z.string().optional(),
  to: z.string().optional(),
  note: z.string().max(280).optional(),
});

const UpsertSchema = z.object({
  year: z.number().min(1970).max(2100),
  month: z.number().min(1).max(12),
  entries: z.array(EntrySchema),
});

function hmToMin(hm?: string | null) {
  if (!hm) return undefined;
  const m = hm.match(/^(\d{2}):(\d{2})$/);
  if (!m) return undefined;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(min)) return undefined;
  return h * 60 + min;
}

function ymToRangeUtc(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}

export async function upsertMonthAvailability(input: z.infer<typeof UpsertSchema>) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");
  const parsed = UpsertSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid data");
  const { year, month, entries } = parsed.data;
  const { start, end } = ymToRangeUtc(year, month);
  const userId = session.user.id;

  // Validate times for PARTIAL
  for (const e of entries) {
    if (e.kind === "PARTIAL") {
      const f = hmToMin(e.from);
      const t = hmToMin(e.to);
      if (f == null || t == null || f >= t) {
        throw new Error(`Ungültiges Zeitfenster am ${e.date}`);
      }
    }
  }

  // Upsert all entries
  for (const e of entries) {
    const day = new Date(e.date + "T00:00:00.000Z");
    if (day < start || day >= end) continue; // Ignore outside month
    const data = {
      userId,
      date: day,
      kind: e.kind as any,
      availableFromMin: e.kind === "PARTIAL" ? hmToMin(e.from) ?? null : null,
      availableToMin: e.kind === "PARTIAL" ? hmToMin(e.to) ?? null : null,
      note: e.note ?? null,
    };
    await prisma.availabilityDay.upsert({
      where: { userId_date: { userId, date: day } },
      update: data,
      create: data,
    });
  }
  return { ok: true } as const;
}

export async function applyTemplateForMonth(year: number, month: number) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");
  const userId = session.user.id;
  if (!(year >= 1970 && year <= 2100 && month >= 1 && month <= 12)) throw new Error("Ungültiger Monat");
  const { start, end } = ymToRangeUtc(year, month);

  const templates = await prisma.availabilityTemplate.findMany({ where: { userId } });
  if (templates.length === 0) return { ok: true } as const;

  // Map weekday -> template (prefer the first found for simplicity)
  const map = new Map<number, (typeof templates)[number]>();
  for (const t of templates) {
    map.set(t.weekday, t);
  }

  // Create entries only for days without existing record
  const existing = await prisma.availabilityDay.findMany({ where: { userId, date: { gte: start, lt: end } } });
  const exists = new Set(existing.map((d) => d.date.toISOString()));

  const toCreate: any[] = [];
  for (let d = new Date(start); d < end; d = new Date(d.getTime() + 86400000)) {
    if (exists.has(d.toISOString())) continue;
    const wd = d.getUTCDay();
    const t = map.get(wd);
    if (!t) continue;
    // Valid range check
    if (t.validFrom && d < t.validFrom) continue;
    if (t.validTo && d > t.validTo) continue;
    toCreate.push({
      userId,
      date: d,
      kind: t.kind,
      availableFromMin: t.availableFromMin ?? null,
      availableToMin: t.availableToMin ?? null,
      note: null,
    });
  }
  if (toCreate.length) {
    await prisma.availabilityDay.createMany({ data: toCreate, skipDuplicates: true });
  }
  return { ok: true } as const;
}

// Save weekday templates (7 entries recommended). Overwrites existing per weekday (without validity range)
const TemplateEntry = z.object({
  weekday: z.number().int().min(0).max(6),
  kind: z.enum(["FULL_AVAILABLE", "FULL_UNAVAILABLE", "PARTIAL"]),
  from: z.string().optional(),
  to: z.string().optional(),
});
export async function saveWeekdayTemplates(input: { templates: z.infer<typeof TemplateEntry>[] }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");
  const parsed = z.object({ templates: z.array(TemplateEntry) }).safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid data");
  const userId = session.user.id;
  const { templates } = parsed.data;

  // Validate partial times
  for (const t of templates) {
    if (t.kind === "PARTIAL") {
      const f = hmToMin(t.from);
      const to = hmToMin(t.to);
      if (f == null || to == null || f >= to) throw new Error("Ungültige Zeit im Template");
    }
  }

  // Upsert by deleting existing (no valid range) for provided weekdays then recreating
  const weekdays = Array.from(new Set(templates.map((t) => t.weekday)));
  await prisma.availabilityTemplate.deleteMany({ where: { userId, weekday: { in: weekdays }, validFrom: null, validTo: null } });
  const data = templates.map((t) => ({
    userId,
    weekday: t.weekday,
    kind: t.kind as any,
    availableFromMin: t.kind === "PARTIAL" ? hmToMin(t.from) ?? null : null,
    availableToMin: t.kind === "PARTIAL" ? hmToMin(t.to) ?? null : null,
    validFrom: null as Date | null,
    validTo: null as Date | null,
  }));
  if (data.length) await prisma.availabilityTemplate.createMany({ data });
  return { ok: true } as const;
}

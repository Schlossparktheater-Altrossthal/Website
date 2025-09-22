import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { z } from "zod";
import { isoDate, normaliseReason, toDateOnly, toResponse } from "../utils";
import { BlockedDayKind } from "@prisma/client";

type SessionUser = { id?: string } | null | undefined;

const bulkCreateSchema = z.object({
  dates: z.array(z.string().regex(isoDate)).min(1),
  reason: z.string().max(200).optional().nullable(),
  kind: z.nativeEnum(BlockedDayKind).optional(),
});

const bulkDeleteSchema = z.object({
  dates: z.array(z.string().regex(isoDate)).min(1),
});

export async function POST(request: Request) {
  const session = await requireAuth();
  const userId = (session.user as SessionUser)?.id;
  if (!userId) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const parsed = bulkCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });

  const uniqueDates = Array.from(new Set(parsed.data.dates));
  const reason = normaliseReason(parsed.data.reason);
  const kind = parsed.data.kind ?? BlockedDayKind.BLOCKED;

  try {
    const todayKey = new Date().toISOString().slice(0, 10);
    const today = toDateOnly(todayKey);
    const cutoff = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const parsedDates = uniqueDates.map((d) => ({ key: d, date: toDateOnly(d) }));
    const allowed = parsedDates.filter((p) => p.date.getTime() >= cutoff.getTime());
    const skipped = parsedDates.filter((p) => p.date.getTime() < cutoff.getTime()).map((p) => p.key);

    const payload = allowed.map((p) => ({ userId, date: p.date, reason, kind }));
    if (payload.length === 0) return NextResponse.json({ created: [], skipped });

    await prisma.blockedDay.createMany({ data: payload, skipDuplicates: true });

    const created = await prisma.blockedDay.findMany({
      where: { userId, date: { in: payload.map((p) => p.date) } },
      orderBy: { date: "asc" },
    });

    return NextResponse.json({ created: created.map(toResponse), skipped });
  } catch (error) {
    console.error("[block-days:bulk POST]", error);
    return NextResponse.json({ error: "Speichern fehlgeschlagen" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await requireAuth();
  const userId = (session.user as SessionUser)?.id;
  if (!userId) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  const parsed = bulkDeleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });

  const uniqueDates = Array.from(new Set(parsed.data.dates));
  const dates = uniqueDates.map((d) => toDateOnly(d));

  try {
    const result = await prisma.blockedDay.deleteMany({ where: { userId, date: { in: dates } } });
    return NextResponse.json({ deleted: result.count });
  } catch (error) {
    console.error("[block-days:bulk DELETE]", error);
    return NextResponse.json({ error: "Löschen fehlgeschlagen" }, { status: 500 });
  }
}

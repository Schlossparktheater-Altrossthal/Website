import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

async function checkPermission() {
  const session = await requireAuth();
  if (!session.user) {
    return { forbidden: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const allowed = await hasPermission(session.user, "PRIVATE.CHRONIK.MANAGE");
  if (!allowed) {
    return { forbidden: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { forbidden: null };
}

export async function GET() {
  const { forbidden } = await checkPermission();
  if (forbidden) return forbidden;

  const shows = await prisma.show.findMany({
    orderBy: [{ year: "desc" }],
    select: {
      id: true,
      year: true,
      title: true,
      synopsis: true,
      dates: true,
      posterUrl: true,
      revealedAt: true,
      meta: true,
    },
  });

  return NextResponse.json({ shows });
}

const createShowSchema = z.object({
  year: z.number().int().min(1900).max(2100),
  title: z.string().min(1, "Titel ist erforderlich.").max(200),
  synopsis: z.string().max(2000).nullable().optional(),
  dates: z.string().max(280).nullable().optional(),
  posterUrl: z.string().max(500).nullable().optional(),
  revealedAt: z.string().datetime().nullable().optional(),
  meta: z.record(z.unknown()).nullable().optional(),
});

export async function POST(request: NextRequest) {
  const { forbidden } = await checkPermission();
  if (forbidden) return forbidden;

  const body = await request.json().catch(() => null);
  const parsed = createShowSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." },
      { status: 400 },
    );
  }

  const { year, title, synopsis, dates, posterUrl, revealedAt, meta } = parsed.data;
  const id = `altrossthal-${year}`;

  const existing = await prisma.show.findUnique({ where: { id } });
  if (existing) {
    return NextResponse.json(
      { error: `Eine Produktion für ${year} existiert bereits (ID: ${id}).` },
      { status: 409 },
    );
  }

  const datesValue: Prisma.InputJsonValue =
    typeof dates === "string" && dates.trim().length > 0 ? dates.trim() : Prisma.JsonNull;

  const show = await prisma.show.create({
    data: {
      id,
      year,
      title,
      synopsis: synopsis ?? null,
      dates: datesValue,
      posterUrl: posterUrl ?? null,
      revealedAt: revealedAt ? new Date(revealedAt) : null,
      meta: meta ? (meta as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
    select: {
      id: true,
      year: true,
      title: true,
      synopsis: true,
      dates: true,
      posterUrl: true,
      revealedAt: true,
      meta: true,
    },
  });

  revalidatePath("/chronik");
  return NextResponse.json({ show }, { status: 201 });
}

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

type RouteContext = { params: Promise<{ showId: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { forbidden } = await checkPermission();
  if (forbidden) return forbidden;

  const { showId } = await params;

  const show = await prisma.show.findUnique({
    where: { id: showId },
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

  if (!show) {
    return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ show });
}

const updateShowSchema = z.object({
  year: z.number().int().min(1900).max(2100).optional(),
  title: z.string().min(1, "Titel ist erforderlich.").max(200).optional(),
  synopsis: z.string().max(2000).nullable().optional(),
  dates: z.string().max(280).nullable().optional(),
  posterUrl: z.string().max(500).nullable().optional(),
  revealedAt: z.string().datetime().nullable().optional(),
  meta: z.record(z.unknown()).nullable().optional(),
});

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const { forbidden } = await checkPermission();
  if (forbidden) return forbidden;

  const { showId } = await params;

  const existing = await prisma.show.findUnique({ where: { id: showId } });
  if (!existing) {
    return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateShowSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." },
      { status: 400 },
    );
  }

  const data: Record<string, unknown> = {};

  if (parsed.data.year !== undefined) data.year = parsed.data.year;
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.synopsis !== undefined) data.synopsis = parsed.data.synopsis;
  if ("dates" in parsed.data) {
    const d = parsed.data.dates;
    data.dates = typeof d === "string" && d.trim().length > 0 ? d.trim() : Prisma.JsonNull;
  }
  if (parsed.data.posterUrl !== undefined) data.posterUrl = parsed.data.posterUrl;
  if ("revealedAt" in parsed.data) {
    data.revealedAt = parsed.data.revealedAt ? new Date(parsed.data.revealedAt) : null;
  }
  if ("meta" in parsed.data) {
    data.meta = parsed.data.meta
      ? (parsed.data.meta as Prisma.InputJsonValue)
      : Prisma.JsonNull;
  }

  const show = await prisma.show.update({
    where: { id: showId },
    data,
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
  revalidatePath(`/chronik/${showId}`);

  return NextResponse.json({ show });
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const { forbidden } = await checkPermission();
  if (forbidden) return forbidden;

  const { showId } = await params;

  const existing = await prisma.show.findUnique({ where: { id: showId } });
  if (!existing) {
    return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });
  }

  await prisma.show.delete({ where: { id: showId } });
  revalidatePath("/chronik");

  return NextResponse.json({ success: true });
}

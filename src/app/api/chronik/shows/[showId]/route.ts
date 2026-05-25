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
  meta: z.record(z.string(), z.unknown()).nullable().optional(),
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

  const show = await prisma.show.update({
    where: { id: showId },
    data: {
      ...(parsed.data.year !== undefined ? { year: parsed.data.year } : {}),
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...("synopsis" in parsed.data ? { synopsis: parsed.data.synopsis ?? null } : {}),
      ...("dates" in parsed.data
        ? {
            dates:
              typeof parsed.data.dates === "string" && parsed.data.dates.trim().length > 0
                ? parsed.data.dates.trim()
                : "",
          }
        : {}),
      ...("posterUrl" in parsed.data ? { posterUrl: parsed.data.posterUrl ?? null } : {}),
      ...("revealedAt" in parsed.data
        ? { revealedAt: parsed.data.revealedAt ? new Date(parsed.data.revealedAt) : null }
        : {}),
      ...("meta" in parsed.data
        ? {
            meta: parsed.data.meta
              ? (parsed.data.meta as Prisma.InputJsonValue)
              : Prisma.JsonNull,
          }
        : {}),
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

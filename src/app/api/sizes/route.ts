import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { sizeSchema } from "@/data/sizes";
import { canEditMeasurementsOf, isEnsembleMember } from "@/lib/measurements/access";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

const sizeRequestSchema = sizeSchema.extend({ userId: z.string().min(1).optional() });

const FORBIDDEN = { error: "Du darfst die Größen dieser Person nicht bearbeiten." };

// POST: Konfektionsgröße einer Kategorie setzen oder ändern
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const viewerId = session.user?.id;
    if (!viewerId) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

    const { userId, ...data } = sizeRequestSchema.parse(await request.json());
    const targetUserId = userId ?? viewerId;
    if (!(await canEditMeasurementsOf(session.user, targetUserId))) {
      return NextResponse.json(FORBIDDEN, { status: 403 });
    }
    if (!(await isEnsembleMember(targetUserId))) {
      return NextResponse.json(
        { error: "Größen können nur für Ensemble-Mitglieder gepflegt werden." },
        { status: 403 },
      );
    }

    const size = await prisma.memberSize.upsert({
      where: { userId_category: { userId: targetUserId, category: data.category } },
      update: { size: data.size, note: data.note || null },
      create: {
        userId: targetUserId,
        category: data.category,
        size: data.size,
        note: data.note || null,
      },
      select: { id: true, category: true, size: true, note: true },
    });
    return NextResponse.json(size);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Ungültige Angaben" },
        { status: 400 },
      );
    }
    console.error("[Sizes] Failed to save size", error);
    return NextResponse.json({ error: "Fehler beim Speichern der Größe" }, { status: 500 });
  }
}

// DELETE: Konfektionsgröße entfernen (?id=...)
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAuth();
    const id = request.nextUrl.searchParams.get("id");
    if (!session.user?.id || !id) {
      return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
    }
    const size = await prisma.memberSize.findUnique({ where: { id }, select: { userId: true } });
    if (!size) return NextResponse.json({ error: "Größe nicht gefunden" }, { status: 404 });
    if (!(await canEditMeasurementsOf(session.user, size.userId))) {
      return NextResponse.json(FORBIDDEN, { status: 403 });
    }
    await prisma.memberSize.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Sizes] Failed to delete size", error);
    return NextResponse.json({ error: "Fehler beim Löschen der Größe" }, { status: 500 });
  }
}

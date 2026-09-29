import { NextResponse } from "next/server";

import { normalizeDietaryLabel } from "@/data/allergens";
import { aversionInputSchema, firstIssueMessage } from "@/lib/profil/dietary-validation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

/**
 * Abneigungen und Besonderheiten („keine Pilze"). Anders als bei Allergien gibt es keinen
 * Schweregrad – es geht um Vorlieben, die die Küche kennen soll, nicht um Gefahren.
 */

/** Findet den Eintrag, der sich nur in der Schreibweise unterscheidet. */
async function findExistingAversion(userId: string, label: string) {
  const entries = await prisma.dietaryAversion.findMany({
    where: { userId },
    select: { id: true, label: true },
  });
  const key = normalizeDietaryLabel(label);
  return entries.find((entry) => normalizeDietaryLabel(entry.label) === key) ?? null;
}

export async function GET() {
  try {
    const session = await requireAuth();
    const userId = session.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const aversions = await prisma.dietaryAversion.findMany({
      where: { userId, isActive: true },
      orderBy: { label: "asc" },
    });

    return NextResponse.json(aversions);
  } catch (error) {
    console.error("[Aversions] Failed to load aversions", error);
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const userId = session.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const payload = await request.json().catch(() => null);
    const parsed = aversionInputSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssueMessage(parsed.error) }, { status: 400 });
    }

    const input = parsed.data;
    const values = { label: input.label, note: input.note, isActive: true };

    const existing = await findExistingAversion(userId, input.label);
    const aversion = existing
      ? await prisma.dietaryAversion.update({ where: { id: existing.id }, data: values })
      : await prisma.dietaryAversion.create({ data: { userId, ...values } });

    return NextResponse.json(aversion);
  } catch (error) {
    console.error("[Aversions] Failed to upsert aversion", error);
    return NextResponse.json({ error: "Fehler beim Speichern der Besonderheit" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireAuth();
    const userId = session.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const label = searchParams.get("label");

    if (!label) {
      return NextResponse.json({ error: "Bezeichnung muss angegeben werden" }, { status: 400 });
    }

    const existing = await findExistingAversion(userId, label);
    if (!existing) {
      return NextResponse.json({ error: "Besonderheit nicht gefunden" }, { status: 404 });
    }

    await prisma.dietaryAversion.update({
      where: { id: existing.id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Aversions] Failed to deactivate aversion", error);
    return NextResponse.json({ error: "Fehler beim Entfernen der Besonderheit" }, { status: 500 });
  }
}

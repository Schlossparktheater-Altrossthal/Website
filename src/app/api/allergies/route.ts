import { NextResponse } from "next/server";

import { normalizeDietaryLabel } from "@/data/allergens";
import { resolveRestrictionTaxonCode } from "@/lib/food/restriction-store";
import { allergyInputSchema, firstIssueMessage } from "@/lib/profil/dietary-validation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";

/**
 * Findet den Eintrag, der sich nur in der Schreibweise unterscheidet: „Erdnüsse", „erdnüsse" und
 * „erdnuss" sind dasselbe Allergen. Die Unique-Regel der Datenbank vergleicht exakt und würde
 * sonst mehrere Zeilen dafür zulassen.
 */
async function findExistingAllergy(userId: string, allergen: string) {
  const entries = await prisma.dietaryRestriction.findMany({
    where: { userId },
    select: { id: true, allergen: true },
  });
  const key = normalizeDietaryLabel(allergen);
  return entries.find((entry) => normalizeDietaryLabel(entry.allergen) === key) ?? null;
}

// GET: Hole alle Allergien eines Benutzers
export async function GET() {
  try {
    const session = await requireAuth();
    const userId = session.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const allergies = await prisma.dietaryRestriction.findMany({
      where: {
        userId,
        isActive: true,
      },
      orderBy: { allergen: "asc" },
    });

    return NextResponse.json(allergies);
  } catch (error) {
    console.error("[Allergies] Failed to load allergies", error);
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }
}

// POST: Füge eine neue Allergie hinzu oder aktualisiere eine bestehende
export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const userId = session.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }

    const payload = await request.json().catch(() => null);
    const parsed = allergyInputSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: firstIssueMessage(parsed.error) }, { status: 400 });
    }

    const input = parsed.data;
    // Die Anfrage beschreibt den Eintrag vollständig: nicht mitgeschickte Angaben bekommen ihre
    // Standardwerte, statt den alten Wert zu behalten. Das Profilformular sendet immer alles.
    const values = {
      allergen: input.allergen,
      kind: input.kind,
      level: input.level,
      tracesOk: input.tracesOk,
      diagnosed: input.diagnosed,
      symptoms: input.symptoms,
      treatment: input.treatment,
      note: input.note,
      isActive: true,
      taxonCode: await resolveRestrictionTaxonCode(input.allergen),
    };

    const existing = await findExistingAllergy(userId, input.allergen);
    const allergy = existing
      ? await prisma.dietaryRestriction.update({ where: { id: existing.id }, data: values })
      : await prisma.dietaryRestriction.create({ data: { userId, ...values } });

    return NextResponse.json(allergy);
  } catch (error) {
    console.error("[Allergies] Failed to upsert allergy", error);
    return NextResponse.json({ error: "Fehler beim Speichern der Allergie" }, { status: 500 });
  }
}

// DELETE: Deaktiviere eine Allergie (soft delete)
export async function DELETE(request: Request) {
  try {
    const session = await requireAuth();
    const userId = session.user?.id;
    if (!userId) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const allergen = searchParams.get("allergen");

    if (!allergen) {
      return NextResponse.json({ error: "Allergen muss angegeben werden" }, { status: 400 });
    }

    const existing = await findExistingAllergy(userId, allergen);
    if (!existing) {
      return NextResponse.json({ error: "Allergie nicht gefunden" }, { status: 404 });
    }

    await prisma.dietaryRestriction.update({
      where: { id: existing.id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Allergies] Failed to deactivate allergy", error);
    return NextResponse.json({ error: "Fehler beim Deaktivieren der Allergie" }, { status: 500 });
  }
}

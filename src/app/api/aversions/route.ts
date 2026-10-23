import { normalizeDietaryLabel } from "@/data/allergens";
import { HttpError, parseJson, withRoute } from "@/lib/api/route";
import { aversionInputSchema } from "@/lib/profil/dietary-validation";
import { prisma } from "@/lib/prisma";

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

export const GET = withRoute({ name: "aversions.get" }, ({ userId }) =>
  prisma.dietaryAversion.findMany({
    where: { userId, isActive: true },
    orderBy: { label: "asc" },
  }),
);

export const POST = withRoute(
  { name: "aversions.post", errorMessage: "Fehler beim Speichern der Besonderheit" },
  async ({ request, userId }) => {
    const input = await parseJson(request, aversionInputSchema);
    const values = { label: input.label, note: input.note, isActive: true };

    const existing = await findExistingAversion(userId, input.label);
    return existing
      ? prisma.dietaryAversion.update({ where: { id: existing.id }, data: values })
      : prisma.dietaryAversion.create({ data: { userId, ...values } });
  },
);

export const DELETE = withRoute(
  { name: "aversions.delete", errorMessage: "Fehler beim Entfernen der Besonderheit" },
  async ({ request, userId }) => {
    const label = new URL(request.url).searchParams.get("label");
    if (!label) throw new HttpError(400, "Bezeichnung muss angegeben werden");

    const existing = await findExistingAversion(userId, label);
    if (!existing) throw new HttpError(404, "Besonderheit nicht gefunden");

    await prisma.dietaryAversion.update({
      where: { id: existing.id },
      data: { isActive: false },
    });
    return { success: true };
  },
);

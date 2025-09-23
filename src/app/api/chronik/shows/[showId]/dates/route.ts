import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

const updateSchema = z.object({
  dates: z
    .union([
      z
        .string()
        .max(280, "Bitte formuliere die Termine kompakt (maximal 280 Zeichen)."),
      z.null(),
      z.undefined(),
    ])
    .transform((value) => {
      if (typeof value !== "string") {
        return null;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }),
});

type UpdatePayload = z.infer<typeof updateSchema>;

type UpdateResponseBody = {
  show?: {
    id: string;
    dates: string | null;
  };
  error?: string;
};

function serializeDates(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function PUT(request: NextRequest, context: { params: Promise<{ showId: string }> }) {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "mitglieder.website.chronik"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Datenbank ist nicht konfiguriert." }, { status: 500 });
  }

  const { showId } = await context.params;
  const id = typeof showId === "string" ? showId.trim() : "";
  if (!id) {
    return NextResponse.json({ error: "Ungültiger Chronik-Eintrag." }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Eingabe." }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(payload as UpdatePayload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const message = issue?.message ?? "Ungültige Eingabe.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const nextDates = parsed.data.dates === null ? Prisma.JsonNull : parsed.data.dates;

    const updated = await prisma.show.update({
      where: { id },
      data: { dates: nextDates },
      select: { id: true, dates: true },
    });

    const serializedDates = serializeDates(updated.dates);

    revalidatePath(`/chronik/${id}`);
    revalidatePath("/chronik");

    return NextResponse.json({ show: { id: updated.id, dates: serializedDates } } satisfies UpdateResponseBody);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ error: "Chronik-Eintrag wurde nicht gefunden." }, { status: 404 });
    }

    console.error("Failed to update chronik dates", error);
    return NextResponse.json(
      { error: "Die Aufführungstermine konnten nicht gespeichert werden." },
      { status: 500 },
    );
  }
}

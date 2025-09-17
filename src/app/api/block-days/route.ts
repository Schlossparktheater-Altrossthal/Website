import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";
import {
  isoDate,
  normaliseReason,
  toDateOnly,
  toResponse,
  reasonSchema,
} from "./utils";

type SessionUser = { id?: string } | null | undefined;

const blockDaySchema = z.object({
  date: z.string().regex(isoDate),
  reason: reasonSchema,
});

type BlockDayPayload = z.infer<typeof blockDaySchema>;

export async function GET() {
  const session = await requireAuth();
  const userId = (session.user as SessionUser)?.id;

  if (!userId) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  if (!(await hasPermission(session.user, "mitglieder.sperrliste"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const entries = await prisma.blockedDay.findMany({
    where: { userId },
    orderBy: { date: "asc" },
  });

  return NextResponse.json(entries.map(toResponse));
}

export async function POST(request: Request) {
  const session = await requireAuth();
  const userId = (session.user as SessionUser)?.id;

  if (!userId) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  if (!(await hasPermission(session.user, "mitglieder.sperrliste"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: BlockDayPayload;
  try {
    const json = await request.json();
    const parsed = blockDaySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    payload = parsed.data;
  } catch {
    return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
  }

  let blockDate: Date;
  try {
    blockDate = toDateOnly(payload.date);
  } catch {
    return NextResponse.json({ error: "Ungültiges Datum" }, { status: 400 });
  }

  try {
    const entry = await prisma.blockedDay.create({
      data: {
        userId,
        date: blockDate,
        reason: normaliseReason(payload.reason),
      },
    });

    return NextResponse.json(toResponse(entry));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Für dieses Datum existiert bereits ein Sperrtermin." },
        { status: 409 }
      );
    }

    console.error("[block-days:POST]", error);
    return NextResponse.json(
      { error: "Der Sperrtermin konnte nicht gespeichert werden." },
      { status: 500 }
    );
  }
}

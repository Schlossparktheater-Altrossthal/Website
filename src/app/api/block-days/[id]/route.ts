import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";
import { normaliseReason, reasonSchema, toResponse } from "../utils";

type SessionUser = { id?: string } | null | undefined;

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

const updateSchema = z.object({
  reason: reasonSchema,
});

type UpdatePayload = z.infer<typeof updateSchema>;

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const session = await requireAuth();
  const userId = (session.user as SessionUser)?.id;

  if (!userId) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  if (!(await hasPermission(session.user, "mitglieder.sperrliste"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: UpdatePayload;
  try {
    const json = await request.json();
    const parsed = updateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
    }
    payload = parsed.data;
  } catch {
    return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
  }

  const existing = await prisma.blockedDay.findUnique({ where: { id } });

  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: "Sperrtermin wurde nicht gefunden." }, { status: 404 });
  }

  const updated = await prisma.blockedDay.update({
    where: { id: existing.id },
    data: {
      reason: normaliseReason(payload.reason),
    },
  });

  return NextResponse.json(toResponse(updated));
}

export async function DELETE(_: Request, { params }: RouteParams) {
  const { id } = await params;
  const session = await requireAuth();
  const userId = (session.user as SessionUser)?.id;

  if (!userId) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  if (!(await hasPermission(session.user, "mitglieder.sperrliste"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await prisma.blockedDay.deleteMany({
    where: {
      id,
      userId,
    },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Sperrtermin wurde nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

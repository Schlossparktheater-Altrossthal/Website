import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { readVapidConfig } from "@/lib/notifications/push";
import { requireAuth } from "@/lib/rbac";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
  label: z.string().trim().max(60).optional(),
});

/** Öffentlicher VAPID-Schlüssel und die Geräte der angemeldeten Person. */
export async function GET() {
  const session = await requireAuth();
  const userId = session.user?.id;
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const devices = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { id: true, endpoint: true, label: true, createdAt: true, lastUsedAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ publicKey: readVapidConfig()?.publicKey ?? null, devices });
}

/** Push-Abo dieses Geräts speichern (ein Endpoint gehört immer der zuletzt angemeldeten Person). */
export async function POST(request: Request) {
  const session = await requireAuth();
  const userId = session.user?.id;
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  if (!readVapidConfig()) {
    return NextResponse.json(
      { error: "Push ist auf diesem Server nicht eingerichtet." },
      { status: 503 },
    );
  }

  const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ungültiges Abo" }, { status: 400 });

  const { endpoint, keys, label } = parsed.data;
  const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? null;
  const data = { userId, p256dh: keys.p256dh, auth: keys.auth, userAgent, label: label ?? null };
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, ...data },
    update: data,
  });
  return NextResponse.json({ ok: true });
}

const deleteSchema = z.union([
  z.object({ endpoint: z.string().min(1) }),
  z.object({ id: z.string().min(1) }),
]);

/** Abo entfernen – per Endpoint (dieses Gerät) oder ID (Geräteliste). */
export async function DELETE(request: Request) {
  const session = await requireAuth();
  const userId = session.user?.id;
  if (!userId) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });

  const { count } = await prisma.pushSubscription.deleteMany({
    where: {
      userId,
      ...("endpoint" in parsed.data ? { endpoint: parsed.data.endpoint } : { id: parsed.data.id }),
    },
  });
  return NextResponse.json({ ok: true, removed: count });
}

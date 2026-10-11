import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getTicketActor, actorMayAccessShow } from "@/lib/karten/access";
import { applyDoorMutations, loadDoorSnapshot } from "@/lib/karten/checkin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "private, no-store" };

async function authorize(eventId: string) {
  const actor = await getTicketActor();
  if (!actor?.canCheckIn) return null;
  const event = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
    select: { showId: true, kind: true },
  });
  if (!event?.showId || event.kind !== "PERFORMANCE") return null;
  return actorMayAccessShow(actor, event.showId) ? actor : null;
}

/** Einlassliste einer Vorstellung (wird auf dem Gerät für den Offline-Betrieb vorgehalten). */
export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get("eventId") ?? "";
  if (!eventId || !(await authorize(eventId))) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403, headers: NO_STORE });
  }
  return NextResponse.json(await loadDoorSnapshot(eventId), { headers: NO_STORE });
}

const mutationSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().min(8).max(80),
    type: z.literal("checkin"),
    reservationId: z.string().min(1),
    delta: z.number().int().min(-100).max(100),
    occurredAt: z.string().max(40),
  }),
  z.object({
    id: z.string().min(8).max(80),
    type: z.literal("sale"),
    items: z
      .array(
        z.object({ categoryId: z.string().min(1), quantity: z.number().int().min(0).max(100) }),
      )
      .min(1)
      .max(30),
    occurredAt: z.string().max(40),
  }),
]);

const bodySchema = z.object({
  eventId: z.string().min(1),
  device: z.string().max(80).optional(),
  mutations: z.array(mutationSchema).max(500),
});

/** Gepufferte Check-ins und Abendkassen-Verkäufe übernehmen; antwortet mit frischer Liste. */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400, headers: NO_STORE });
  }
  const { eventId, device, mutations } = parsed.data;
  const actor = await authorize(eventId);
  if (!actor) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403, headers: NO_STORE });
  }
  const results = await applyDoorMutations(eventId, mutations, actor, device ?? null);
  return NextResponse.json(
    { results, snapshot: await loadDoorSnapshot(eventId) },
    { headers: NO_STORE },
  );
}

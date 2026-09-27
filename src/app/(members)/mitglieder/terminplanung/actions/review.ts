"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { ensurePlanner } from "@/lib/probenplanung/actions-helpers";

const reviewSchema = z.object({
  eventId: z.string().min(1),
  scenes: z
    .array(
      z.object({
        sceneId: z.string().min(1),
        outcome: z.enum(["DONE", "PARTIAL", "SKIPPED"]).nullable(),
      }),
    )
    .max(200),
  attendance: z
    .array(z.object({ userId: z.string().min(1), attended: z.boolean().nullable() }))
    .max(1000),
});

/** Nachbereitung: welche Szenen geschafft wurden und wer da war. */
export async function saveRehearsalReviewAction(input: z.input<typeof reviewSchema>) {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Bitte Eingaben prüfen." };
  }
  const { eventId, scenes, attendance } = parsed.data;
  const auth = await ensurePlanner({ rehearsalId: eventId });
  if (!auth.ok) return { ok: false as const, error: auth.error };

  try {
    const event = await prisma.calendarEvent.findUnique({
      where: { id: eventId },
      select: { start: true, status: true },
    });
    if (!event || event.status !== "SCHEDULED" || event.start > new Date()) {
      return { ok: false as const, error: "Nachbereiten geht erst, wenn die Probe begonnen hat." };
    }
    await prisma.$transaction(async (tx) => {
      for (const scene of scenes) {
        await tx.eventBlock.updateMany({
          where: { eventId, sceneId: scene.sceneId },
          data: { outcome: scene.outcome },
        });
      }
      for (const entry of attendance) {
        await tx.eventParticipant.updateMany({
          where: { eventId, userId: entry.userId },
          data: { attended: entry.attended },
        });
      }
    });
    revalidatePath(`/mitglieder/terminplanung/${eventId}`);
    revalidatePath("/mitglieder/terminplanung");
    return { ok: true as const };
  } catch (error) {
    console.error("Error saving rehearsal review", error);
    return { ok: false as const, error: "Die Nachbereitung konnte nicht gespeichert werden." };
  }
}

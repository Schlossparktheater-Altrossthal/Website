"use server";

import { z } from "zod";

import { resolveAudience } from "@/lib/calendar/audience";
import { audienceInputSchema, loadAudienceContext } from "@/lib/calendar/audience-server";
import { candidateDays, rankDays, type RankedDay } from "@/lib/calendar/date-finder";
import { loadFinderDays } from "@/lib/calendar/date-finder-server";
import { ensurePlanner } from "@/lib/probenplanung/actions-helpers";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const time = /^([01]\d|2[0-3]):[0-5]\d$/;

const finderSchema = z
  .object({
    audience: audienceInputSchema,
    from: z.string().regex(isoDate),
    to: z.string().regex(isoDate),
    weekdays: z.array(z.number().int().min(0).max(6)).max(7),
    startTime: z.string().regex(time),
    endTime: z.string().regex(time),
  })
  .refine((value) => value.from <= value.to, { message: "Zeitraum endet vor dem Beginn." });

export type FinderResult =
  | {
      ok: true;
      days: RankedDay[];
      participantCount: number;
      /** Namen für die Anzeige, wer fehlt. */
      names: Record<string, string>;
      truncated: boolean;
    }
  | { ok: false; error: string };

const MAX_DAYS = 120;

/** Tage im Zeitraum nach Eignung für die Zielgruppe (Sperrliste + vorhandene Termine). */
export async function findRehearsalDatesAction(
  input: z.input<typeof finderSchema>,
): Promise<FinderResult> {
  const parsed = finderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Bitte Eingaben prüfen." };
  }
  const auth = await ensurePlanner();
  if (!auth.ok) return { ok: false, error: auth.error };

  const { audience, from, to, weekdays, startTime, endTime } = parsed.data;
  try {
    const context = await loadAudienceContext(auth.showId);
    const participants = resolveAudience(audience.rules, audience.overrides, context)
      .filter((participant) => !participant.excluded)
      .map((participant) => ({ userId: participant.userId, level: participant.level }));
    if (!participants.length) return { ok: false, error: "Die Zielgruppe ist leer." };

    const dateKeys = candidateDays({ from, to, weekdays, limit: MAX_DAYS + 1 });
    const truncated = dateKeys.length > MAX_DAYS;
    const days = await loadFinderDays({
      userIds: participants.map((participant) => participant.userId),
      dateKeys: dateKeys.slice(0, MAX_DAYS),
      startTime,
      endTime,
    });
    const names = Object.fromEntries(context.members.map((member) => [member.id, member.name]));
    return {
      ok: true,
      days: rankDays(participants, days),
      participantCount: participants.length,
      names,
      truncated,
    };
  } catch (error) {
    console.error("Error finding rehearsal dates", error);
    return { ok: false, error: "Die Termine konnten nicht berechnet werden." };
  }
}

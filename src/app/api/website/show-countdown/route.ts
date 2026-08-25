import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  DEFAULT_PREMIERE_COUNTDOWN_ISO,
  type PremiereCountdownSettingsTermin as LegacyShowDate,
  readPremiereCountdownSettings,
  resolvePremiereCountdownSettings,
  savePremiereCountdownSettings,
} from "@/lib/premiere-countdown-settings";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

const showDateSchema = z.object({
  date: z.string(),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  label: z.string().optional(),
});
const MIN_DATES = 1;
const MAX_DATES = 8;
const updateSchema = z.object({
  countdownTarget: z
    .union([z.string().datetime({ offset: true }), z.null()])
    .transform((value) => (value ? new Date(value) : null)),
  disabled: z.boolean().optional().default(false),
  scheduledDates: z.array(showDateSchema).min(MIN_DATES).max(MAX_DATES),
  postShowText: z.string().optional().default("Bis zum nächsten Sommer!"),
});

function toIso(scheduledDate: { date: string; time: string }) {
  return new Date(`${scheduledDate.date}T${scheduledDate.time}:00`).toISOString();
}

function isChronological(scheduledDates: { date: string; time: string }[]) {
  for (let index = 1; index < scheduledDates.length; index += 1) {
    if (
      new Date(toIso(scheduledDates[index - 1])).getTime() >
      new Date(toIso(scheduledDates[index])).getTime()
    )
      return false;
  }
  return true;
}

function serializeSettings(record: Awaited<ReturnType<typeof readPremiereCountdownSettings>>) {
  const resolved = resolvePremiereCountdownSettings(record);
  return {
    countdownTarget: record?.countdownTarget ? record.countdownTarget.toISOString() : null,
    effectiveCountdownTarget: resolved.effectiveCountdownTarget.toISOString(),
    updatedAt: resolved.updatedAt ? resolved.updatedAt.toISOString() : null,
    hasCustomCountdown: resolved.hasCustomCountdown,
    disabled: resolved.disabled,
    scheduledDates: resolved.termine.map((scheduledDate) => ({
      date: scheduledDate.datum,
      time: scheduledDate.uhrzeit,
      label: scheduledDate.label,
    })),
    postShowText: resolved.nachSommerText,
    defaultCountdownTarget: DEFAULT_PREMIERE_COUNTDOWN_ISO,
  } as const;
}
export async function GET() {
  /* unchanged auth */
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "PUBLIC.HOME.COUNTDOWN.EDIT")))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const record = await readPremiereCountdownSettings();
    return NextResponse.json({ settings: serializeSettings(record) });
  } catch {
    return NextResponse.json(
      { error: "Einstellungen konnten nicht geladen werden." },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "PUBLIC.HOME.COUNTDOWN.EDIT")))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." },
      { status: 400 },
    );
  if (!isChronological(parsed.data.scheduledDates))
    return NextResponse.json(
      { error: "Termine müssen chronologisch sortiert sein." },
      { status: 400 },
    );

  try {
    const saved = await savePremiereCountdownSettings({
      countdownTarget: parsed.data.countdownTarget,
      disabled: parsed.data.disabled,
      termine: parsed.data.scheduledDates.map((scheduledDate): LegacyShowDate => ({
        datum: scheduledDate.date,
        uhrzeit: scheduledDate.time,
        label: scheduledDate.label,
      })),
      nachSommerText: parsed.data.postShowText,
    });
    return NextResponse.json({ settings: serializeSettings(saved) });
  } catch {
    return NextResponse.json(
      { error: "Der Countdown konnte nicht gespeichert werden." },
      { status: 500 },
    );
  }
}

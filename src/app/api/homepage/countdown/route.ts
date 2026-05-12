import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  DEFAULT_HOMEPAGE_COUNTDOWN_ISO,
  type HomepageCountdownTermin,
  readHomepageCountdown,
  resolveHomepageCountdown,
  saveHomepageCountdown,
} from "@/lib/homepage-countdown";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

const terminSchema = z.object({ datum: z.string(), uhrzeit: z.string().regex(/^\d{2}:\d{2}$/), label: z.string().optional() });
const updateSchema = z.object({
  countdownTarget: z.union([z.string().datetime({ offset: true }), z.null()]).transform((value) => (value ? new Date(value) : null)),
  disabled: z.boolean().optional().default(false),
  termine: z.array(terminSchema).optional().default([]),
  nachSommerText: z.string().optional().default("Bis zum nächsten Sommer!"),
});

function toIso(termin: HomepageCountdownTermin) {
  return new Date(`${termin.datum}T${termin.uhrzeit}:00`).toISOString();
}

function isChronological(termine: HomepageCountdownTermin[]) {
  for (let index = 1; index < termine.length; index += 1) {
    if (new Date(toIso(termine[index - 1])).getTime() > new Date(toIso(termine[index])).getTime()) return false;
  }
  return true;
}

function serializeSettings(record: Awaited<ReturnType<typeof readHomepageCountdown>>) {
  const resolved = resolveHomepageCountdown(record);
  return {
    countdownTarget: record?.countdownTarget ? record.countdownTarget.toISOString() : null,
    effectiveCountdownTarget: resolved.effectiveCountdownTarget.toISOString(),
    updatedAt: resolved.updatedAt ? resolved.updatedAt.toISOString() : null,
    hasCustomCountdown: resolved.hasCustomCountdown,
    disabled: resolved.disabled,
    termine: resolved.termine,
    nachSommerText: resolved.nachSommerText,
    defaultCountdownTarget: DEFAULT_HOMEPAGE_COUNTDOWN_ISO,
  } as const;
}
export async function GET() { /* unchanged auth */
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "mitglieder.website.countdown"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try { const record = await readHomepageCountdown(); return NextResponse.json({ settings: serializeSettings(record) }); }
  catch { return NextResponse.json({ error: "Einstellungen konnten nicht geladen werden." }, { status: 500 }); }
}

export async function PUT(request: NextRequest) {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "mitglieder.website.countdown"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." }, { status: 400 });
  if (!isChronological(parsed.data.termine)) return NextResponse.json({ error: "Termine müssen chronologisch sortiert sein." }, { status: 400 });

  try {
    const saved = await saveHomepageCountdown({
      countdownTarget: parsed.data.countdownTarget,
      disabled: parsed.data.disabled,
      termine: parsed.data.termine,
      nachSommerText: parsed.data.nachSommerText,
    });
    return NextResponse.json({ settings: serializeSettings(saved) });
  } catch {
    return NextResponse.json({ error: "Der Countdown konnte nicht gespeichert werden." }, { status: 500 });
  }
}

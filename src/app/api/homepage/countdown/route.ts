import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  DEFAULT_HOMEPAGE_COUNTDOWN_ISO,
  readHomepageCountdown,
  resolveHomepageCountdown,
  saveHomepageCountdown,
} from "@/lib/homepage-countdown";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

const updateSchema = z.object({
  countdownTarget: z
    .union([z.string().datetime({ offset: true }), z.null()])
    .transform((value) => (value ? new Date(value) : null)),
});

function serializeSettings(record: Awaited<ReturnType<typeof readHomepageCountdown>>) {
  const resolved = resolveHomepageCountdown(record);
  return {
    countdownTarget: record?.countdownTarget ? record.countdownTarget.toISOString() : null,
    effectiveCountdownTarget: resolved.effectiveCountdownTarget.toISOString(),
    updatedAt: resolved.updatedAt ? resolved.updatedAt.toISOString() : null,
    hasCustomCountdown: resolved.hasCustomCountdown,
    defaultCountdownTarget: DEFAULT_HOMEPAGE_COUNTDOWN_ISO,
  } as const;
}

export async function GET() {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "mitglieder.website.countdown"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Datenbank ist nicht konfiguriert." }, { status: 500 });
  }

  try {
    const record = await readHomepageCountdown();
    return NextResponse.json({ settings: serializeSettings(record) });
  } catch (error) {
    console.error("Failed to load homepage countdown", error);
    return NextResponse.json({ error: "Einstellungen konnten nicht geladen werden." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "mitglieder.website.countdown"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Datenbank ist nicht konfiguriert." }, { status: 500 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Eingabe." }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const message = issue?.message ?? "Ungültige Eingabe.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const saved = await saveHomepageCountdown({ countdownTarget: parsed.data.countdownTarget });
    return NextResponse.json({ settings: serializeSettings(saved) });
  } catch (error) {
    console.error("Failed to save homepage countdown", error);
    return NextResponse.json({ error: "Der Countdown konnte nicht gespeichert werden." }, { status: 500 });
  }
}

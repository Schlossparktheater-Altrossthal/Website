import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  DEFAULT_MYSTERY_EXPIRATION_MESSAGE,
  readMysterySettings,
  resolveMysterySettings,
  saveMysterySettings,
} from "@/lib/mystery-settings";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

const updateSchema = z.object({
  countdownTarget: z
    .union([z.string().datetime({ offset: true }), z.null()])
    .transform((value) => (value ? new Date(value) : null)),
  expirationMessage: z
    .union([z.string().trim().max(500), z.null()])
    .transform((value) => (typeof value === "string" && value.length > 0 ? value : null)),
});

function serializeSettings(record: Awaited<ReturnType<typeof readMysterySettings>>) {
  const resolved = resolveMysterySettings(record);
  return {
    countdownTarget: record?.countdownTarget ? record.countdownTarget.toISOString() : null,
    expirationMessage: record?.expirationMessage ?? null,
    effectiveCountdownTarget: resolved.effectiveCountdownTarget.toISOString(),
    effectiveExpirationMessage: resolved.effectiveExpirationMessage ?? DEFAULT_MYSTERY_EXPIRATION_MESSAGE,
    updatedAt: resolved.updatedAt ? resolved.updatedAt.toISOString() : null,
    hasCustomCountdown: resolved.hasCustomCountdown,
    hasCustomMessage: resolved.hasCustomMessage,
  } as const;
}

export async function GET() {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "mitglieder.mystery.timer"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Datenbank ist nicht konfiguriert." }, { status: 500 });
  }

  try {
    const record = await readMysterySettings("members");
    return NextResponse.json({ settings: serializeSettings(record) });
  } catch (error) {
    console.error("Failed to load mystery settings", error);
    return NextResponse.json({ error: "Einstellungen konnten nicht geladen werden." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "mitglieder.mystery.timer"))) {
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
    const saved = await saveMysterySettings("members", {
      countdownTarget: parsed.data.countdownTarget,
      expirationMessage: parsed.data.expirationMessage,
    });
    return NextResponse.json({ settings: serializeSettings(saved) });
  } catch (error) {
    console.error("Failed to save mystery settings", error);
    return NextResponse.json({ error: "Die Einstellungen konnten nicht gespeichert werden." }, { status: 500 });
  }
}

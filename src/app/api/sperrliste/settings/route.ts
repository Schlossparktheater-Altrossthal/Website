import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  applyHolidaySourceStatus,
  getDefaultHolidaySourceUrl,
  readSperrlisteSettings,
  resolveSperrlisteSettings,
  saveSperrlisteSettings,
  toClientSperrlisteSettings,
} from "@/lib/sperrliste-settings";
import { fetchHolidayRangesForSettings } from "@/lib/holidays";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { sortWeekdays } from "@/lib/weekdays";

const updateSchema = z.object({
  freezeDays: z.coerce.number().int().min(0).max(365),
  preferredWeekdays: z
    .array(z.coerce.number().int().min(0).max(6))
    .optional()
    .transform((value) => value ?? []),
  exceptionWeekdays: z
    .array(z.coerce.number().int().min(0).max(6))
    .optional()
    .transform((value) => value ?? []),
  holidaySourceMode: z.enum(["default", "custom", "disabled"]),
  holidaySourceUrl: z
    .union([z.string().trim().url().max(500), z.literal(""), z.null()])
    .transform((value) => {
      if (value === null || value === "") {
        return null;
      }
      return value;
    }),
});

function sanitiseExceptionWeekdays(preferred: number[], exception: number[]) {
  const preferredSet = new Set(preferred);
  return exception.filter((weekday) => !preferredSet.has(weekday));
}

async function ensurePermission() {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "mitglieder.sperrliste.settings"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const permissionResponse = await ensurePermission();
  if (permissionResponse) {
    return permissionResponse;
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Datenbank ist nicht konfiguriert." }, { status: 500 });
  }

  try {
    const record = await readSperrlisteSettings();
    const resolved = resolveSperrlisteSettings(record);
    return NextResponse.json({
      settings: toClientSperrlisteSettings(resolved),
      defaults: {
        holidaySourceUrl: getDefaultHolidaySourceUrl(),
      },
    });
  } catch (error) {
    console.error("Failed to load sperrliste settings", error);
    return NextResponse.json({ error: "Einstellungen konnten nicht geladen werden." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const permissionResponse = await ensurePermission();
  if (permissionResponse) {
    return permissionResponse;
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
    return NextResponse.json({ error: issue?.message ?? "Ungültige Eingabe." }, { status: 400 });
  }

  const preferredWeekdays = sortWeekdays(parsed.data.preferredWeekdays);
  const exceptionWeekdays = sanitiseExceptionWeekdays(
    preferredWeekdays,
    sortWeekdays(parsed.data.exceptionWeekdays),
  );

  const mode = parsed.data.holidaySourceMode;
  const url = mode === "custom" ? parsed.data.holidaySourceUrl : null;

  if (mode === "custom" && !url) {
    return NextResponse.json(
      { error: "Bitte gib eine gültige URL für die Ferienquelle an." },
      { status: 400 },
    );
  }

  try {
    const existingRecord = await readSperrlisteSettings();
    const resolvedBefore = resolveSperrlisteSettings(existingRecord);

    const modeChanged = resolvedBefore.holidaySource.mode !== mode;
    const urlChanged = (resolvedBefore.holidaySource.url ?? null) !== (url ?? null);

    const savedRecord = await saveSperrlisteSettings(
      {
        freezeDays: parsed.data.freezeDays,
        preferredWeekdays,
        exceptionWeekdays,
        holidaySourceMode: mode,
        holidaySourceUrl: url,
      },
      { resetStatus: modeChanged || urlChanged },
    );

    const resolvedAfterSave = resolveSperrlisteSettings(savedRecord);
    const result = await fetchHolidayRangesForSettings(resolvedAfterSave);
    await applyHolidaySourceStatus(result.status);

    const refreshedRecord = await readSperrlisteSettings();
    const resolved = resolveSperrlisteSettings(refreshedRecord);

    return NextResponse.json({
      settings: toClientSperrlisteSettings(resolved),
      holidays: result.ranges,
      defaults: {
        holidaySourceUrl: getDefaultHolidaySourceUrl(),
      },
    });
  } catch (error) {
    console.error("Failed to save sperrliste settings", error);
    return NextResponse.json({ error: "Die Einstellungen konnten nicht gespeichert werden." }, { status: 500 });
  }
}

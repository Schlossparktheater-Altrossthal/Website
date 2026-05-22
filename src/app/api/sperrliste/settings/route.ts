import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  applyHolidaySourceStatuses,
  getDefaultHolidaySourceUrl,
  getDefaultPublicHolidaySourceUrl,
  readSperrlisteSettings,
  resolveBlocklistSettings,
  saveBlocklistSettings,
  toClientBlocklistSettings,
} from "@/lib/sperrliste-settings";
import { fetchHolidayRangesForSettings } from "@/lib/holidays";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { sortWeekdays } from "@/lib/weekdays";
import { databaseEnabled } from "@/lib/dev-database";
import {
  DEV_SPERRLISTE_CLIENT_SETTINGS_FIXTURE,
  DEV_SPERRLISTE_DEFAULTS_FIXTURE,
  DEV_SPERRLISTE_HOLIDAYS_FIXTURE,
  DEV_SPERRLISTE_OFFLINE_MESSAGE,
} from "@/lib/dev-sperrliste-fixture";

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
  publicHolidaySourceMode: z.enum(["default", "custom", "disabled"]),
  publicHolidaySourceUrl: z
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

type PermissionResult =
  | { status: "ok"; response: null }
  | { status: "offline"; response: null }
  | { status: "denied"; response: NextResponse };

async function ensurePermission(): Promise<PermissionResult> {
  const session = await requireAuth();
  if (!databaseEnabled()) {
    return { status: "offline", response: null };
  }
  if (!(await hasPermission(session.user, "mitglieder.sperrliste.settings"))) {
    return { status: "denied", response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { status: "ok", response: null };
}

export async function GET() {
  const permission = await ensurePermission();
  if (permission.status === "denied" && permission.response) {
    return permission.response;
  }

  if (permission.status === "offline") {
    return NextResponse.json({
      offline: true,
      settings: DEV_SPERRLISTE_CLIENT_SETTINGS_FIXTURE,
      defaults: DEV_SPERRLISTE_DEFAULTS_FIXTURE,
      holidays: DEV_SPERRLISTE_HOLIDAYS_FIXTURE,
      message: DEV_SPERRLISTE_OFFLINE_MESSAGE,
    });
  }

  try {
    const { record, offline } = await readSperrlisteSettings({ withMeta: true });
    const resolved = resolveBlocklistSettings(record);
    return NextResponse.json({
      offline,
      settings: toClientBlocklistSettings(resolved),
      defaults: {
        holidaySourceUrl: getDefaultHolidaySourceUrl(),
        publicHolidaySourceUrl: getDefaultPublicHolidaySourceUrl(),
      },
    });
  } catch (error) {
    console.error("Failed to load sperrliste settings", error);
    return NextResponse.json({ error: "Einstellungen konnten nicht geladen werden." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const permission = await ensurePermission();
  if (permission.status === "denied" && permission.response) {
    return permission.response;
  }

  if (permission.status === "offline") {
    return NextResponse.json(
      {
        error:
          "Der Sperrlistenbereich läuft im Offline-Demo-Modus. Einstellungen können momentan nicht gespeichert werden.",
      },
      { status: 503 },
    );
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
  const publicMode = parsed.data.publicHolidaySourceMode;
  const publicUrl = publicMode === "custom" ? parsed.data.publicHolidaySourceUrl : null;

  if (mode === "custom" && !url) {
    return NextResponse.json(
      { error: "Bitte gib eine gültige URL für die Ferienquelle an." },
      { status: 400 },
    );
  }

  if (publicMode === "custom" && !publicUrl) {
    return NextResponse.json(
      { error: "Bitte gib eine gültige URL für die Feiertagsquelle an." },
      { status: 400 },
    );
  }

  try {
    const existingRecord = await readSperrlisteSettings();
    const resolvedBefore = resolveBlocklistSettings(existingRecord);

    const modeChanged = resolvedBefore.holidaySource.mode !== mode;
    const urlChanged = (resolvedBefore.holidaySource.url ?? null) !== (url ?? null);
    const publicModeChanged = resolvedBefore.publicHolidaySource.mode !== publicMode;
    const publicUrlChanged =
      (resolvedBefore.publicHolidaySource.url ?? null) !== (publicUrl ?? null);

    const savedRecord = await saveBlocklistSettings(
      {
        freezeDays: parsed.data.freezeDays,
        preferredWeekdays,
        exceptionWeekdays,
        holidaySourceMode: mode,
        holidaySourceUrl: url,
        publicHolidaySourceMode: publicMode,
        publicHolidaySourceUrl: publicUrl,
      },
      {
        resetHolidayStatus: modeChanged || urlChanged,
        resetPublicHolidayStatus: publicModeChanged || publicUrlChanged,
      },
    );

    const resolvedAfterSave = resolveBlocklistSettings(savedRecord);
    const result = await fetchHolidayRangesForSettings(resolvedAfterSave);
    await applyHolidaySourceStatuses({
      holiday: result.holidayStatus,
      publicHoliday: result.publicHolidayStatus,
    });

    const refreshedRecord = await readSperrlisteSettings();
    const resolved = resolveBlocklistSettings(refreshedRecord);

    return NextResponse.json({
      offline: false,
      settings: toClientBlocklistSettings(resolved),
      holidays: result.ranges,
      defaults: {
        holidaySourceUrl: getDefaultHolidaySourceUrl(),
        publicHolidaySourceUrl: getDefaultPublicHolidaySourceUrl(),
      },
    });
  } catch (error) {
    console.error("Failed to save sperrliste settings", error);
    return NextResponse.json({ error: "Die Einstellungen konnten nicht gespeichert werden." }, { status: 500 });
  }
}

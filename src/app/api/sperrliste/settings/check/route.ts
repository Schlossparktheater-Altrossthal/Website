import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  getDefaultHolidaySourceUrl,
  readSperrlisteSettings,
  resolveSperrlisteSettings,
  HOLIDAY_SOURCE_MODES,
  type HolidaySourceMode,
  type ResolvedSperrlisteSettings,
} from "@/lib/sperrliste-settings";
import { fetchHolidayRangesForSettings } from "@/lib/holidays";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";

const checkSchema = z.object({
  mode: z.enum(HOLIDAY_SOURCE_MODES),
  url: z
    .union([z.string().trim().url().max(500), z.literal(""), z.null()])
    .transform((value) => {
      if (value === null || value === "") {
        return null;
      }
      return value;
    }),
});

async function ensurePermission() {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "mitglieder.sperrliste.settings"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

function buildCandidateSettings(
  base: ResolvedSperrlisteSettings,
  mode: HolidaySourceMode,
  url: string | null,
): ResolvedSperrlisteSettings {
  const effectiveUrl =
    mode === "disabled" ? null : mode === "custom" ? url : getDefaultHolidaySourceUrl();

  return {
    ...base,
    holidaySource: {
      mode,
      url,
      effectiveUrl,
    },
    holidayStatus: {
      status: mode === "disabled" ? "disabled" : "unknown",
      message: null,
      checkedAt: null,
    },
    cacheKey: `${mode}|${effectiveUrl ?? "none"}`,
  };
}

export async function POST(request: NextRequest) {
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

  const parsed = checkSchema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json({ error: issue?.message ?? "Ungültige Eingabe." }, { status: 400 });
  }

  const mode = parsed.data.mode;
  const url = mode === "custom" ? parsed.data.url : null;

  if (mode === "custom" && !url) {
    return NextResponse.json(
      { error: "Bitte gib eine gültige URL für die Ferienquelle an." },
      { status: 400 },
    );
  }

  try {
    const record = await readSperrlisteSettings();
    const resolved = resolveSperrlisteSettings(record);
    const candidate = buildCandidateSettings(resolved, mode, url);
    const result = await fetchHolidayRangesForSettings(candidate);

    return NextResponse.json({
      holidayStatus: {
        status: result.status.status,
        message: result.status.message,
        checkedAt: result.status.checkedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("Failed to check holiday source", error);
    return NextResponse.json(
      { error: "Ferienquelle konnte nicht geprüft werden." },
      { status: 500 },
    );
  }
}

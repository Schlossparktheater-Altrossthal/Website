import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  getDefaultHolidaySourceUrl,
  getDefaultPublicHolidaySourceUrl,
  readSperrlisteSettings,
  resolveBlocklistSettings,
  HOLIDAY_SOURCE_MODES,
  type HolidaySourceMode,
  type ResolvedSperrlisteSettings,
} from "@/lib/sperrliste-settings";
import { fetchHolidayRangesForSettings, isHolidaySourceUrlAllowed } from "@/lib/holidays";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { databaseEnabled } from "@/lib/dev-database";

const checkSchema = z.object({
  source: z.enum(["holiday", "publicHoliday"]),
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
  if (!databaseEnabled()) {
    return NextResponse.json(
      { error: "Ferienquellen können im Offline-Demo-Modus nicht geprüft werden." },
      { status: 503 },
    );
  }
  if (!(await hasPermission(session.user, "mitglieder.sperrliste.settings"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

function resolveCandidateSource(
  mode: HolidaySourceMode,
  url: string | null,
  defaultUrl: string,
) {
  return {
    mode,
    url,
    effectiveUrl:
      mode === "disabled" ? null : mode === "custom" ? url : defaultUrl,
  } as const;
}

function buildCandidateSettings(
  base: ResolvedSperrlisteSettings,
  source: "holiday" | "publicHoliday",
  mode: HolidaySourceMode,
  url: string | null,
): ResolvedSperrlisteSettings {
  const nextHolidaySource =
    source === "holiday"
      ? resolveCandidateSource(mode, url, getDefaultHolidaySourceUrl())
      : base.holidaySource;

  const nextPublicHolidaySource =
    source === "publicHoliday"
      ? resolveCandidateSource(mode, url, getDefaultPublicHolidaySourceUrl())
      : base.publicHolidaySource;

  const nextHolidayStatus =
    source === "holiday"
      ? ({
          status: nextHolidaySource.mode === "disabled" ? "disabled" : "unknown",
          message: null,
          checkedAt: null,
        } as const)
      : base.holidayStatus;

  const nextPublicStatus =
    source === "publicHoliday"
      ? ({
          status:
            nextPublicHolidaySource.mode === "disabled" ? "disabled" : "unknown",
          message: null,
          checkedAt: null,
        } as const)
      : base.publicHolidayStatus;

  const cacheKey = [
    `${nextHolidaySource.mode}|${nextHolidaySource.effectiveUrl ?? "none"}`,
    `${nextPublicHolidaySource.mode}|${nextPublicHolidaySource.effectiveUrl ?? "none"}`,
  ].join("|");

  return {
    ...base,
    holidaySource: nextHolidaySource,
    publicHolidaySource: nextPublicHolidaySource,
    holidayStatus: nextHolidayStatus,
    publicHolidayStatus: nextPublicStatus,
    cacheKey,
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

  const source = parsed.data.source;
  const mode = parsed.data.mode;
  const url = mode === "custom" ? parsed.data.url : null;

  if (mode === "custom" && !url) {
    return NextResponse.json(
      { error: "Bitte gib eine gültige URL für die Quelle an." },
      { status: 400 },
    );
  }

  if (mode === "custom" && url && !isHolidaySourceUrlAllowed(url)) {
    console.warn("[sperrliste] blocked custom holiday source", { url });
    return NextResponse.json(
      { error: "Diese Quelle ist nicht erlaubt." },
      { status: 400 },
    );
  }

  try {
    const record = await readSperrlisteSettings();
    const resolved = resolveBlocklistSettings(record);
    const candidate = buildCandidateSettings(resolved, source, mode, url);
    const result = await fetchHolidayRangesForSettings(candidate);

    return NextResponse.json({
      holidayStatus: {
        status: result.holidayStatus.status,
        message: result.holidayStatus.message,
        checkedAt: result.holidayStatus.checkedAt?.toISOString() ?? null,
      },
      publicHolidayStatus: {
        status: result.publicHolidayStatus.status,
        message: result.publicHolidayStatus.message,
        checkedAt: result.publicHolidayStatus.checkedAt?.toISOString() ?? null,
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

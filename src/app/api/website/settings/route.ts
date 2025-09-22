import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import {
  DEFAULT_THEME_ID,
  THEME_TOKEN_KEYS,
  ensureWebsiteSettingsRecord,
  readWebsiteSettings,
  resolveWebsiteSettings,
  saveWebsiteSettings,
  saveWebsiteTheme,
  toClientWebsiteSettings,
} from "@/lib/website-settings";

const colorModeSchema = z.enum(["light", "dark"]);

function createModeSchema() {
  return z.object(
    Object.fromEntries(
      THEME_TOKEN_KEYS.map((token) => [token, z.string().trim().min(1).max(200)]),
    ) as Record<string, z.ZodString>,
  );
}

const themeTokensSchema = z.object({
  radius: z.object({ base: z.string().trim().min(1).max(120) }),
  modes: z.object({
    light: createModeSchema(),
    dark: createModeSchema(),
  }),
});

const updateSchema = z.object({
  settings: z
    .object({
      siteTitle: z.string().trim().min(1).max(160).optional(),
      colorMode: colorModeSchema.optional(),
    })
    .optional(),
  theme: z
    .object({
      id: z.string().trim().min(1),
      name: z.string().trim().min(2).max(120).optional(),
      description: z.string().trim().max(500).optional().nullable(),
      tokens: themeTokensSchema,
    })
    .optional(),
});

async function ensurePermission() {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "mitglieder.website.settings"))) {
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
    const record = await ensureWebsiteSettingsRecord();
    const resolved = resolveWebsiteSettings(record);
    return NextResponse.json({ settings: toClientWebsiteSettings(resolved) });
  } catch (error) {
    console.error("Failed to load website settings", error);
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

  const themePayload = parsed.data.theme;
  const settingsPayload = parsed.data.settings;

  if (!themePayload && !settingsPayload) {
    return NextResponse.json({ error: "Keine Änderungen übermittelt." }, { status: 400 });
  }

  try {
    const record = await ensureWebsiteSettingsRecord();
    const targetThemeId = themePayload?.id ?? record.theme?.id ?? DEFAULT_THEME_ID;

    if (themePayload) {
      await saveWebsiteTheme(targetThemeId, {
        name: themePayload.name ?? undefined,
        description: themePayload.description ?? undefined,
        tokens: themePayload.tokens,
      });
    }

    if (settingsPayload || themePayload) {
      await saveWebsiteSettings({
        siteTitle: settingsPayload?.siteTitle ?? undefined,
        colorMode: settingsPayload?.colorMode ?? undefined,
        themeId: targetThemeId,
      });
    }

    const refreshed = await readWebsiteSettings();
    const resolved = resolveWebsiteSettings(refreshed);

    return NextResponse.json({ settings: toClientWebsiteSettings(resolved) });
  } catch (error) {
    console.error("Failed to save website settings", error);
    return NextResponse.json({ error: "Die Einstellungen konnten nicht gespeichert werden." }, { status: 500 });
  }
}

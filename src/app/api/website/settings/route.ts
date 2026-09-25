import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  themeDescriptionSchema,
  themeIdSchema,
  themeNameSchema,
  themeTokensSchema,
} from "../theme-schemas";

import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import {
  LockedWebsiteThemeError,
  ensureWebsiteSettingsRecord,
  readWebsiteSettings,
  resolveWebsiteSettings,
  resolveWebsiteTheme,
  saveWebsiteSettings,
  saveWebsiteTheme,
  toClientWebsiteSettings,
  toClientWebsiteTheme,
} from "@/lib/website-settings";

const colorModeSchema = z.enum(["light", "dark", "system"]);

/** Nur die Sichtbarkeit der Mitglieder-Seiten; öffentliche Seiten steuert Drupal. */
const pageVisibilitySchema = z.object({
  members: z.record(z.string(), z.boolean()).optional(),
});

const updateSchema = z.object({
  settings: z
    .object({
      siteTitle: z.string().trim().min(1).max(160).optional(),
      colorMode: colorModeSchema.optional(),
      pageVisibility: pageVisibilitySchema.optional(),
      themeId: themeIdSchema.optional(),
    })
    .optional(),
  theme: z
    .object({
      id: themeIdSchema,
      name: themeNameSchema.optional(),
      description: themeDescriptionSchema,
      tokens: themeTokensSchema,
    })
    .optional(),
  activateTheme: z.boolean().optional(),
});

/**
 * Lesen darf jeder, der eines der beiden Website-Rechte hat. Für Schreibzugriffe
 * gilt zusätzlich eine Feldprüfung in PUT: Seiten-Sichtbarkeit gehört zu
 * PRIVATE.ADMIN.PAGES.MANAGE, Theme/Branding zu PRIVATE.SETTINGS.THEME.MANAGE.
 */
async function ensureAnyPermission() {
  const session = await requireAuth();
  const canManageWebsite = await hasPermission(session.user, "PRIVATE.SETTINGS.THEME.MANAGE");
  const canManagePages = await hasPermission(session.user, "PRIVATE.ADMIN.PAGES.MANAGE");
  if (!canManageWebsite && !canManagePages) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }
  return null;
}

async function ensureThemePermission() {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "PRIVATE.SETTINGS.THEME.MANAGE"))) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }
  return null;
}

async function ensurePagesPermission() {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "PRIVATE.ADMIN.PAGES.MANAGE"))) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const permissionResponse = await ensureAnyPermission();
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
    return NextResponse.json(
      { error: "Einstellungen konnten nicht geladen werden." },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  const permissionResponse = await ensureAnyPermission();
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
  const explicitThemeId = settingsPayload?.themeId;
  const activateTheme =
    parsed.data.activateTheme ?? Boolean(explicitThemeId !== undefined || themePayload);

  const writesThemeSettings =
    Boolean(themePayload) ||
    activateTheme ||
    settingsPayload?.siteTitle !== undefined ||
    settingsPayload?.colorMode !== undefined ||
    settingsPayload?.themeId !== undefined;

  if (writesThemeSettings) {
    const denied = await ensureThemePermission();
    if (denied) {
      return denied;
    }
  }

  if (settingsPayload?.pageVisibility !== undefined) {
    const denied = await ensurePagesPermission();
    if (denied) {
      return denied;
    }
  }

  if (!themePayload && !settingsPayload) {
    return NextResponse.json({ error: "Keine Änderungen übermittelt." }, { status: 400 });
  }

  try {
    await ensureWebsiteSettingsRecord();
    let savedTheme = null;

    if (themePayload) {
      savedTheme = await saveWebsiteTheme(themePayload.id, {
        name: themePayload.name ?? undefined,
        description: themePayload.description ?? undefined,
        tokens: themePayload.tokens,
      });
    }

    const desiredThemeId =
      explicitThemeId !== undefined
        ? explicitThemeId
        : activateTheme && themePayload
          ? themePayload.id
          : undefined;

    if (settingsPayload || desiredThemeId !== undefined) {
      await saveWebsiteSettings({
        siteTitle: settingsPayload?.siteTitle ?? undefined,
        colorMode: settingsPayload?.colorMode ?? undefined,
        pageVisibility: settingsPayload?.pageVisibility ?? undefined,
        themeId: desiredThemeId,
      });
    }

    const refreshed = await readWebsiteSettings();
    const resolved = resolveWebsiteSettings(refreshed);

    return NextResponse.json({
      settings: toClientWebsiteSettings(resolved),
      theme: savedTheme ? toClientWebsiteTheme(resolveWebsiteTheme(savedTheme)) : undefined,
    });
  } catch (error) {
    if (error instanceof LockedWebsiteThemeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Failed to save website settings", error);
    return NextResponse.json(
      { error: "Die Einstellungen konnten nicht gespeichert werden." },
      { status: 500 },
    );
  }
}

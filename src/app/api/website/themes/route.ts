import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  themeDescriptionSchema,
  themeIdSchema,
  themeImportSourceSchema,
  themeNameSchema,
} from "../theme-schemas";

import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { resolveThemeImport } from "@/lib/theme/import";
import { ThemeImportError } from "@/lib/theme/tweakcn";
import {
  createWebsiteTheme,
  listWebsiteThemes,
  type ClientWebsiteThemeSummary,
} from "@/lib/website-settings";

const createThemeSchema = z
  .object({
    name: themeNameSchema.optional(),
    description: themeDescriptionSchema,
    sourceThemeId: themeIdSchema.optional(),
    importSource: themeImportSourceSchema.optional(),
  })
  .optional();

async function ensurePermission() {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "PRIVATE.SETTINGS.THEME.MANAGE"))) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
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
    const themes = await listWebsiteThemes();
    return NextResponse.json({ themes });
  } catch (error) {
    console.error("Failed to list website themes", error);
    return NextResponse.json({ error: "Themes konnten nicht geladen werden." }, { status: 500 });
  }
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
    payload = undefined;
  }

  const parsed = createThemeSchema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json({ error: issue?.message ?? "Ungültige Eingabe." }, { status: 400 });
  }

  const { importSource, ...options } = parsed.data ?? {};
  let imported: Awaited<ReturnType<typeof resolveThemeImport>> | null = null;
  if (importSource) {
    try {
      imported = await resolveThemeImport(importSource);
    } catch (error) {
      if (error instanceof ThemeImportError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      console.error("Failed to import website theme", error);
      return NextResponse.json({ error: "Theme konnte nicht importiert werden." }, { status: 500 });
    }
  }

  try {
    const theme = await createWebsiteTheme({
      ...options,
      name:
        options.name ?? imported?.suggestedName ?? (imported ? "Importiertes Theme" : undefined),
      tokens: imported?.theme,
    });
    const summary: ClientWebsiteThemeSummary = {
      id: theme.id,
      name: theme.name,
      description: theme.description,
      isDefault: theme.isDefault,
      isPreset: theme.isPreset,
      updatedAt: theme.updatedAt,
    };
    return NextResponse.json({ theme, summary });
  } catch (error) {
    console.error("Failed to create website theme", error);
    return NextResponse.json({ error: "Theme konnte nicht erstellt werden." }, { status: 500 });
  }
}

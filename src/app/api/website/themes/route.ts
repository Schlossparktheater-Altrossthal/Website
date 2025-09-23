import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { themeDescriptionSchema, themeIdSchema, themeNameSchema } from "../theme-schemas";

import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { createWebsiteTheme, listWebsiteThemes, type ClientWebsiteThemeSummary } from "@/lib/website-settings";

const createThemeSchema = z
  .object({
    name: themeNameSchema.optional(),
    description: themeDescriptionSchema,
    sourceThemeId: themeIdSchema.optional(),
  })
  .optional();

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

  try {
    const theme = await createWebsiteTheme(parsed.data ?? {});
    const summary: ClientWebsiteThemeSummary = {
      id: theme.id,
      name: theme.name,
      description: theme.description,
      isDefault: theme.isDefault,
      updatedAt: theme.updatedAt,
    };
    return NextResponse.json({ theme, summary });
  } catch (error) {
    console.error("Failed to create website theme", error);
    return NextResponse.json({ error: "Theme konnte nicht erstellt werden." }, { status: 500 });
  }
}

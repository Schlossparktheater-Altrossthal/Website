import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { themeDescriptionSchema, themeNameSchema, themeTokensSchema } from "../../theme-schemas";

import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import {
  LockedWebsiteThemeError,
  getWebsiteTheme,
  saveWebsiteTheme,
} from "@/lib/website-settings";

const updateThemeSchema = z
  .object({
    name: themeNameSchema.optional(),
    description: themeDescriptionSchema,
    tokens: themeTokensSchema.optional(),
  })
  .optional();

async function ensurePermission() {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "mitglieder.website.settings"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ themeId: string }> }) {
  const { themeId } = await params;
  const permissionResponse = await ensurePermission();
  if (permissionResponse) {
    return permissionResponse;
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Datenbank ist nicht konfiguriert." }, { status: 500 });
  }

  const theme = await getWebsiteTheme(themeId);
  if (!theme) {
    return NextResponse.json({ error: "Theme nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ theme });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ themeId: string }> }) {
  const { themeId } = await params;
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

  const parsed = updateThemeSchema.safeParse(payload);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json({ error: issue?.message ?? "Ungültige Eingabe." }, { status: 400 });
  }

  const input = parsed.data ?? {};
  if (!input.name && !input.description && !input.tokens) {
    return NextResponse.json({ error: "Keine Änderungen übermittelt." }, { status: 400 });
  }

  try {
    const updated = await saveWebsiteTheme(themeId, {
      name: input.name ?? undefined,
      description: input.description ?? undefined,
      tokens: input.tokens ?? undefined,
    });

    return NextResponse.json({ theme: await getWebsiteTheme(updated.id) });
  } catch (error) {
    if (error instanceof LockedWebsiteThemeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Failed to update website theme", error);
    return NextResponse.json({ error: "Theme konnte nicht aktualisiert werden." }, { status: 500 });
  }
}

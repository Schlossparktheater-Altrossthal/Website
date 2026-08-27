import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import {
  readSeasonResetSettings,
  resolveProtectedRoles,
  saveProtectedRoles,
} from "@/lib/season-reset/settings";

const protectedRoleSchema = z.enum(["admin", "board", "finance", "tech", "cast", "member"]);

const updateSchema = z.object({
  protectedRoles: z.array(protectedRoleSchema).optional(),
});

async function ensurePermission(): Promise<NextResponse | null> {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "PRIVATE.ADMIN.MEMBERS.MANAGE"))) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const denied = await ensurePermission();
  if (denied) return denied;

  const record = await readSeasonResetSettings();
  return NextResponse.json({ protectedRoles: resolveProtectedRoles(record) });
}

export async function PUT(request: NextRequest) {
  const denied = await ensurePermission();
  if (denied) return denied;

  const raw: unknown = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
  }

  await saveProtectedRoles(parsed.data.protectedRoles ?? []);

  const record = await readSeasonResetSettings();
  return NextResponse.json({ protectedRoles: resolveProtectedRoles(record) });
}

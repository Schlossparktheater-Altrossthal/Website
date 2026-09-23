import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import {
  performSeasonChangeDeactivation,
  previewSeasonChangeDeactivation,
} from "@/lib/season-reset/deactivation";

const executeSchema = z.object({
  confirm: z.literal(true),
  keepUserIds: z.array(z.string().min(1)).max(1000).default([]),
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

  const candidates = await previewSeasonChangeDeactivation();
  return NextResponse.json({ candidates });
}

export async function POST(request: NextRequest) {
  const denied = await ensurePermission();
  if (denied) return denied;

  const raw: unknown = await request.json().catch(() => null);
  const parsed = executeSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Eingabe" }, { status: 400 });
  }

  try {
    const deactivated = await performSeasonChangeDeactivation(parsed.data.keepUserIds);
    return NextResponse.json({ deactivated });
  } catch (error) {
    console.error("season-reset deactivation failed", error);
    return NextResponse.json({ error: "Saisonabschluss fehlgeschlagen" }, { status: 500 });
  }
}

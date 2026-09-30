import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { ensurePhotoConsentPurposes } from "@/lib/photo-consent-purposes";
import type { PhotoConsentPurposeAdminEntry } from "@/types/photo-consent";

const audienceSchema = z.enum(["adult", "minor", "both"]);

const createSchema = z.object({
  showId: z.string().min(1),
  code: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]+$/)
    .max(60)
    .optional(),
  label: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400).nullable().optional(),
  appliesTo: audienceSchema.default("both"),
  isRefusal: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
});

const updateSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(400).nullable().optional(),
  appliesTo: audienceSchema.optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

type PurposeRow = {
  id: string;
  showId: string;
  code: string;
  label: string;
  description: string | null;
  sortOrder: number;
  appliesTo: "adult" | "minor" | "both";
  isRefusal: boolean;
  isActive: boolean;
  _count: { choices: number };
};

function toAdminEntry(purpose: PurposeRow): PhotoConsentPurposeAdminEntry {
  return {
    id: purpose.id,
    showId: purpose.showId,
    code: purpose.code,
    label: purpose.label,
    description: purpose.description,
    sortOrder: purpose.sortOrder,
    appliesTo: purpose.appliesTo,
    isRefusal: purpose.isRefusal,
    isActive: purpose.isActive,
    choiceCount: purpose._count.choices,
  };
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return slug || "punkt";
}

async function requireManager() {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "PRIVATE.ADMIN.PHOTOCONSENT.MANAGE"))) {
    return null;
  }
  return session;
}

const PURPOSE_INCLUDE = { _count: { select: { choices: true } } } as const;

export async function GET(request: NextRequest) {
  if (!(await requireManager())) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }
  const showId = request.nextUrl.searchParams.get("showId")?.trim() ?? "";
  if (!showId) {
    return NextResponse.json({ error: "showId fehlt" }, { status: 400 });
  }
  await ensurePhotoConsentPurposes(showId);
  const purposes = await prisma.photoConsentPurpose.findMany({
    where: { showId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: PURPOSE_INCLUDE,
  });
  return NextResponse.json({ entries: purposes.map(toAdminEntry) });
}

export async function POST(request: NextRequest) {
  if (!(await requireManager())) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }
  const data = parsed.data;
  const baseCode = data.code ?? slugify(data.label);

  let code = baseCode;
  for (let attempt = 2; attempt < 50; attempt += 1) {
    const existing = await prisma.photoConsentPurpose.findUnique({
      where: { showId_code: { showId: data.showId, code } },
      select: { id: true },
    });
    if (!existing) break;
    code = `${baseCode}_${attempt}`;
  }

  const created = await prisma.photoConsentPurpose.create({
    data: {
      showId: data.showId,
      code,
      label: data.label,
      description: data.description ?? null,
      appliesTo: data.appliesTo,
      isRefusal: data.isRefusal,
      sortOrder: data.sortOrder,
    },
    include: PURPOSE_INCLUDE,
  });

  return NextResponse.json({ ok: true, entry: toAdminEntry(created) });
}

export async function PATCH(request: NextRequest) {
  if (!(await requireManager())) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }
  const { id, ...rest } = parsed.data;

  try {
    const updated = await prisma.photoConsentPurpose.update({
      where: { id },
      data: {
        ...(rest.label !== undefined ? { label: rest.label } : {}),
        ...(rest.description !== undefined ? { description: rest.description } : {}),
        ...(rest.appliesTo !== undefined ? { appliesTo: rest.appliesTo } : {}),
        ...(rest.isActive !== undefined ? { isActive: rest.isActive } : {}),
        ...(rest.sortOrder !== undefined ? { sortOrder: rest.sortOrder } : {}),
      },
      include: PURPOSE_INCLUDE,
    });
    return NextResponse.json({ ok: true, entry: toAdminEntry(updated) });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2025"
    ) {
      return NextResponse.json({ error: "Punkt nicht gefunden" }, { status: 404 });
    }
    console.error("[PhotoConsentPurpose] Update failed", error);
    return NextResponse.json({ error: "Aktualisierung fehlgeschlagen" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await requireManager())) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }
  const id = request.nextUrl.searchParams.get("id")?.trim() ?? "";
  if (!id) {
    return NextResponse.json({ error: "Fehlende ID" }, { status: 400 });
  }

  // Punkte werden deaktiviert, nicht gelöscht: bestehende Auswahlen bleiben nachvollziehbar.
  try {
    const updated = await prisma.photoConsentPurpose.update({
      where: { id },
      data: { isActive: false },
      include: PURPOSE_INCLUDE,
    });
    return NextResponse.json({ ok: true, entry: toAdminEntry(updated) });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2025"
    ) {
      return NextResponse.json({ error: "Punkt nicht gefunden" }, { status: 404 });
    }
    console.error("[PhotoConsentPurpose] Delete failed", error);
    return NextResponse.json({ error: "Deaktivieren fehlgeschlagen" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import type { PhotoConsentAdminEntry } from "@/types/photo-consent";

type ConsentWithUser = {
  id: string;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
  updatedAt: Date;
  approvedAt: Date | null;
  rejectionReason: string | null;
  documentUploadedAt: Date | null;
  documentName: string | null;
  userId: string;
  user: { id: string; name: string | null; email: string | null; dateOfBirth: Date | null };
  approvedBy: { id: string; name: string | null } | null;
};

function calculateAge(date: Date | null | undefined): number | null {
  if (!date) return null;
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const monthDiff = now.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < date.getDate())) {
    age -= 1;
  }
  return age;
}

function mapConsent(consent: ConsentWithUser): PhotoConsentAdminEntry {
  const dateOfBirth = consent.user.dateOfBirth;
  const age = calculateAge(dateOfBirth);
  const requiresDocument = age !== null && age < 18;
  const requiresDateOfBirth = !dateOfBirth;
  return {
    id: consent.id,
    userId: consent.userId,
    name: consent.user.name,
    email: consent.user.email,
    status: consent.status,
    submittedAt: consent.createdAt.toISOString(),
    updatedAt: consent.updatedAt.toISOString(),
    approvedAt: consent.approvedAt ? consent.approvedAt.toISOString() : null,
    approvedByName: consent.approvedBy?.name ?? null,
    rejectionReason: consent.rejectionReason ?? null,
    hasDocument: Boolean(consent.documentUploadedAt),
    requiresDocument,
    requiresDateOfBirth,
    dateOfBirth: dateOfBirth ? dateOfBirth.toISOString() : null,
    age,
    documentName: consent.documentName ?? null,
    documentUrl: consent.documentUploadedAt ? `/api/photo-consents/${consent.id}/document` : null,
    documentUploadedAt: consent.documentUploadedAt ? consent.documentUploadedAt.toISOString() : null,
  };
}

export async function GET() {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "mitglieder.fotoerlaubnisse"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const consents = await prisma.photoConsent.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true, dateOfBirth: true } },
      approvedBy: { select: { id: true, name: true } },
    },
  });

  const entries = consents.map((consent) => mapConsent(consent as ConsentWithUser));
  return NextResponse.json({ entries });
}

export async function PATCH(request: NextRequest) {
  const session = await requireAuth();
  if (!(await hasPermission(session.user, "mitglieder.fotoerlaubnisse"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }

  const id = "id" in body ? String((body as { id?: unknown }).id ?? "").trim() : "";
  const action = "action" in body ? String((body as { action?: unknown }).action ?? "").trim() : "";
  const reasonRaw = "reason" in body ? (body as { reason?: unknown }).reason : undefined;

  if (!id) {
    return NextResponse.json({ error: "Fehlende ID" }, { status: 400 });
  }

  if (!["approve", "reject", "reset"].includes(action)) {
    return NextResponse.json({ error: "Unbekannte Aktion" }, { status: 400 });
  }

  let rejectionReason: string | null = null;
  if (action === "reject") {
    if (typeof reasonRaw !== "string" || !reasonRaw.trim()) {
      return NextResponse.json({ error: "Bitte gib einen Ablehnungsgrund an" }, { status: 400 });
    }
    rejectionReason = reasonRaw.trim();
  }

  try {
    const updateData: Record<string, unknown> = {};
    const now = new Date();

    if (action === "approve") {
      updateData.status = "approved";
      updateData.approvedAt = now;
      updateData.approvedById = session.user?.id ?? null;
      updateData.rejectionReason = null;
    } else if (action === "reject") {
      updateData.status = "rejected";
      updateData.approvedAt = null;
      updateData.approvedById = null;
      updateData.rejectionReason = rejectionReason;
    } else {
      updateData.status = "pending";
      updateData.approvedAt = null;
      updateData.approvedById = null;
      updateData.rejectionReason = null;
    }

    const updated = await prisma.photoConsent.update({
      where: { id },
      data: updateData,
      include: {
        user: { select: { id: true, name: true, email: true, dateOfBirth: true } },
        approvedBy: { select: { id: true, name: true } },
      },
    });

    const entry = mapConsent(updated as ConsentWithUser);
    return NextResponse.json({ ok: true, entry });
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "P2025") {
      return NextResponse.json({ error: "Eintrag nicht gefunden" }, { status: 404 });
    }
    console.error("[PhotoConsent] Update failed", error);
    return NextResponse.json({ error: "Aktualisierung fehlgeschlagen" }, { status: 500 });
  }
}

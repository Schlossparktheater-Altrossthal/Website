import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { isIssueCategory, isIssuePriority, isIssueStatus } from "@/lib/issues";
import { mapIssueDetail } from "../utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> },
) {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.issues");
  if (!allowed) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const { issueId } = await params;
  if (!issueId) {
    return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  }

  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      updatedBy: { select: { id: true, name: true, email: true } },
      _count: { select: { comments: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  if (!issue) {
    return NextResponse.json({ error: "Anliegen nicht gefunden" }, { status: 404 });
  }

  return NextResponse.json({ issue: mapIssueDetail(issue) });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> },
) {
  const session = await requireAuth();
  const [canView, canManage] = await Promise.all([
    hasPermission(session.user, "mitglieder.issues"),
    hasPermission(session.user, "mitglieder.issues.manage"),
  ]);

  if (!canView) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const userId = session.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const { issueId } = await params;
  if (!issueId) {
    return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  }

  const existing = await prisma.issue.findUnique({
    where: { id: issueId },
    select: { createdById: true, status: true, priority: true, category: true, resolvedAt: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Anliegen nicht gefunden" }, { status: 404 });
  }

  const canUpdate = canManage || existing.createdById === userId;

  const rawBody = await request.json().catch(() => null);
  if (!rawBody || typeof rawBody !== "object") {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }

  const body = rawBody as Record<string, unknown>;
  const updateData: Prisma.IssueUpdateInput = {};
  let touched = false;
  const now = new Date();

  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !isIssueStatus(body.status)) {
      return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
    }
    if (!canUpdate) {
      return NextResponse.json({ error: "Keine Berechtigung für Statusänderungen" }, { status: 403 });
    }
    if (body.status !== existing.status) {
      updateData.status = body.status;
      updateData.updatedBy = { connect: { id: userId } };
      updateData.lastActivityAt = now;
      if (body.status === "resolved" || body.status === "closed") {
        updateData.resolvedAt = now;
      } else if (existing.resolvedAt) {
        updateData.resolvedAt = null;
      }
      touched = true;
    }
  }

  if (body.priority !== undefined) {
    if (typeof body.priority !== "string" || !isIssuePriority(body.priority)) {
      return NextResponse.json({ error: "Ungültige Priorität" }, { status: 400 });
    }
    if (!canManage) {
      return NextResponse.json({ error: "Keine Berechtigung zur Prioritätsänderung" }, { status: 403 });
    }
    if (body.priority !== existing.priority) {
      updateData.priority = body.priority;
      updateData.updatedBy = { connect: { id: userId } };
      updateData.lastActivityAt = now;
      touched = true;
    }
  }

  if (body.category !== undefined) {
    if (typeof body.category !== "string" || !isIssueCategory(body.category)) {
      return NextResponse.json({ error: "Ungültige Kategorie" }, { status: 400 });
    }
    if (!canManage) {
      return NextResponse.json({ error: "Keine Berechtigung zur Kategorienänderung" }, { status: 403 });
    }
    if (body.category !== existing.category) {
      updateData.category = body.category;
      updateData.updatedBy = { connect: { id: userId } };
      updateData.lastActivityAt = now;
      touched = true;
    }
  }

  if (!touched) {
    return NextResponse.json({ error: "Keine Änderungen erkannt" }, { status: 400 });
  }

  const updated = await prisma.issue.update({
    where: { id: issueId },
    data: updateData,
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      updatedBy: { select: { id: true, name: true, email: true } },
      _count: { select: { comments: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  return NextResponse.json({ issue: mapIssueDetail(updated) });
}

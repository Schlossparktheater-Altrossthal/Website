import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { mapIssueDetail } from "../../utils";

export async function POST(
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

  const issueMeta = await prisma.issue.findUnique({
    where: { id: issueId },
    select: { id: true, visibility: true, createdById: true },
  });
  if (!issueMeta) {
    return NextResponse.json({ error: "Anliegen nicht gefunden" }, { status: 404 });
  }

  if (issueMeta.visibility === "private" && !canManage && issueMeta.createdById !== userId) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const rawBody = await request.json().catch(() => null);
  if (!rawBody || typeof rawBody !== "object") {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }

  const body = rawBody as Record<string, unknown>;
  const content = typeof body.body === "string" ? body.body.trim() : "";
  if (content.length < 2) {
    return NextResponse.json({ error: "Kommentar muss mindestens 2 Zeichen enthalten" }, { status: 400 });
  }
  if (content.length > 4000) {
    return NextResponse.json({ error: "Kommentar darf maximal 4000 Zeichen enthalten" }, { status: 400 });
  }

  const [comment, updatedIssue] = await prisma.$transaction([
    prisma.issueComment.create({
      data: {
        issueId,
        authorId: userId,
        body: content,
      },
      include: { author: { select: { id: true, name: true, email: true } } },
    }),
    prisma.issue.update({
      where: { id: issueId },
      data: {
        lastActivityAt: new Date(),
        updatedBy: { connect: { id: userId } },
      },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        updatedBy: { select: { id: true, name: true, email: true } },
        _count: { select: { comments: true } },
        comments: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { id: true, name: true, email: true } } },
        },
      },
    }),
  ]);

  return NextResponse.json({
    comment: {
      id: comment.id,
      issueId: comment.issueId,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      authorId: comment.authorId,
      author: comment.author
        ? { id: comment.author.id, name: comment.author.name, email: comment.author.email }
        : null,
    },
    issue: mapIssueDetail(updatedIssue),
  });
}

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import {
  DEFAULT_ISSUE_CATEGORY,
  DEFAULT_ISSUE_PRIORITY,
  isIssueCategory,
  isIssuePriority,
  isIssueStatus,
} from "@/lib/issues";
import type { IssueStatusCounts } from "@/components/members/issues/types";
import { mapIssueSummary } from "./utils";

const MAX_RESULTS = 100;

export async function GET(request: NextRequest) {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.issues");
  if (!allowed) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status");
  const categoryParam = url.searchParams.get("category");
  const searchParam = url.searchParams.get("q");

  const where: Prisma.IssueWhereInput = {};

  if (statusParam && isIssueStatus(statusParam)) {
    where.status = statusParam;
  }

  if (categoryParam && isIssueCategory(categoryParam)) {
    where.category = categoryParam;
  }

  if (searchParam && searchParam.trim()) {
    const term = searchParam.trim();
    const searchFilter: Prisma.IssueWhereInput = {
      OR: [
        { title: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
      ],
    };
    if (Array.isArray(where.AND)) {
      where.AND.push(searchFilter);
    } else if (where.AND) {
      where.AND = [where.AND, searchFilter];
    } else {
      where.AND = [searchFilter];
    }
  }

  const [issuesRaw, countsRaw] = await Promise.all([
    prisma.issue.findMany({
      where,
      orderBy: { lastActivityAt: "desc" },
      take: MAX_RESULTS,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        updatedBy: { select: { id: true, name: true, email: true } },
        _count: { select: { comments: true } },
      },
    }),
    prisma.issue.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const counts: IssueStatusCounts = { open: 0, in_progress: 0, resolved: 0, closed: 0 };
  for (const entry of countsRaw) {
    counts[entry.status] = entry._count._all;
  }

  return NextResponse.json({
    issues: issuesRaw.map(mapIssueSummary),
    counts,
  });
}

export async function POST(request: NextRequest) {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.issues");
  if (!allowed) {
    return NextResponse.json({ error: "Kein Zugriff" }, { status: 403 });
  }

  const userId = session.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const rawBody = await request.json().catch(() => null);
  if (!rawBody || typeof rawBody !== "object") {
    return NextResponse.json({ error: "Ungültige Daten" }, { status: 400 });
  }

  const body = rawBody as Record<string, unknown>;

  const titleValue = typeof body.title === "string" ? body.title.trim() : "";
  if (titleValue.length < 4) {
    return NextResponse.json({ error: "Titel muss mindestens 4 Zeichen lang sein" }, { status: 400 });
  }
  if (titleValue.length > 160) {
    return NextResponse.json({ error: "Titel darf maximal 160 Zeichen haben" }, { status: 400 });
  }

  const descriptionValue = typeof body.description === "string" ? body.description.trim() : "";
  if (descriptionValue.length < 10) {
    return NextResponse.json({ error: "Beschreibung muss mindestens 10 Zeichen enthalten" }, { status: 400 });
  }
  if (descriptionValue.length > 4000) {
    return NextResponse.json({ error: "Beschreibung darf maximal 4000 Zeichen enthalten" }, { status: 400 });
  }

  let category = DEFAULT_ISSUE_CATEGORY;
  if (typeof body.category === "string" && isIssueCategory(body.category)) {
    category = body.category;
  }

  let priority = DEFAULT_ISSUE_PRIORITY;
  if (typeof body.priority === "string" && isIssuePriority(body.priority)) {
    priority = body.priority;
  }

  const issue = await prisma.issue.create({
    data: {
      title: titleValue,
      description: descriptionValue,
      category,
      priority,
      status: "open",
      createdById: userId,
      updatedById: userId,
      lastActivityAt: new Date(),
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      updatedBy: { select: { id: true, name: true, email: true } },
      _count: { select: { comments: true } },
    },
  });

  return NextResponse.json({ issue: mapIssueSummary(issue) }, { status: 201 });
}

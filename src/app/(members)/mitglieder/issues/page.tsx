import { PageHeader } from "@/components/members/page-header";
import { IssueOverview } from "@/components/members/issues/issue-overview";
import type { IssueStatusCounts, IssueSummary } from "@/components/members/issues/types";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import type { IssueStatus } from "@prisma/client";

function createEmptyCounts(): IssueStatusCounts {
  return {
    open: 0,
    in_progress: 0,
    resolved: 0,
    closed: 0,
  };
}

export default async function IssuesPage() {
  const session = await requireAuth();
  const [canView, canManage] = await Promise.all([
    hasPermission(session.user, "mitglieder.issues"),
    hasPermission(session.user, "mitglieder.issues.manage"),
  ]);

  if (!canView) {
    return <div className="text-sm text-red-600">Kein Zugriff auf den Feedback-Bereich.</div>;
  }

  const currentUserId = session.user?.id ?? "";

  const [issuesRaw, countsRaw] = await Promise.all([
    prisma.issue.findMany({
      orderBy: { lastActivityAt: "desc" },
      take: 50,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        updatedBy: { select: { id: true, name: true, email: true } },
        _count: { select: { comments: true } },
      },
    }),
    prisma.issue.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const counts = countsRaw.reduce((acc, entry) => {
    acc[entry.status as IssueStatus] = entry._count._all;
    return acc;
  }, createEmptyCounts());

  const initialIssues: IssueSummary[] = issuesRaw.map((issue) => ({
    id: issue.id,
    title: issue.title,
    description: issue.description,
    category: issue.category,
    status: issue.status,
    priority: issue.priority,
    createdAt: issue.createdAt.toISOString(),
    updatedAt: issue.updatedAt.toISOString(),
    lastActivityAt: issue.lastActivityAt.toISOString(),
    resolvedAt: issue.resolvedAt ? issue.resolvedAt.toISOString() : null,
    createdById: issue.createdById,
    updatedById: issue.updatedById ?? null,
    createdBy: issue.createdBy
      ? { id: issue.createdBy.id, name: issue.createdBy.name, email: issue.createdBy.email }
      : null,
    updatedBy: issue.updatedBy
      ? { id: issue.updatedBy.id, name: issue.updatedBy.name, email: issue.updatedBy.email }
      : null,
    commentCount: issue._count.comments,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feedback & Support"
        description="Melde Probleme, Bugs oder Verbesserungsvorschläge und verfolge den Bearbeitungsstand im Mitglieder-Issue-Board."
      />
      <IssueOverview
        initialIssues={initialIssues}
        initialCounts={counts}
        canManage={canManage}
        currentUserId={currentUserId}
      />
    </div>
  );
}

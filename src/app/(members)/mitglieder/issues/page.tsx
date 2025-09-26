import { PageHeader } from "@/components/members/page-header";
import { IssueOverview } from "@/components/members/issues/issue-overview";
import type { IssueStatusCounts, IssueSummary } from "@/components/members/issues/types";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import type { Prisma } from "@prisma/client";
import { mapIssueSummary } from "@/app/api/issues/utils";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";

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

  const baseWhere: Prisma.IssueWhereInput = canManage
    ? {}
    : {
        OR: [
          { visibility: "public" },
          ...(currentUserId ? [{ createdById: currentUserId }] : []),
        ],
      };

  const [issuesRaw, countsRaw] = await Promise.all([
    prisma.issue.findMany({
      where: baseWhere,
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
      where: baseWhere,
      _count: { _all: true },
    }),
  ]);

  type StatusCount = { status: import("@prisma/client").IssueStatus; _count: { _all: number } };
  const counts = countsRaw.reduce<IssueStatusCounts>((acc, entry: StatusCount) => {
    if (entry.status in acc) {
      const key = entry.status as keyof IssueStatusCounts;
      acc[key] = entry._count._all;
    }
    return acc;
  }, createEmptyCounts());

  const initialIssues: IssueSummary[] = issuesRaw.map(mapIssueSummary);
  const breadcrumbs = [membersNavigationBreadcrumb("/mitglieder/issues")];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feedback & Support"
        description="Melde Probleme, Bugs oder Verbesserungsvorschläge und verfolge den Bearbeitungsstand im Mitglieder-Issue-Board."
        breadcrumbs={breadcrumbs}
      />
      <IssueOverview
        initialIssues={initialIssues}
        initialCounts={counts}
      />
    </div>
  );
}

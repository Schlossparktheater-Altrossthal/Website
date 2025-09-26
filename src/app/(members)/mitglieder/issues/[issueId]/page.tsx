import { notFound } from "next/navigation";
import { PageHeader } from "@/components/members/page-header";
import { IssueDetail } from "@/components/members/issues/issue-detail";
import type { IssueDetail as IssueDetailType } from "@/components/members/issues/types";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { hasPermission } from "@/lib/permissions";
import { membersNavigationBreadcrumb } from "@/lib/members-breadcrumbs";
import { mapIssueDetail } from "@/app/api/issues/utils";
import {
  ISSUE_STATUS_BADGE_CLASSES,
  ISSUE_STATUS_LABELS,
} from "@/lib/issues";
import { cn } from "@/lib/utils";
import { formatRelativeWithAbsolute } from "@/lib/datetime";

function IssueHeaderDescription({ issue }: { issue: IssueDetailType }) {
  const createdInfo = formatRelativeWithAbsolute(new Date(issue.createdAt));
  const lastActivityInfo = formatRelativeWithAbsolute(new Date(issue.lastActivityAt));
  const author = issue.createdBy?.name || issue.createdBy?.email || "Unbekannt";
  const commentLabel = issue.commentCount === 1 ? "1 Kommentar" : `${issue.commentCount} Kommentare`;
  const parts = [
    `Gemeldet von ${author} ${createdInfo.combined}`,
    `Letzte Aktivität ${lastActivityInfo.combined}`,
    commentLabel,
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      {parts.map((part, index) => (
        <span key={`${part}-${index}`} className="flex items-center gap-2">
          {index > 0 ? <span aria-hidden>•</span> : null}
          <span>{part}</span>
        </span>
      ))}
    </div>
  );
}

type PageProps = { params: Promise<{ issueId: string }> };

export default async function IssueDetailPage({ params }: PageProps) {
  const session = await requireAuth();
  const [canView, canManage] = await Promise.all([
    hasPermission(session.user, "mitglieder.issues"),
    hasPermission(session.user, "mitglieder.issues.manage"),
  ]);

  if (!canView) {
    return <div className="text-sm text-red-600">Kein Zugriff auf den Feedback-Bereich.</div>;
  }

  const { issueId } = await params;
  if (!issueId) {
    notFound();
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
    notFound();
  }

  const currentUserId = session.user?.id ?? "";
  if (issue.visibility === "private" && !canManage && issue.createdById !== currentUserId) {
    return <div className="text-sm text-red-600">Kein Zugriff auf dieses Anliegen.</div>;
  }

  const mapped = mapIssueDetail(issue);
  const shortId = issue.id.slice(0, 8);
  const breadcrumbs = [
    membersNavigationBreadcrumb("/mitglieder/issues"),
    { href: `/mitglieder/issues/${issue.id}`, label: `Anliegen #${shortId}` },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`#${shortId} ${mapped.title}`}
        description={<IssueHeaderDescription issue={mapped} />}
        status={
          <Badge className={cn("border", ISSUE_STATUS_BADGE_CLASSES[mapped.status])}>
            {ISSUE_STATUS_LABELS[mapped.status]}
          </Badge>
        }
        breadcrumbs={breadcrumbs}
      />
      <IssueDetail
        issueId={mapped.id}
        canManage={canManage}
        currentUserId={currentUserId}
        initialIssue={mapped}
      />
    </div>
  );
}

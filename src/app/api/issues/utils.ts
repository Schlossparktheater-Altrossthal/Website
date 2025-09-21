import type { Prisma } from "@prisma/client";
import type { IssueDetail, IssueSummary } from "@/components/members/issues/types";

type IssueSummaryPayload = Prisma.IssueGetPayload<{
  include: {
    createdBy: { select: { id: true; name: true; email: true } };
    updatedBy: { select: { id: true; name: true; email: true } };
    _count: { select: { comments: true } };
  };
}>;

type IssueDetailPayload = Prisma.IssueGetPayload<{
  include: {
    createdBy: { select: { id: true; name: true; email: true } };
    updatedBy: { select: { id: true; name: true; email: true } };
    _count: { select: { comments: true } };
    comments: {
      orderBy: { createdAt: "asc" };
      include: { author: { select: { id: true; name: true; email: true } } };
    };
  };
}>;

export function mapIssueSummary(issue: IssueSummaryPayload): IssueSummary {
  return {
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
  };
}

export function mapIssueDetail(issue: IssueDetailPayload): IssueDetail {
  const summary = mapIssueSummary(issue);
  return {
    ...summary,
    comments: issue.comments.map((comment) => ({
      id: comment.id,
      issueId: comment.issueId,
      body: comment.body,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      authorId: comment.authorId,
      author: comment.author
        ? { id: comment.author.id, name: comment.author.name, email: comment.author.email }
        : null,
    })),
  };
}

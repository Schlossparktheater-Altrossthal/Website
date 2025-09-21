import type { IssueCategory, IssuePriority, IssueStatus, IssueVisibility } from "@/lib/issues";

export type IssueActor = {
  id: string;
  name: string | null;
  email: string | null;
};

export type IssueSummary = {
  id: string;
  title: string;
  description: string;
  descriptionHtml: string;
  category: IssueCategory;
  status: IssueStatus;
  priority: IssuePriority;
  visibility: IssueVisibility;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
  resolvedAt: string | null;
  createdById: string | null;
  updatedById: string | null;
  createdBy: IssueActor | null;
  updatedBy: IssueActor | null;
  commentCount: number;
};

export type IssueComment = {
  id: string;
  issueId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: IssueActor | null;
  authorId: string | null;
};

export type IssueDetail = IssueSummary & {
  comments: IssueComment[];
};

export type IssueStatusCounts = Record<IssueStatus, number>;

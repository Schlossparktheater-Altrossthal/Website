"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  IssueCategory,
  IssuePriority,
  IssueStatus,
  IssueVisibility,
} from "@/lib/issues";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ISSUE_CATEGORY_BADGE_CLASSES,
  ISSUE_CATEGORY_LABELS,
  ISSUE_CATEGORY_VALUES,
  ISSUE_PRIORITY_BADGE_CLASSES,
  ISSUE_PRIORITY_LABELS,
  ISSUE_PRIORITY_VALUES,
  ISSUE_STATUS_BADGE_CLASSES,
  ISSUE_STATUS_LABELS,
  ISSUE_STATUS_VALUES,
  ISSUE_VISIBILITY_BADGE_CLASSES,
  ISSUE_VISIBILITY_DESCRIPTIONS,
  ISSUE_VISIBILITY_LABELS,
  ISSUE_VISIBILITY_VALUES,
  isIssueCategory,
  isIssuePriority,
  isIssueStatus,
  isIssueVisibility,
} from "@/lib/issues";
import { cn } from "@/lib/utils";
import type { IssueDetail as IssueDetailType, IssueSummary } from "./types";

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "-";
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

type IssueDetailProps = {
  issueId: string;
  canManage: boolean;
  currentUserId: string;
  onIssueUpdated: (issue: IssueSummary) => void;
};

export function IssueDetail({ issueId, canManage, currentUserId, onIssueUpdated }: IssueDetailProps) {
  const [issue, setIssue] = useState<IssueDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  const canUpdate = useMemo(() => {
    if (canManage) return true;
    if (!issue) return false;
    return issue.createdById === currentUserId;
  }, [canManage, issue, currentUserId]);

  const loadIssue = useCallback(
    async (emitUpdate = false) => {
      if (!issueId) return;
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/issues/${issueId}`);
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.error ?? "Anliegen konnte nicht geladen werden");
        }
        if (!data?.issue) {
          throw new Error("Anliegen nicht gefunden");
        }
        setIssue(data.issue as IssueDetailType);
        if (emitUpdate) {
          const { comments, ...summary } = data.issue as IssueDetailType;
          void comments;
          onIssueUpdated(summary);
        }
      } catch (err) {
        console.error("[IssueDetail] load", err);
        setError(err instanceof Error ? err.message : "Anliegen konnte nicht geladen werden");
      } finally {
        setLoading(false);
      }
    },
    [issueId, onIssueUpdated],
  );

  useEffect(() => {
    void loadIssue(false);
    setCommentDraft("");
  }, [issueId, loadIssue]);

  const handleUpdate = useCallback(
    async (
      updates: Partial<{
        status: IssueStatus;
        priority: IssuePriority;
        category: IssueCategory;
        visibility: IssueVisibility;
      }>,
    ) => {
      if (!issue) return;
      if (updates.status && !isIssueStatus(updates.status)) return;
      if (updates.priority && !isIssuePriority(updates.priority)) return;
      if (updates.category && !isIssueCategory(updates.category)) return;
      if (updates.visibility && !isIssueVisibility(updates.visibility)) return;
      setUpdating(true);
      try {
        const response = await fetch(`/api/issues/${issue.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.error ?? "Aktualisierung fehlgeschlagen");
        }
        if (!data?.issue) {
          throw new Error("Unerwartete Antwort vom Server");
        }
        setIssue(data.issue as IssueDetailType);
        const { comments, ...summary } = data.issue as IssueDetailType;
        void comments;
        onIssueUpdated(summary);
        toast.success("Änderungen gespeichert");
      } catch (err) {
        console.error("[IssueDetail] update", err);
        toast.error(err instanceof Error ? err.message : "Änderung fehlgeschlagen");
      } finally {
        setUpdating(false);
      }
    },
    [issue, onIssueUpdated],
  );

  const handleStatusChange = async (nextStatus: string) => {
    if (!issue) return;
    if (issue.status === nextStatus) return;
    if (!isIssueStatus(nextStatus)) return;
    await handleUpdate({ status: nextStatus });
  };

  const handlePriorityChange = async (nextPriority: string) => {
    if (!issue) return;
    if (issue.priority === nextPriority) return;
    if (!isIssuePriority(nextPriority)) return;
    await handleUpdate({ priority: nextPriority });
  };

  const handleCategoryChange = async (nextCategory: string) => {
    if (!issue) return;
    if (issue.category === nextCategory) return;
    if (!isIssueCategory(nextCategory)) return;
    await handleUpdate({ category: nextCategory });
  };

  const handleVisibilityChange = async (nextVisibility: string) => {
    if (!issue) return;
    if (issue.visibility === nextVisibility) return;
    if (!isIssueVisibility(nextVisibility)) return;
    await handleUpdate({ visibility: nextVisibility });
  };

  const handleCommentSubmit = async () => {
    if (!issue) return;
    const trimmed = commentDraft.trim();
    if (!trimmed) {
      toast.error("Kommentar darf nicht leer sein");
      return;
    }
    setPostingComment(true);
    try {
      const response = await fetch(`/api/issues/${issue.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: trimmed }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Kommentar konnte nicht gespeichert werden");
      }
      if (!data?.issue) {
        throw new Error("Unerwartete Antwort vom Server");
      }
      setCommentDraft("");
      setIssue(data.issue as IssueDetailType);
      const { comments, ...summary } = data.issue as IssueDetailType;
      void comments;
      onIssueUpdated(summary);
      toast.success("Kommentar hinzugefügt");
    } catch (err) {
      console.error("[IssueDetail] comment", err);
      toast.error(err instanceof Error ? err.message : "Kommentar konnte nicht gespeichert werden");
    } finally {
      setPostingComment(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-2/3 animate-pulse rounded bg-muted/40" />
        <div className="space-y-2">
          <div className="h-4 w-full animate-pulse rounded bg-muted/40" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-muted/30" />
        </div>
        <div className="h-48 w-full animate-pulse rounded bg-muted/20" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button type="button" variant="outline" onClick={() => loadIssue(true)}>
          Erneut versuchen
        </Button>
      </div>
    );
  }

  if (!issue) {
    return <p className="text-sm text-muted-foreground">Anliegen konnte nicht geladen werden.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={cn("border", ISSUE_STATUS_BADGE_CLASSES[issue.status])}>
            {ISSUE_STATUS_LABELS[issue.status]}
          </Badge>
          <Badge className={cn("border", ISSUE_PRIORITY_BADGE_CLASSES[issue.priority])}>
            Priorität: {ISSUE_PRIORITY_LABELS[issue.priority]}
          </Badge>
          <Badge className={cn("border", ISSUE_CATEGORY_BADGE_CLASSES[issue.category])}>
            {ISSUE_CATEGORY_LABELS[issue.category]}
          </Badge>
          <Badge className={cn("border", ISSUE_VISIBILITY_BADGE_CLASSES[issue.visibility])}>
            {ISSUE_VISIBILITY_LABELS[issue.visibility]}
          </Badge>
        </div>
        <h2 className="text-xl font-semibold">{issue.title}</h2>
        {issue.descriptionHtml ? (
          <div
            className="prose prose-sm max-w-none text-foreground prose-headings:text-foreground prose-a:text-primary"
            dangerouslySetInnerHTML={{ __html: issue.descriptionHtml }}
          />
        ) : (
          <p className="whitespace-pre-line text-sm text-foreground/80">{issue.description}</p>
        )}
      </div>

      <div className="grid gap-4 rounded-lg border border-border/40 bg-muted/10 p-4 text-sm text-muted-foreground md:grid-cols-2">
        <div>
          <div className="font-medium text-foreground/80">Erstellt von</div>
          <div>
            {issue.createdBy?.name || issue.createdBy?.email || "Unbekannt"}
            <span className="ml-2 text-xs text-muted-foreground">am {formatDateTime(issue.createdAt)}</span>
          </div>
        </div>
        <div>
          <div className="font-medium text-foreground/80">Letzte Aktivität</div>
          <div>
            {formatDateTime(issue.lastActivityAt)}
            {issue.updatedBy?.name ? (
              <span className="ml-2 text-xs text-muted-foreground">durch {issue.updatedBy.name}</span>
            ) : null}
          </div>
        </div>
        <div>
          <div className="font-medium text-foreground/80">Status geändert</div>
          <div>{formatDateTime(issue.updatedAt)}</div>
        </div>
        <div>
          <div className="font-medium text-foreground/80">Kommentare</div>
          <div>{issue.commentCount}</div>
        </div>
      </div>

      {(canUpdate || canManage) && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">Status</label>
            <Select value={issue.status} onValueChange={handleStatusChange} disabled={!canUpdate || updating}>
              <SelectTrigger>
                <SelectValue placeholder="Status wählen" />
              </SelectTrigger>
              <SelectContent>
                {ISSUE_STATUS_VALUES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {ISSUE_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">Priorität</label>
            <Select value={issue.priority} onValueChange={handlePriorityChange} disabled={!canManage || updating}>
              <SelectTrigger>
                <SelectValue placeholder="Priorität wählen" />
              </SelectTrigger>
              <SelectContent>
                {ISSUE_PRIORITY_VALUES.map((priority) => (
                  <SelectItem key={priority} value={priority}>
                    {ISSUE_PRIORITY_LABELS[priority]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {canManage ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/80">Kategorie</label>
              <Select value={issue.category} onValueChange={handleCategoryChange} disabled={updating}>
                <SelectTrigger>
                  <SelectValue placeholder="Kategorie wählen" />
                </SelectTrigger>
                <SelectContent>
                  {ISSUE_CATEGORY_VALUES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {ISSUE_CATEGORY_LABELS[category]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {canUpdate ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground/80">Sichtbarkeit</label>
              <Select value={issue.visibility} onValueChange={handleVisibilityChange} disabled={updating}>
                <SelectTrigger>
                  <SelectValue placeholder="Sichtbarkeit wählen" />
                </SelectTrigger>
                <SelectContent>
                  {ISSUE_VISIBILITY_VALUES.map((visibility) => (
                    <SelectItem key={visibility} value={visibility}>
                      <div className="flex flex-col text-left">
                        <span>{ISSUE_VISIBILITY_LABELS[visibility]}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {ISSUE_VISIBILITY_DESCRIPTIONS[visibility]}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">Kommentare</h3>
          <Button type="button" variant="outline" size="sm" onClick={() => loadIssue(true)} disabled={loading}>
            Aktualisieren
          </Button>
        </div>
        <div className="space-y-4">
          {issue.comments.length > 0 ? (
            issue.comments.map((comment) => (
              <div key={comment.id} className="rounded-lg border border-border/40 bg-background/80 p-3 text-sm">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{comment.author?.name || comment.author?.email || "Unbekannt"}</span>
                  <span>{formatDateTime(comment.createdAt)}</span>
                </div>
                <p className="mt-2 whitespace-pre-line text-foreground/80">{comment.body}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Noch keine Kommentare vorhanden.</p>
          )}
        </div>

        <div className="rounded-lg border border-dashed border-border/50 bg-muted/10 p-4">
          <h4 className="text-sm font-semibold text-foreground">Kommentar hinzufügen</h4>
          <Textarea
            value={commentDraft}
            onChange={(event) => setCommentDraft(event.target.value)}
            rows={4}
            placeholder="Teile Updates, Rückfragen oder weitere Details zu diesem Anliegen."
            className="mt-2"
          />
          <div className="mt-3 flex items-center justify-end gap-3">
            <input type="hidden" value={issueId} readOnly aria-hidden />
            <Button type="button" onClick={handleCommentSubmit} disabled={postingComment || commentDraft.trim().length === 0}>
              {postingComment ? "Wird gespeichert..." : "Kommentar speichern"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

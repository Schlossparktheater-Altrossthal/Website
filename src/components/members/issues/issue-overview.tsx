"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { IssueCategory, IssueStatus } from "@/lib/issues";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ISSUE_CATEGORY_BADGE_CLASSES,
  ISSUE_CATEGORY_LABELS,
  ISSUE_CATEGORY_VALUES,
  ISSUE_PRIORITY_BADGE_CLASSES,
  ISSUE_PRIORITY_LABELS,
  ISSUE_STATUS_BADGE_CLASSES,
  ISSUE_STATUS_LABELS,
  ISSUE_STATUS_VALUES,
  ISSUE_VISIBILITY_BADGE_CLASSES,
  ISSUE_VISIBILITY_LABELS,
} from "@/lib/issues";
import { cn } from "@/lib/utils";
import { IssueCreateForm } from "./issue-create-form";
import type { IssueStatusCounts, IssueSummary } from "./types";
import { formatRelativeFromNow } from "@/lib/datetime";
import { CircleDot, MessageSquare, CheckCircle2, Loader2, XCircle } from "lucide-react";

type IssueOverviewProps = {
  initialIssues: IssueSummary[];
  initialCounts: IssueStatusCounts;
};

type StatusFilterValue = "all" | IssueStatus;
type CategoryFilterValue = "all" | IssueCategory;

const STATUS_ICON_MAP: Record<
  IssueStatus,
  { icon: LucideIcon; className: string; label: string }
> = {
  open: { icon: CircleDot, className: "text-emerald-500", label: ISSUE_STATUS_LABELS.open },
  in_progress: { icon: Loader2, className: "text-sky-500", label: ISSUE_STATUS_LABELS.in_progress },
  resolved: { icon: CheckCircle2, className: "text-emerald-500", label: ISSUE_STATUS_LABELS.resolved },
  closed: { icon: XCircle, className: "text-rose-500", label: ISSUE_STATUS_LABELS.closed },
};

function IssueStatusIcon({ status }: { status: IssueStatus }) {
  const config = STATUS_ICON_MAP[status];
  const Icon = config.icon;
  const className = cn("h-5 w-5", status === "in_progress" ? "animate-spin" : null, config.className);
  return <Icon aria-hidden className={className} />;
}

function normalizeCounts(counts?: Partial<IssueStatusCounts> | null): IssueStatusCounts {
  return {
    open: counts?.open ?? 0,
    in_progress: counts?.in_progress ?? 0,
    resolved: counts?.resolved ?? 0,
    closed: counts?.closed ?? 0,
  };
}

export function IssueOverview({ initialIssues, initialCounts }: IssueOverviewProps) {
  const [issues, setIssues] = useState<IssueSummary[]>(initialIssues);
  const [counts, setCounts] = useState<IssueStatusCounts>(normalizeCounts(initialCounts));
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("open");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterValue>("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const totalCount = counts.open + counts.in_progress + counts.resolved + counts.closed;

  const statusOptions = useMemo(
    () => [
      { value: "all" as StatusFilterValue, label: "Alle", count: totalCount },
      ...ISSUE_STATUS_VALUES.map((status) => ({
        value: status as StatusFilterValue,
        label: ISSUE_STATUS_LABELS[status],
        count: counts[status],
      })),
    ],
    [counts, totalCount],
  );

  const loadIssues = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (categoryFilter !== "all") params.set("category", categoryFilter);
    if (searchTerm.trim()) params.set("q", searchTerm.trim());

    setLoading(true);
    try {
      const query = params.toString();
      const response = await fetch(`/api/issues${query ? `?${query}` : ""}`, {
        cache: "no-store",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Anliegen konnten nicht geladen werden");
      }
      const nextIssues = Array.isArray(data?.issues) ? (data.issues as IssueSummary[]) : [];
      setIssues(nextIssues);
      setCounts(normalizeCounts(data?.counts as IssueStatusCounts));
    } catch (err) {
      console.error("[IssueOverview] load", err);
      toast.error(err instanceof Error ? err.message : "Anliegen konnten nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, searchTerm]);

  useEffect(() => {
    void loadIssues();
  }, [loadIssues]);

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchTerm(searchInput.trim());
  };

  const handleClearFilters = () => {
    setStatusFilter("open");
    setCategoryFilter("all");
    setSearchInput("");
    setSearchTerm("");
  };

  const handleIssueCreated = (issue: IssueSummary) => {
    setCreateOpen(false);
    const term = searchTerm.trim().toLowerCase();
    const matchesStatus = statusFilter === "all" || statusFilter === issue.status;
    const matchesCategory = categoryFilter === "all" || categoryFilter === issue.category;
    const matchesSearch =
      term.length === 0 ||
      issue.title.toLowerCase().includes(term) ||
      issue.description.toLowerCase().includes(term);

    if (matchesStatus && matchesCategory && matchesSearch) {
      setIssues((prev) => [issue, ...prev.filter((entry) => entry.id !== issue.id)]);
    }
    setCounts((prev) => ({ ...prev, [issue.status]: (prev[issue.status] ?? 0) + 1 }));
    void loadIssues();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">Offene Anliegen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-foreground">{counts.open}</div>
              <p className="text-xs text-muted-foreground">Neu oder noch unbearbeitet.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">In Bearbeitung</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-foreground">{counts.in_progress}</div>
              <p className="text-xs text-muted-foreground">Aktiv in Umsetzung.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">Gelöst</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-foreground">{counts.resolved}</div>
              <p className="text-xs text-muted-foreground">Erledigt, wartet auf Feedback.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">Geschlossen</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-foreground">{counts.closed}</div>
              <p className="text-xs text-muted-foreground">Abgeschlossen und dokumentiert.</p>
            </CardContent>
          </Card>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>Neues Anliegen melden</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Neues Anliegen erfassen</DialogTitle>
              <DialogDescription>
                Beschreibe dein Problem, einen Bug oder Verbesserungsvorschlag für den Mitgliederbereich.
              </DialogDescription>
            </DialogHeader>
            <IssueCreateForm onCreated={handleIssueCreated} onSuccess={() => setCreateOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filter &amp; Suche</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((option) => (
              <Button
                key={option.value}
                variant={statusFilter === option.value ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(option.value)}
              >
                {option.label}
                <span className="ml-2 rounded-full bg-foreground/10 px-2 py-0.5 text-[11px] font-semibold text-foreground/70">
                  {option.count}
                </span>
              </Button>
            ))}
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="md:w-64">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Kategorie
              </label>
              <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as CategoryFilterValue)}>
                <SelectTrigger>
                  <SelectValue placeholder="Kategorie filtern" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Kategorien</SelectItem>
                  {ISSUE_CATEGORY_VALUES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {ISSUE_CATEGORY_LABELS[category]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <form onSubmit={handleSearchSubmit} className="flex flex-1 flex-col gap-2 md:flex-row md:items-center">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Suche
                </label>
                <Input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Titel oder Beschreibung durchsuchen"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" variant="secondary">
                  Anwenden
                </Button>
                <Button type="button" variant="ghost" onClick={handleClearFilters}>
                  Zurücksetzen
                </Button>
              </div>
            </form>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Anliegen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((index) => (
                <div key={index} className="space-y-3 rounded-lg border border-border/40 bg-muted/10 p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 animate-pulse rounded-full bg-muted/40" />
                    <div className="h-5 flex-1 animate-pulse rounded bg-muted/40" />
                  </div>
                  <div className="h-4 w-full animate-pulse rounded bg-muted/30" />
                  <div className="flex gap-2">
                    <div className="h-4 w-24 animate-pulse rounded bg-muted/20" />
                    <div className="h-4 w-32 animate-pulse rounded bg-muted/20" />
                  </div>
                </div>
              ))}
            </div>
          ) : issues.length > 0 ? (
            issues.map((issue) => {
              const shortId = issue.id.slice(0, 8);
              const lastActivity = formatRelativeFromNow(new Date(issue.lastActivityAt));
              const authorName = issue.createdBy?.name || issue.createdBy?.email || null;
              const metaItems = [
                `#${shortId}`,
                STATUS_ICON_MAP[issue.status].label,
                `Aktualisiert ${lastActivity}`,
              ];
              if (authorName) {
                metaItems.push(`Gemeldet von ${authorName}`);
              }

              return (
                <Link
                  key={issue.id}
                  href={`/mitglieder/issues/${issue.id}`}
                  className="group block rounded-lg border border-border/40 bg-background/80 p-4 shadow-sm transition hover:border-foreground/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-muted/60 text-muted-foreground transition group-hover:bg-muted group-hover:text-foreground">
                      <IssueStatusIcon status={issue.status} />
                    </span>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-start gap-2">
                        <h3 className="flex-1 text-lg font-semibold text-foreground transition group-hover:text-primary">
                          {issue.title}
                        </h3>
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                          <MessageSquare aria-hidden className="h-4 w-4" />
                          {issue.commentCount}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-sm text-foreground/80">{issue.description}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {metaItems.map((item, index) => (
                          <span key={item} className="flex items-center gap-2">
                            {index > 0 ? <span aria-hidden>•</span> : null}
                            <span>{item}</span>
                          </span>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1 text-xs">
                        <Badge className={cn("border", ISSUE_STATUS_BADGE_CLASSES[issue.status])}>
                          {ISSUE_STATUS_LABELS[issue.status]}
                        </Badge>
                        <Badge className={cn("border", ISSUE_PRIORITY_BADGE_CLASSES[issue.priority])}>
                          {ISSUE_PRIORITY_LABELS[issue.priority]}
                        </Badge>
                        <Badge className={cn("border", ISSUE_CATEGORY_BADGE_CLASSES[issue.category])}>
                          {ISSUE_CATEGORY_LABELS[issue.category]}
                        </Badge>
                        <Badge className={cn("border", ISSUE_VISIBILITY_BADGE_CLASSES[issue.visibility])}>
                          {ISSUE_VISIBILITY_LABELS[issue.visibility]}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })
          ) : (
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/10 p-6 text-center text-sm text-muted-foreground">
              Keine Anliegen gefunden. Passe die Filter an oder melde ein neues Anliegen.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

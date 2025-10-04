"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { IssueCategory, IssueStatus } from "@/lib/issues";
import { toast } from "sonner";
import { PageHeader } from "@/components/members/page-header";
import type { MembersBreadcrumbItem } from "@/lib/members-breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/typography";
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
  breadcrumbs?: readonly (MembersBreadcrumbItem | null | undefined | false)[] | null;
};

type StatusFilterValue = "all" | IssueStatus;
type CategoryFilterValue = "all" | IssueCategory;

const STATUS_ICON_FALLBACK = {
  icon: CircleDot,
  className: "text-muted-foreground",
  label: "Status unbekannt",
};

const STATUS_ICON_MAP: Record<
  IssueStatus,
  { icon: LucideIcon; className: string; label: string }
> = {
  open: { icon: CircleDot, className: "text-emerald-500", label: ISSUE_STATUS_LABELS.open },
  in_progress: { icon: Loader2, className: "text-sky-500", label: ISSUE_STATUS_LABELS.in_progress },
  resolved: { icon: CheckCircle2, className: "text-emerald-500", label: ISSUE_STATUS_LABELS.resolved },
  closed: { icon: XCircle, className: "text-rose-500", label: ISSUE_STATUS_LABELS.closed },
};

const STATUS_BADGE_FALLBACK_CLASS = "border-muted/50 bg-muted/40 text-muted-foreground";

function getStatusPresentation(status: IssueStatus | string) {
  if (status in STATUS_ICON_MAP) {
    return STATUS_ICON_MAP[status as keyof typeof STATUS_ICON_MAP];
  }
  return STATUS_ICON_FALLBACK;
}

function IssueStatusIcon({ status }: { status: IssueStatus | string }) {
  const config = getStatusPresentation(status);
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

export function IssueOverview({ initialIssues, initialCounts, breadcrumbs }: IssueOverviewProps) {
  const [issues, setIssues] = useState<IssueSummary[]>(initialIssues);
  const [counts, setCounts] = useState<IssueStatusCounts>(normalizeCounts(initialCounts));
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterValue>("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const totalCount = counts.open + counts.in_progress + counts.resolved + counts.closed;
  const numberFormatter = useMemo(() => new Intl.NumberFormat("de-DE"), []);
  const formattedCounts = {
    open: numberFormatter.format(counts.open),
    in_progress: numberFormatter.format(counts.in_progress),
    resolved: numberFormatter.format(counts.resolved),
    closed: numberFormatter.format(counts.closed),
    total: numberFormatter.format(totalCount),
  } as const;

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
    setStatusFilter("all");
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

  const statusSummary = (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline" className="bg-background">
        {formattedCounts.open} offen
      </Badge>
      <Badge variant="secondary" className="border border-border/60 bg-secondary/60 text-secondary-foreground">
        {formattedCounts.total} gesamt
      </Badge>
    </div>
  );

  const overviewItems = [
    {
      key: "open",
      label: "Offene Anliegen",
      value: formattedCounts.open,
      description: "Neu oder noch unbearbeitet.",
    },
    {
      key: "in_progress",
      label: "In Bearbeitung",
      value: formattedCounts.in_progress,
      description: "Aktiv in Umsetzung.",
    },
    {
      key: "resolved",
      label: "Gelöst",
      value: formattedCounts.resolved,
      description: "Erledigt, wartet auf Feedback.",
    },
    {
      key: "closed",
      label: "Geschlossen",
      value: formattedCounts.closed,
      description: "Abgeschlossen und dokumentiert.",
    },
  ] as const;

  return (
    <div className="space-y-6 pb-16">
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <PageHeader
          title="Feedback & Support"
          description="Melde Probleme, Bugs oder Verbesserungsvorschläge und verfolge den Bearbeitungsstand im Mitglieder-Issue-Board."
          breadcrumbs={breadcrumbs}
          actions={
            <DialogTrigger asChild>
              <Button>Neues Anliegen melden</Button>
            </DialogTrigger>
          }
          status={statusSummary}
        />
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Neues Anliegen erfassen</DialogTitle>
            <DialogDescription>
              Beschreibe dein Problem, einen Bug oder einen Verbesserungsvorschlag für den Mitgliederbereich.
            </DialogDescription>
          </DialogHeader>
          <IssueCreateForm onCreated={handleIssueCreated} onSuccess={() => setCreateOpen(false)} />
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle>Aktueller Überblick</CardTitle>
          <Text variant="small" tone="muted">
            Vier Kennzahlen zeigen dir den Status aller gemeldeten Anliegen.
          </Text>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {overviewItems.map((item) => (
              <div
                key={item.key}
                className="space-y-1.5 rounded-lg border border-border/60 bg-muted/20 p-4"
              >
                <dt className="text-sm font-medium text-muted-foreground">{item.label}</dt>
                <dd className="text-2xl font-semibold text-foreground">{item.value}</dd>
                <Text variant="caption" tone="muted">
                  {item.description}
                </Text>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle>Anliegen filtern</CardTitle>
          <Text variant="small" tone="muted">
            Kombiniere Status, Kategorie und Stichworte, um schnell die richtigen Anliegen zu finden.
          </Text>
        </CardHeader>
        <CardContent className="space-y-6">
          <fieldset className="space-y-2">
            <Text variant="caption" tone="muted" className="uppercase tracking-[0.12em]">
              Status
            </Text>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={statusFilter === option.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter(option.value)}
                  aria-pressed={statusFilter === option.value}
                >
                  {option.label}
                  <span className="ml-2 rounded-full bg-foreground/10 px-2 py-0.5 text-[11px] font-semibold text-foreground/70">
                    {numberFormatter.format(option.count)}
                  </span>
                </Button>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="lg:w-64 space-y-2">
              <Label htmlFor="issue-category" className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                Kategorie
              </Label>
              <Select
                value={categoryFilter}
                onValueChange={(value) => setCategoryFilter(value as CategoryFilterValue)}
              >
                <SelectTrigger id="issue-category">
                  <SelectValue placeholder="Kategorie auswählen" />
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

            <form
              onSubmit={handleSearchSubmit}
              className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center"
            >
              <div className="flex-1 space-y-2">
                <Label htmlFor="issue-search" className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  Stichwortsuche
                </Label>
                <Input
                  id="issue-search"
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
        <CardHeader className="space-y-1">
          <CardTitle>Anliegen</CardTitle>
          <Text variant="small" tone="muted">
            Alle Treffer entsprechend deiner Filtereinstellungen.
          </Text>
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
              const statusPresentation = getStatusPresentation(issue.status);
              const statusLabel =
                (ISSUE_STATUS_LABELS as Record<string, string>)[issue.status] ?? statusPresentation.label;
              const statusBadgeClass =
                (ISSUE_STATUS_BADGE_CLASSES as Record<string, string>)[issue.status] ?? STATUS_BADGE_FALLBACK_CLASS;
              const metaItems = [
                `#${shortId}`,
                statusLabel,
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
                        <Badge className={cn("border", statusBadgeClass)}>
                          {statusLabel}
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

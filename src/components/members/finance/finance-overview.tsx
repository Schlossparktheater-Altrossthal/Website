"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import type { VisibilityScope } from "@prisma/client";
import type { FinanceBudgetDTO, FinanceEntryDTO, FinanceSummaryDTO } from "@/app/api/finance/utils";
import { PageHeader } from "@/components/members/page-header";
import { KeyMetricCard, KeyMetricGrid } from "@/design-system/patterns";
import { FinanceEntryForm } from "./finance-entry-form";
import { FinanceEntryTable } from "./finance-entry-table";
import { FinanceBudgetForm } from "./finance-budget-form";
import { FinanceBudgetTable } from "./finance-budget-table";
import { FinanceExportSection } from "./finance-export-section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FINANCE_ENTRY_STATUS_LABELS,
  FINANCE_ENTRY_STATUS_TONES,
} from "@/lib/finance";
import { cn } from "@/lib/utils";

function formatCurrency(amount: number, currency = "EUR") {
  try {
    return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return "—";
  return parsed.toLocaleDateString("de-DE");
}

function sortBudgets(list: FinanceBudgetDTO[]) {
  return [...list].sort((a, b) => {
    const yearA = a.show.year ?? 0;
    const yearB = b.show.year ?? 0;
    if (yearA !== yearB) return yearB - yearA;
    return a.category.localeCompare(b.category, "de");
  });
}

type FinanceOverviewProps = {
  initialEntries: FinanceEntryDTO[];
  initialSummary: FinanceSummaryDTO;
  initialBudgets: FinanceBudgetDTO[];
  showOptions: { id: string; title: string | null; year: number }[];
  memberOptions: { id: string; name: string | null; email: string | null }[];
  canManage: boolean;
  canApprove: boolean;
  canExport: boolean;
  allowedScopes: VisibilityScope[];
  activeSection: "dashboard" | "buchungen" | "budgets" | "export";
  selectedShowId: string;
  activeShow: { id: string; title: string | null; year: number } | null;
};

export function FinanceOverview({
  initialEntries,
  initialSummary,
  initialBudgets,
  showOptions,
  memberOptions,
  canManage,
  canApprove,
  canExport,
  allowedScopes,
  activeSection,
  selectedShowId,
  activeShow,
}: FinanceOverviewProps) {
  const [entries, setEntries] = useState<FinanceEntryDTO[]>(initialEntries);
  const [summary, setSummary] = useState<FinanceSummaryDTO>(initialSummary);
  const [budgets, setBudgets] = useState<FinanceBudgetDTO[]>(sortBudgets(initialBudgets));
  const [showEntryForm, setShowEntryForm] = useState(activeSection === "buchungen");
  const [editingBudget, setEditingBudget] = useState<FinanceBudgetDTO | null>(null);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [currentShowId, setCurrentShowId] = useState<string>(selectedShowId);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    setEntries(initialEntries);
  }, [initialEntries]);

  useEffect(() => {
    setSummary(initialSummary);
  }, [initialSummary]);

  useEffect(() => {
    setBudgets(sortBudgets(initialBudgets));
  }, [initialBudgets]);

  useEffect(() => {
    setShowEntryForm(activeSection === "buchungen");
  }, [activeSection]);

  useEffect(() => {
    setCurrentShowId(selectedShowId);
  }, [selectedShowId]);

  const showQuery = useMemo(() => {
    return currentShowId ? `?showId=${encodeURIComponent(currentShowId)}` : "";
  }, [currentShowId]);

  const handleShowChange = useCallback(
    (value: string) => {
      setCurrentShowId(value);
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("showId", value);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const refreshSummary = useCallback(async () => {
    if (!currentShowId) return;
    setLoadingSummary(true);
    try {
      const response = await fetch(`/api/finance/summary${showQuery}`);
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Übersicht konnte nicht geladen werden");
      if (data?.summary) {
        setSummary(data.summary as FinanceSummaryDTO);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Übersicht konnte nicht geladen werden");
    } finally {
      setLoadingSummary(false);
    }
  }, [currentShowId, showQuery]);

  const refreshBudgets = useCallback(async () => {
    if (!currentShowId) return;
    try {
      const response = await fetch(`/api/finance/budgets${showQuery}`);
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Budgets konnten nicht geladen werden");
      if (data?.budgets) {
        setBudgets(sortBudgets(data.budgets as FinanceBudgetDTO[]));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Budgets konnten nicht geladen werden");
    }
  }, [currentShowId, showQuery]);

  const refreshEntries = useCallback(async () => {
    if (!currentShowId) return;
    setLoadingEntries(true);
    try {
      const response = await fetch(`/api/finance${showQuery}`);
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Buchungen konnten nicht geladen werden");
      if (data?.entries) {
        setEntries(data.entries as FinanceEntryDTO[]);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Buchungen konnten nicht geladen werden");
    } finally {
      setLoadingEntries(false);
    }
  }, [currentShowId, showQuery]);

  const handleEntryCreated = useCallback(
    (entry: FinanceEntryDTO) => {
      setEntries((prev) => [entry, ...prev.filter((existing) => existing.id !== entry.id)]);
      refreshSummary();
      refreshBudgets();
    },
    [refreshSummary, refreshBudgets],
  );

  const handleEntryUpdated = useCallback(
    (entry: FinanceEntryDTO) => {
      setEntries((prev) => prev.map((existing) => (existing.id === entry.id ? entry : existing)));
      refreshSummary();
      refreshBudgets();
    },
    [refreshSummary, refreshBudgets],
  );

  const handleEntryDeleted = useCallback(
    (id: string) => {
      setEntries((prev) => prev.filter((entry) => entry.id !== id));
      refreshSummary();
      refreshBudgets();
    },
    [refreshSummary, refreshBudgets],
  );

  const handleBudgetCreated = useCallback((budget: FinanceBudgetDTO) => {
    setBudgets((prev) => sortBudgets([...prev, budget]));
  }, []);

  const handleBudgetUpdated = useCallback((budget: FinanceBudgetDTO) => {
    setBudgets((prev) => sortBudgets(prev.map((existing) => (existing.id === budget.id ? budget : existing))));
  }, []);

  const handleBudgetDeleted = useCallback((id: string) => {
    setBudgets((prev) => prev.filter((budget) => budget.id !== id));
  }, []);

  const recentEntries = useMemo(() => entries.slice(0, 5), [entries]);
  const net = summary.totalIncome - summary.totalExpense;
  const budgetOptions = budgets;
  const currentShow = useMemo(() => {
    return showOptions.find((show) => show.id === currentShowId) ?? activeShow ?? null;
  }, [activeShow, currentShowId, showOptions]);

  const formattedActiveShow = currentShow
    ? `${currentShow.year} • ${currentShow.title ?? "Unbenannte Produktion"}`
    : "Produktion auswählen";

  const showSwitcher = (
    <Select value={currentShowId} onValueChange={handleShowChange}>
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="Produktion wählen">{formattedActiveShow}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {showOptions.map((show) => (
          <SelectItem key={show.id} value={show.id}>
            {`${show.year} • ${show.title ?? "Unbenannte Produktion"}`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  function renderDashboard() {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Finanzen"
          description="Einnahmen, Ausgaben und offene Rechnungen auf einen Blick."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {showSwitcher}
              {canManage ? (
                <Button asChild variant="secondary">
                  <Link href="/mitglieder/finanzen/buchungen">Neue Buchung</Link>
                </Button>
              ) : null}
              {canManage ? (
                <Button asChild variant="secondary">
                  <Link href="/mitglieder/finanzen/budgets">Budgets verwalten</Link>
                </Button>
              ) : null}
            </div>
          }
        />

        <KeyMetricGrid>
          <KeyMetricCard label="Einnahmen" value={formatCurrency(summary.totalIncome)} tone="positive" hint={loadingSummary ? "Aktualisiere…" : undefined} />
          <KeyMetricCard label="Ausgaben" value={formatCurrency(summary.totalExpense)} tone="destructive" />
          <KeyMetricCard
            label="Saldo"
            value={formatCurrency(net)}
            tone={net >= 0 ? "positive" : "destructive"}
            hint={loadingSummary ? "Aktualisiere…" : undefined}
          />
          <KeyMetricCard
            label="Offene Rechnungen"
            value={summary.pendingInvoices}
            tone={summary.pendingInvoices > 0 ? "warning" : "default"}
            hint={`Volumen ${formatCurrency(summary.pendingAmount)}`}
          />
          <KeyMetricCard label="Spenden" value={formatCurrency(summary.donationTotal)} tone="info" />
        </KeyMetricGrid>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Neueste Buchungen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Buchungen vorhanden.</p>
              ) : (
                recentEntries.map((entry) => (
                  <div key={entry.id} className="flex items-start justify-between gap-3 border-b border-border/40 pb-2 last:border-none last:pb-0">
                    <div className="flex-1">
                      <div className="font-medium text-foreground">{entry.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {entry.show?.title ?? "Allgemein"} · {formatDate(entry.bookingDate)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={cn("text-sm font-semibold", entry.type === "expense" ? "text-destructive" : "text-success")}>{formatCurrency(entry.amount, entry.currency)}</div>
                      <Badge
                        variant={FINANCE_ENTRY_STATUS_TONES[entry.status]}
                        className="mt-1 text-xs"
                      >
                        {FINANCE_ENTRY_STATUS_LABELS[entry.status]}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  function renderEntries() {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Finanzbuchungen"
          description="Erfasse Rechnungen, Spenden und sonstige Buchungen."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {showSwitcher}
              {canManage ? (
                <Button type="button" onClick={() => setShowEntryForm((prev) => !prev)}>
                  {showEntryForm ? "Formular ausblenden" : "Neue Buchung"}
                </Button>
              ) : null}
            </div>
          }
        />

        {canManage ? (
          <Card>
            <CardHeader>
              <CardTitle>Neue Buchung</CardTitle>
            </CardHeader>
            <CardContent>
              {showEntryForm ? (
                <FinanceEntryForm
                  onCreated={handleEntryCreated}
                  showOptions={showOptions}
                  memberOptions={memberOptions}
                  budgetOptions={budgetOptions}
                  allowedScopes={allowedScopes}
                  canApprove={canApprove}
                  defaultShowId={currentShowId}
                  onAfterSubmit={() => setShowEntryForm(false)}
                />
              ) : (
                <p className="text-sm text-muted-foreground">Nutze den Button oben, um das Formular zu öffnen.</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">Du kannst Buchungen einsehen, aber nicht bearbeiten.</p>
        )}

        <FinanceEntryTable
          entries={entries}
          onEntryUpdated={handleEntryUpdated}
          onEntryDeleted={handleEntryDeleted}
          onRefresh={refreshEntries}
          refreshing={loadingEntries}
          canManage={canManage}
          canApprove={canApprove}
        />
      </div>
    );
  }

  function renderBudgets() {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Budgets"
          description="Plane Budgetrahmen pro Produktion und vergleiche sie mit den Ist-Ausgaben."
          actions={<div className="flex flex-wrap items-center gap-2">{showSwitcher}</div>}
        />

        {canManage ? (
          <Card>
            <CardHeader>
              <CardTitle>{editingBudget ? `Budget "${editingBudget.category}" bearbeiten` : "Neues Budget anlegen"}</CardTitle>
            </CardHeader>
            <CardContent>
              <FinanceBudgetForm
                showOptions={showOptions}
                initialBudget={editingBudget}
                onCreated={handleBudgetCreated}
                onUpdated={handleBudgetUpdated}
                onCancelEdit={() => setEditingBudget(null)}
                defaultShowId={currentShowId}
              />
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">Du kannst Budgets einsehen, aber nicht bearbeiten.</p>
        )}

        <FinanceBudgetTable
          budgets={budgets}
          onRequestEdit={(budget) => setEditingBudget(budget)}
          onBudgetDeleted={(id) => {
            handleBudgetDeleted(id);
            refreshSummary();
          }}
          canManage={canManage}
        />
      </div>
    );
  }

  function renderExport() {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Exporte"
          description="Erzeuge CSV-Dateien für Buchungslisten oder weiterführende Auswertungen."
          actions={<div className="flex flex-wrap items-center gap-2">{showSwitcher}</div>}
        />
        {canExport ? (
          <FinanceExportSection showId={currentShowId} />
        ) : (
          <p className="text-sm text-muted-foreground">Für Exporte fehlen die Berechtigungen.</p>
        )}
      </div>
    );
  }

  switch (activeSection) {
    case "buchungen":
      return renderEntries();
    case "budgets":
      return renderBudgets();
    case "export":
      return renderExport();
    case "dashboard":
    default:
      return renderDashboard();
  }
}

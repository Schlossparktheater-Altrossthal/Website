"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { FinanceBudgetDTO } from "@/app/api/finance/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FilterChips,
  FilterChip,
  SwipeActionsList,
  SwipeActionsItem,
} from "@/components/members/templates";
import { cn } from "@/lib/utils";

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

type FinanceBudgetTableProps = {
  budgets: FinanceBudgetDTO[];
  onRequestEdit: (budget: FinanceBudgetDTO) => void;
  onBudgetDeleted: (id: string) => void;
  canManage: boolean;
};

export function FinanceBudgetTable({ budgets, onRequestEdit, onBudgetDeleted, canManage }: FinanceBudgetTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showFilter, setShowFilter] = useState<string>("all");

  const shows = useMemo(() => {
    const unique = new Map<string, { id: string; label: string }>();
    for (const budget of budgets) {
      const showId = budget.show.id ?? "__global";
      const label = budget.show.id
        ? `${budget.show.year ?? "—"} · ${budget.show.title ?? "Unbenannt"}`
        : "Ohne Produktion";
      unique.set(showId, { id: showId, label });
    }
    return Array.from(unique.values());
  }, [budgets]);

  const filteredBudgets = useMemo(() => {
    if (showFilter === "all") return budgets;
    return budgets.filter((budget) => (budget.show.id ?? "__global") === showFilter);
  }, [budgets, showFilter]);

  const totals = useMemo(() => {
    return filteredBudgets.reduce(
      (acc, budget) => {
        acc.planned += budget.plannedAmount;
        acc.actual += budget.actualAmount;
        return acc;
      },
      { planned: 0, actual: 0 },
    );
  }, [filteredBudgets]);

  async function handleDelete(budget: FinanceBudgetDTO) {
    if (!canManage) return;
    if (!window.confirm(`Budget "${budget.category}" löschen?`)) return;
    try {
      setDeletingId(budget.id);
      const response = await fetch(`/api/finance/budgets/${budget.id}`, { method: "DELETE" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Budget konnte nicht gelöscht werden");
      }
      onBudgetDeleted(budget.id);
      toast.success("Budget gelöscht");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Budget konnte nicht gelöscht werden");
    } finally {
      setDeletingId(null);
    }
  }

  if (!budgets.length) {
    return <p className="text-sm text-muted-foreground">Noch keine Budgets angelegt.</p>;
  }

  return (
    <div className="space-y-5">
      <FilterChips label="Produktion">
        <FilterChip active={showFilter === "all"} onClick={() => setShowFilter("all")}>
          Alle Produktionen
        </FilterChip>
        {shows.map((show) => (
          <FilterChip key={show.id} active={showFilter === show.id} onClick={() => setShowFilter(show.id)}>
            {show.label}
          </FilterChip>
        ))}
      </FilterChips>

      <SwipeActionsList>
        {filteredBudgets.map((budget) => {
          const plannedLabel = formatCurrency(budget.plannedAmount, budget.currency);
          const actualLabel = formatCurrency(budget.actualAmount, budget.currency);
          const difference = budget.plannedAmount - budget.actualAmount;
          const diffLabel = formatCurrency(difference, budget.currency);
          const diffClass = difference >= 0 ? "text-success" : "text-destructive";

          return (
            <SwipeActionsItem
              key={budget.id}
              actions={[
                canManage
                  ? {
                      id: `edit-${budget.id}`,
                      label: "Bearbeiten",
                      onSelect: () => onRequestEdit(budget),
                      tone: "primary",
                    }
                  : null,
                canManage
                  ? {
                      id: `delete-${budget.id}`,
                      label: "Löschen",
                      onSelect: () => handleDelete(budget),
                      tone: "destructive",
                      disabled: deletingId === budget.id,
                    }
                  : null,
              ]}
            >
              <article className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1.5">
                    <h3 className="text-lg font-semibold text-foreground">{budget.category}</h3>
                    <p className="text-sm text-muted-foreground">
                      {budget.show.title ?? "Unbenannte Produktion"} · {budget.show.year ?? "—"}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-semibold text-muted-foreground">Plan: {plannedLabel}</div>
                    <div className="font-semibold text-muted-foreground">Ist: {actualLabel}</div>
                    <div className={cn("font-semibold", diffClass)}>{diffLabel}</div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{budget.currency}</Badge>
                  <span className="rounded-full bg-muted/40 px-3 py-1">{budget.entryCount} Buchungen</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {budget.notes ? budget.notes : "Keine Notizen hinterlegt."}
                </div>
                {canManage ? (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => onRequestEdit(budget)}>
                      Bearbeiten
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(budget)}
                      disabled={deletingId === budget.id}
                    >
                      Löschen
                    </Button>
                  </div>
                ) : null}
              </article>
            </SwipeActionsItem>
          );
        })}
      </SwipeActionsList>

      <div className="rounded-2xl border border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground">
        <div className="flex flex-wrap items-center gap-4">
          <span>
            <strong className="font-semibold text-foreground">Gesamtplan:&nbsp;</strong>
            {formatCurrency(totals.planned, filteredBudgets[0]?.currency ?? "EUR")}
          </span>
          <span>
            <strong className="font-semibold text-foreground">Gesamtist:&nbsp;</strong>
            {formatCurrency(totals.actual, filteredBudgets[0]?.currency ?? "EUR")}
          </span>
          <span>
            <strong className="font-semibold text-foreground">Differenz:&nbsp;</strong>
            {formatCurrency(totals.planned - totals.actual, filteredBudgets[0]?.currency ?? "EUR")}
          </span>
        </div>
      </div>
    </div>
  );
}

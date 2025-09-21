"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { FinanceBudgetDTO } from "@/app/api/finance/utils";
import { Button } from "@/components/ui/button";
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

  const totals = useMemo(() => {
    return budgets.reduce(
      (acc, budget) => {
        acc.planned += budget.plannedAmount;
        acc.actual += budget.actualAmount;
        return acc;
      },
      { planned: 0, actual: 0 },
    );
  }, [budgets]);

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
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2 font-medium">Kategorie</th>
            <th className="px-3 py-2 font-medium">Produktion</th>
            <th className="px-3 py-2 font-medium">Plan</th>
            <th className="px-3 py-2 font-medium">Ist</th>
            <th className="px-3 py-2 font-medium">Differenz</th>
            <th className="px-3 py-2 font-medium">Buchungen</th>
            <th className="px-3 py-2 font-medium">Notizen</th>
            {canManage ? <th className="px-3 py-2 font-medium text-right">Aktionen</th> : null}
          </tr>
        </thead>
        <tbody>
          {budgets.map((budget) => {
            const plannedLabel = formatCurrency(budget.plannedAmount, budget.currency);
            const actualLabel = formatCurrency(budget.actualAmount, budget.currency);
            const difference = budget.plannedAmount - budget.actualAmount;
            const diffLabel = formatCurrency(difference, budget.currency);
            const diffClass = difference >= 0 ? "text-success" : "text-destructive";
            return (
              <tr key={budget.id} className="border-b last:border-none hover:bg-accent/10">
                <td className="px-3 py-2 align-top">
                  <div className="font-medium text-foreground">{budget.category}</div>
                  <div className="text-xs text-muted-foreground">{budget.currency}</div>
                </td>
                <td className="px-3 py-2 align-top">
                  {budget.show.title ? (
                    <div>
                      <div className="font-medium">{budget.show.title}</div>
                      <div className="text-xs text-muted-foreground">{budget.show.year ?? ""}</div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-2 align-top text-muted-foreground">{plannedLabel}</td>
                <td className="px-3 py-2 align-top text-muted-foreground">{actualLabel}</td>
                <td className={cn("px-3 py-2 align-top font-medium", diffClass)}>{diffLabel}</td>
                <td className="px-3 py-2 align-top text-muted-foreground">{budget.entryCount}</td>
                <td className="px-3 py-2 align-top text-muted-foreground whitespace-pre-line">{budget.notes ?? "—"}</td>
                {canManage ? (
                  <td className="px-3 py-2 align-top text-right">
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => onRequestEdit(budget)}>
                        Bearbeiten
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(budget)}
                        disabled={deletingId === budget.id}
                      >
                        Löschen
                      </Button>
                    </div>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t bg-muted/30 text-sm font-medium">
            <td className="px-3 py-2">Summe</td>
            <td className="px-3 py-2" />
            <td className="px-3 py-2 text-muted-foreground">{formatCurrency(totals.planned, budgets[0]?.currency ?? "EUR")}</td>
            <td className="px-3 py-2 text-muted-foreground">{formatCurrency(totals.actual, budgets[0]?.currency ?? "EUR")}</td>
            <td className={cn("px-3 py-2", totals.planned - totals.actual >= 0 ? "text-success" : "text-destructive")}
            >
              {formatCurrency(totals.planned - totals.actual, budgets[0]?.currency ?? "EUR")}
            </td>
            <td className="px-3 py-2" />
            <td className="px-3 py-2" />
            {canManage ? <td className="px-3 py-2" /> : null}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

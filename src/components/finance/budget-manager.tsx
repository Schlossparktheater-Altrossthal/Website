"use client";

import { PlusIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { deleteBudgetAction, saveBudgetAction } from "@/app/(members)/mitglieder/finanzen/actions";
import { BudgetBar } from "@/components/finance/budget-bar";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatTile } from "@/components/ui/stat-tile";
import type { PeriodOption } from "@/lib/finance/book";
import type { BudgetView } from "@/lib/finance/budgets";
import { formatCents } from "@/lib/format/money";

type Option = { id: string; name: string };
type Draft = {
  id?: string;
  fundId: string;
  departmentId: string;
  categoryId: string;
  planned: string;
  notes: string;
};

export type BudgetManagerProps = {
  periods: PeriodOption[];
  period: { id: string; name: string };
  budgets: BudgetView[];
  expenseCents: number;
  funds: Option[];
  departments: Option[];
  categories: Option[];
  canManage: boolean;
};

/** Budgets je Zeitraum: Soll gegen Ist (Ausgaben) und offene Auslagen. */
export function BudgetManager(props: BudgetManagerProps) {
  const { budgets, canManage } = props;
  const router = useRouter();
  const pathname = usePathname();
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [busy, setBusy] = React.useState(false);
  const plannedCents = budgets.reduce((sum, budget) => sum + budget.plannedCents, 0);

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    const result = await saveBudgetAction({ ...draft, periodId: props.period.id });
    setBusy(false);
    if (!result.ok) return toast.error(result.error);
    toast.success("Budget gespeichert.");
    setDraft(null);
    router.refresh();
  };

  const remove = async () => {
    if (!draft?.id) return;
    setBusy(true);
    const result = await deleteBudgetAction({ id: draft.id });
    setBusy(false);
    if (!result.ok) return toast.error(result.error);
    toast.success("Budget gelöscht.");
    setDraft(null);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          aria-label="Zeitraum"
          value={props.period.id}
          onChange={(event) =>
            router.push(`${pathname}?tab=budgets&zeitraum=${event.target.value}`)
          }
          className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium"
        >
          {props.periods.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
        {canManage ? (
          <Button
            onClick={() =>
              setDraft({ fundId: "", departmentId: "", categoryId: "", planned: "", notes: "" })
            }
          >
            <PlusIcon className="size-4" aria-hidden /> Budget
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile
          label="Verplant"
          value={formatCents(plannedCents)}
          hint={`${budgets.length} Budgets`}
        />
        <StatTile
          label="Ausgaben gesamt"
          value={formatCents(props.expenseCents)}
          tone="destructive"
        />
        <StatTile
          label="Noch verfügbar"
          value={formatCents(plannedCents - props.expenseCents)}
          hint="Verplant − Ausgaben"
          tone={plannedCents - props.expenseCents < 0 ? "destructive" : "success"}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      {budgets.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {budgets.map((budget) => (
            <Card key={budget.id} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                    {budget.label}
                  </h3>
                  {budget.notes ? (
                    <p className="truncate text-xs text-muted-foreground">{budget.notes}</p>
                  ) : null}
                </div>
                {canManage ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setDraft({
                        id: budget.id,
                        fundId: budget.fund?.id ?? "",
                        departmentId: budget.department?.id ?? "",
                        categoryId: budget.category?.id ?? "",
                        planned: (budget.plannedCents / 100).toFixed(2).replace(".", ","),
                        notes: budget.notes ?? "",
                      })
                    }
                  >
                    Bearbeiten
                  </Button>
                ) : null}
              </div>
              <BudgetBar
                plannedCents={budget.plannedCents}
                spentCents={budget.spentCents}
                openCents={budget.openCents}
              />
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Noch keine Budgets für {props.period.name}. Lege z. B. eines je Gewerk an – die
          Gewerksleitung sieht es dann im Budget-Tab ihres Gewerks.
        </Card>
      )}

      {draft ? (
        <BottomSheet
          open
          onOpenChange={(next) => !next && setDraft(null)}
          title={draft.id ? "Budget bearbeiten" : "Neues Budget"}
          description={`Budget für ${props.period.name}`}
          footer={
            <div className="flex gap-2">
              {draft.id ? (
                <Button variant="outline" className="flex-1" disabled={busy} onClick={remove}>
                  Löschen
                </Button>
              ) : null}
              <Button className="flex-[2]" disabled={busy || !draft.planned.trim()} onClick={save}>
                Speichern
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Leere Felder heißen „alle“. Ein Budget nur mit Gewerk zählt alle Ausgaben des Gewerks.
            </p>
            <div className="space-y-1">
              <Label htmlFor="budget-planned">Betrag</Label>
              <div className="relative">
                <Input
                  id="budget-planned"
                  inputMode="decimal"
                  value={draft.planned}
                  placeholder="0,00"
                  onChange={(event) => setDraft({ ...draft, planned: event.target.value })}
                  className="h-12 pr-9 text-xl font-bold tabular-nums"
                />
                <span className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground">
                  €
                </span>
              </div>
            </div>
            <ScopeSelect
              id="budget-department"
              label="Gewerk"
              value={draft.departmentId}
              options={props.departments}
              onChange={(departmentId) => setDraft({ ...draft, departmentId })}
            />
            <div className="grid grid-cols-2 gap-3">
              <ScopeSelect
                id="budget-category"
                label="Kategorie"
                value={draft.categoryId}
                options={props.categories}
                onChange={(categoryId) => setDraft({ ...draft, categoryId })}
              />
              <ScopeSelect
                id="budget-fund"
                label="Topf"
                value={draft.fundId}
                options={props.funds}
                onChange={(fundId) => setDraft({ ...draft, fundId })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="budget-notes">Notiz</Label>
              <Input
                id="budget-notes"
                value={draft.notes}
                maxLength={200}
                placeholder="z. B. Materialien, Leihen und Reinigung"
                onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
              />
            </div>
          </div>
        </BottomSheet>
      ) : null}
    </div>
  );
}

function ScopeSelect({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">alle</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
}

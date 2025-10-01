"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { FinanceEntryDTO } from "@/app/api/finance/utils";
import {
  FINANCE_ENTRY_KIND_LABELS,
  FINANCE_ENTRY_STATUS_LABELS,
  FINANCE_ENTRY_STATUS_TONES,
  FINANCE_ENTRY_STATUS_VALUES,
  FINANCE_TYPE_LABELS,
} from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

function formatDate(value: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return "—";
  return parsed.toLocaleDateString("de-DE");
}

function getMemberDisplay(entry: FinanceEntryDTO) {
  return entry.memberPaidBy?.name ?? entry.memberPaidBy?.email ?? "—";
}

type FinanceEntryTableProps = {
  entries: FinanceEntryDTO[];
  onEntryUpdated: (entry: FinanceEntryDTO) => void;
  onEntryDeleted: (id: string) => void;
  onRefresh: () => Promise<void> | void;
  refreshing?: boolean;
  canManage: boolean;
  canApprove: boolean;
};

export function FinanceEntryTable({
  entries,
  onEntryUpdated,
  onEntryDeleted,
  onRefresh,
  refreshing = false,
  canManage,
  canApprove,
}: FinanceEntryTableProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredEntries = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (statusFilter !== "all" && entry.status !== statusFilter) return false;
      if (kindFilter !== "all" && entry.kind !== kindFilter) return false;
      if (typeFilter !== "all" && entry.type !== typeFilter) return false;
      if (!normalizedSearch) return true;
      const haystack = [
        entry.title,
        entry.description ?? "",
        entry.invoiceNumber ?? "",
        entry.vendor ?? "",
        entry.donationSource ?? "",
        entry.memberPaidBy?.name ?? "",
        entry.memberPaidBy?.email ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [entries, statusFilter, kindFilter, typeFilter, search]);

  async function handleStatusChange(entry: FinanceEntryDTO, nextStatus: FinanceEntryDTO["status"]) {
    if (entry.status === nextStatus) return;
    try {
      setUpdatingId(entry.id);
      const response = await fetch(`/api/finance/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Status konnte nicht aktualisiert werden");
      }
      onEntryUpdated(data.entry as FinanceEntryDTO);
      toast.success("Status aktualisiert");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Status konnte nicht aktualisiert werden");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleDelete(entry: FinanceEntryDTO) {
    if (!canManage) return;
    if (!window.confirm(`Soll die Buchung "${entry.title}" wirklich gelöscht werden?`)) {
      return;
    }
    try {
      setDeletingId(entry.id);
      const response = await fetch(`/api/finance/${entry.id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Buchung konnte nicht gelöscht werden");
      }
      onEntryDeleted(entry.id);
      toast.success("Buchung gelöscht");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Buchung konnte nicht gelöscht werden");
    } finally {
      setDeletingId(null);
    }
  }

  const totalExpenses = useMemo(
    () => filteredEntries.filter((entry) => entry.type === "expense").reduce((acc, entry) => acc + entry.amount, 0),
    [filteredEntries],
  );
  const totalIncome = useMemo(
    () => filteredEntries.filter((entry) => entry.type === "income").reduce((acc, entry) => acc + entry.amount, 0),
    [filteredEntries],
  );
  const dominantCurrency = filteredEntries[0]?.currency ?? "EUR";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <FilterChips label="Status">
            <FilterChip active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>Alle</FilterChip>
            {FINANCE_ENTRY_STATUS_VALUES.map((status) => (
              <FilterChip key={status} active={statusFilter === status} onClick={() => setStatusFilter(status)}>
                {FINANCE_ENTRY_STATUS_LABELS[status]}
              </FilterChip>
            ))}
          </FilterChips>
          <FilterChips label="Art">
            <FilterChip active={typeFilter === "all"} onClick={() => setTypeFilter("all")}>Alle</FilterChip>
            {(
              [
                { value: "income", label: FINANCE_TYPE_LABELS.income },
                { value: "expense", label: FINANCE_TYPE_LABELS.expense },
              ] as const
            ).map((option) => (
              <FilterChip
                key={option.value}
                active={typeFilter === option.value}
                onClick={() => setTypeFilter(option.value)}
              >
                {option.label}
              </FilterChip>
            ))}
          </FilterChips>
          <FilterChips label="Kategorie">
            <FilterChip active={kindFilter === "all"} onClick={() => setKindFilter("all")}>Alle</FilterChip>
            {Object.entries(FINANCE_ENTRY_KIND_LABELS).map(([value, label]) => (
              <FilterChip key={value} active={kindFilter === value} onClick={() => setKindFilter(value)}>
                {label}
              </FilterChip>
            ))}
          </FilterChips>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Suche nach Titel, Lieferant oder Person"
            className="w-full sm:max-w-xs"
          />
          <Button variant="outline" onClick={() => onRefresh()} disabled={refreshing} className="sm:w-auto">
            Aktualisieren
          </Button>
        </div>
      </div>

      {filteredEntries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
          Keine Buchungen gefunden. Passe die Filter an oder lege eine neue Buchung an.
        </div>
      ) : (
        <>
          <SwipeActionsList>
            {filteredEntries.map((entry) => {
              const statusTone = FINANCE_ENTRY_STATUS_TONES[entry.status];
              return (
                <SwipeActionsItem
                  key={entry.id}
                  actions={[
                    canManage
                      ? {
                          id: `delete-${entry.id}`,
                          label: "Löschen",
                          onSelect: () => handleDelete(entry),
                          tone: "destructive",
                          disabled: deletingId === entry.id,
                        }
                      : null,
                    {
                      id: `refresh-${entry.id}`,
                      label: "Aktualisieren",
                      onSelect: () => onRefresh(),
                    },
                  ]}
                >
                  <article className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1.5">
                        <h3 className="text-lg font-semibold leading-tight text-foreground">{entry.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {entry.vendor ?? entry.donationSource ?? entry.show?.title ?? "Allgemein"}
                          {entry.invoiceNumber ? ` · Beleg ${entry.invoiceNumber}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2 text-right">
                        <span
                          className={cn(
                            "text-base font-semibold",
                            entry.type === "expense" ? "text-destructive" : "text-success",
                          )}
                        >
                          {formatCurrency(entry.amount, entry.currency)}
                        </span>
                        <Badge variant={statusTone}>{FINANCE_ENTRY_STATUS_LABELS[entry.status]}</Badge>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full bg-muted/40 px-3 py-1">
                        {FINANCE_TYPE_LABELS[entry.type]}
                      </span>
                      <span className="rounded-full bg-muted/40 px-3 py-1">
                        {FINANCE_ENTRY_KIND_LABELS[entry.kind]}
                      </span>
                      <span className="rounded-full bg-muted/40 px-3 py-1">
                        Buchungsdatum {formatDate(entry.bookingDate)}
                      </span>
                      <span className="rounded-full bg-muted/40 px-3 py-1">Zuständig: {getMemberDisplay(entry)}</span>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm text-muted-foreground">
                        {entry.description ? entry.description : "Keine zusätzliche Beschreibung vorhanden."}
                      </div>
                      <Select
                        value={entry.status}
                        onValueChange={(value) => handleStatusChange(entry, value as FinanceEntryDTO["status"])}
                        disabled={updatingId === entry.id || (!canApprove && entry.status === "approved")}
                      >
                        <SelectTrigger className="sm:w-[200px]">
                          <SelectValue placeholder="Status ändern" />
                        </SelectTrigger>
                        <SelectContent align="end">
                          {FINANCE_ENTRY_STATUS_VALUES.map((status) => (
                            <SelectItem key={status} value={status}>
                              {FINANCE_ENTRY_STATUS_LABELS[status]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </article>
                </SwipeActionsItem>
              );
            })}
          </SwipeActionsList>

          <div className="rounded-2xl border border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground">
            <div className="flex flex-wrap items-center gap-4">
              <span>
                <strong className="font-semibold text-foreground">Einnahmen:&nbsp;</strong>
                {formatCurrency(totalIncome, dominantCurrency)}
              </span>
              <span>
                <strong className="font-semibold text-foreground">Ausgaben:&nbsp;</strong>
                {formatCurrency(totalExpenses, dominantCurrency)}
              </span>
              <span>
                <strong className="font-semibold text-foreground">Saldo:&nbsp;</strong>
                {formatCurrency(totalIncome - totalExpenses, dominantCurrency)}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

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
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              {FINANCE_ENTRY_STATUS_VALUES.map((status) => (
                <SelectItem key={status} value={status}>
                  {FINANCE_ENTRY_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={kindFilter} onValueChange={setKindFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Typ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Typen</SelectItem>
              {Object.entries(FINANCE_ENTRY_KIND_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Art" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Einnahmen & Ausgaben</SelectItem>
              {(["expense", "income"] as const).map((option) => (
                <SelectItem key={option} value={option}>
                  {FINANCE_TYPE_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Suche nach Titel, Lieferant oder Spender"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full min-w-[220px] md:w-64"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground">
            {filteredEntries.length} von {entries.length} Buchungen · Ausgaben {formatCurrency(totalExpenses, dominantCurrency)} · Einnahmen {formatCurrency(totalIncome, dominantCurrency)}
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? "Aktualisiere…" : "Aktualisieren"}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-medium">Titel</th>
              <th className="px-3 py-2 font-medium">Betrag</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Produktion</th>
              <th className="px-3 py-2 font-medium">Budget</th>
              <th className="px-3 py-2 font-medium">Buchungsdatum</th>
              <th className="px-3 py-2 font-medium">Fälligkeit</th>
              <th className="px-3 py-2 font-medium">Mitglied</th>
              <th className="px-3 py-2 font-medium">Anhänge</th>
              {canManage ? <th className="px-3 py-2 font-medium text-right">Aktionen</th> : null}
            </tr>
          </thead>
          <tbody>
            {filteredEntries.map((entry) => {
              const amountLabel = formatCurrency(entry.amount, entry.currency);
              const attachments = entry.attachments;
              return (
                <tr key={entry.id} className="border-b last:border-none hover:bg-accent/10">
                  <td className="max-w-[240px] px-3 py-2 align-top">
                    <div className="font-medium text-foreground">{entry.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {FINANCE_ENTRY_KIND_LABELS[entry.kind]} · {FINANCE_TYPE_LABELS[entry.type]}
                    </div>
                    {entry.description ? (
                      <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{entry.description}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className={cn("font-semibold", entry.type === "expense" ? "text-destructive" : "text-success")}>{amountLabel}</div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <Badge variant={FINANCE_ENTRY_STATUS_TONES[entry.status]} className="text-xs">
                      {FINANCE_ENTRY_STATUS_LABELS[entry.status]}
                    </Badge>
                    {canManage ? (
                      <div className="mt-1">
                        <Select
                          value={entry.status}
                          onValueChange={(value) => handleStatusChange(entry, value as FinanceEntryDTO["status"])}
                          disabled={updatingId === entry.id || (!canApprove && (entry.status === "approved" || entry.status === "paid"))}
                        >
                          <SelectTrigger className="h-8 w-full text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FINANCE_ENTRY_STATUS_VALUES.map((status) => (
                              <SelectItem key={status} value={status} disabled={!canApprove && (status === "approved" || status === "paid")}> 
                                {FINANCE_ENTRY_STATUS_LABELS[status]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {entry.show ? (
                      <div>
                        <div className="font-medium">{entry.show.title ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{entry.show.year ?? ""}</div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {entry.budget ? (
                      <div>
                        <div className="font-medium">{entry.budget.category}</div>
                        {entry.budget.show.title ? (
                          <div className="text-xs text-muted-foreground">{entry.budget.show.title}</div>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top text-muted-foreground">{formatDate(entry.bookingDate)}</td>
                  <td className="px-3 py-2 align-top text-muted-foreground">{formatDate(entry.dueDate)}</td>
                  <td className="px-3 py-2 align-top">{getMemberDisplay(entry)}</td>
                  <td className="px-3 py-2 align-top">
                    {attachments.length ? (
                      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                        {attachments.map((attachment) => (
                          <span key={attachment.id} className="truncate">
                            {attachment.url ? (
                              <a
                                href={attachment.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary underline-offset-2 hover:underline"
                              >
                                {attachment.filename}
                              </a>
                            ) : (
                              attachment.filename
                            )}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  {canManage ? (
                    <td className="px-3 py-2 align-top text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(entry)}
                        disabled={deletingId === entry.id}
                      >
                        Löschen
                      </Button>
                    </td>
                  ) : null}
                </tr>
              );
            })}
            {filteredEntries.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-sm text-muted-foreground" colSpan={canManage ? 10 : 9}>
                  Keine Buchungen gefunden.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

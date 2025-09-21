"use client";

import { useMemo, useState } from "react";
import {
  FINANCE_EXPORT_FILENAME,
  FINANCE_ENTRY_KIND_LABELS,
  FINANCE_ENTRY_KIND_VALUES,
  FINANCE_ENTRY_STATUS_LABELS,
  FINANCE_ENTRY_STATUS_VALUES,
  FINANCE_TYPE_LABELS,
} from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export function FinanceExportSection() {
  const [status, setStatus] = useState<string>("all");
  const [kind, setKind] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [downloading, setDownloading] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (kind !== "all") params.set("kind", kind);
    if (type !== "all") params.set("type", type);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return params.toString();
  }, [status, kind, type, from, to]);

  const downloadUrl = query ? `/api/finance/export?${query}` : "/api/finance/export";

  async function handleDownload() {
    setDownloading(true);
    try {
      const response = await fetch(downloadUrl, { method: "GET" });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Export fehlgeschlagen");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = FINANCE_EXPORT_FILENAME;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Export fehlgeschlagen");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {FINANCE_ENTRY_STATUS_VALUES.map((value) => (
              <SelectItem key={value} value={value}>
                {FINANCE_ENTRY_STATUS_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger>
            <SelectValue placeholder="Typ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Buchungstypen</SelectItem>
            {FINANCE_ENTRY_KIND_VALUES.map((value) => (
              <SelectItem key={value} value={value}>
                {FINANCE_ENTRY_KIND_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger>
            <SelectValue placeholder="Art" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Einnahmen & Ausgaben</SelectItem>
            {(["expense", "income"] as const).map((value) => (
              <SelectItem key={value} value={value}>
                {FINANCE_TYPE_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} placeholder="Von" />
        <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} placeholder="Bis" />
      </div>
      <div>
        <Button type="button" onClick={handleDownload} disabled={downloading}>
          {downloading ? "Export wird erstellt…" : "CSV-Export herunterladen"}
        </Button>
      </div>
    </div>
  );
}

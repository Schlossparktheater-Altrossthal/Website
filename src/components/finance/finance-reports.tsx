"use client";

import { DownloadIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import type { PeriodOption } from "@/lib/finance/book";
import type { ReportGroup } from "@/lib/finance/report";
import { formatCents } from "@/lib/format/money";

type Option = { id: string; name: string };

export type FinanceReportsProps = {
  periods: PeriodOption[];
  period: { id: string; name: string };
  funds: Option[];
  fundId: string | null;
  totals: { incomeCents: number; expenseCents: number; balanceCents: number };
  byCategory: ReportGroup[];
  byDepartment: ReportGroup[];
  donationCount: number;
  entryCount: number;
  receiptCount: number;
};

/** Berichte je Zeitraum und Topf: Übersicht nach Kategorie/Gewerk, Downloads CSV/PDF/Belege. */
export function FinanceReports(props: FinanceReportsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const go = (zeitraum: string, topf: string | null) =>
    router.push(`${pathname}?tab=berichte&zeitraum=${zeitraum}${topf ? `&topf=${topf}` : ""}`);
  const query = `zeitraum=${props.period.id}${props.fundId ? `&topf=${props.fundId}` : ""}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Zeitraum"
          value={props.period.id}
          onChange={(event) => go(event.target.value, props.fundId)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm font-medium"
        >
          {props.periods.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Topf"
          value={props.fundId ?? ""}
          onChange={(event) => go(props.period.id, event.target.value || null)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Alle Töpfe</option>
          {props.funds.map((fund) => (
            <option key={fund.id} value={fund.id}>
              {fund.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile label="Einnahmen" value={formatCents(props.totals.incomeCents)} tone="success" />
        <StatTile
          label="Ausgaben"
          value={formatCents(props.totals.expenseCents)}
          tone="destructive"
        />
        <StatTile
          label={props.fundId ? "Saldo Topf" : "Ergebnis"}
          value={formatCents(props.totals.balanceCents)}
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <Card className="space-y-3 p-4">
        <h3 className="text-sm font-semibold">Herunterladen</h3>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <a href={`/api/finanzen/export?${query}&format=pdf`}>
              <DownloadIcon className="size-4" aria-hidden /> Kassenbericht (PDF)
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={`/api/finanzen/export?${query}&format=csv`}>
              <DownloadIcon className="size-4" aria-hidden /> Kassenbuch (CSV)
            </a>
          </Button>
          {props.receiptCount ? (
            <Button asChild variant="outline">
              <a href={`/api/finanzen/export?${query}&format=zip`}>
                <DownloadIcon className="size-4" aria-hidden /> Belege (ZIP, {props.receiptCount})
              </a>
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          {props.entryCount} Buchungen
          {props.donationCount
            ? ` · ${props.donationCount} Spenden (im PDF als Liste für Zuwendungsbestätigungen)`
            : ""}
          . CSV öffnet in Excel und LibreOffice.
        </p>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <GroupTable title="Nach Kategorie" groups={props.byCategory} />
        <GroupTable title="Nach Gewerk" groups={props.byDepartment} />
      </div>
    </div>
  );
}

function GroupTable({ title, groups }: { title: string; groups: ReportGroup[] }) {
  return (
    <Card className="p-4">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {groups.length ? (
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="py-1 text-left font-medium" />
              <th className="py-1 text-right font-medium">Einnahmen</th>
              <th className="py-1 text-right font-medium">Ausgaben</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr key={group.label} className="border-t">
                <td className="py-1.5 pr-2">{group.label}</td>
                <td className="py-1.5 text-right text-success tabular-nums">
                  {group.incomeCents ? formatCents(group.incomeCents) : "—"}
                </td>
                <td className="py-1.5 text-right text-destructive tabular-nums">
                  {group.expenseCents ? formatCents(group.expenseCents) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-muted-foreground">Noch keine Buchungen.</p>
      )}
    </Card>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Gauge, MousePointerClick, Timer, Zap } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatTile, type StatTileTone } from "@/components/ui/stat-tile";
import type {
  PerformanceSampleKind,
  PerformanceSummary,
} from "@/lib/analytics/performance-samples";
import { cn } from "@/lib/utils";

type Grouping = "routes" | "devices" | "browsers";

const decimalFormat = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });
const numberFormat = new Intl.NumberFormat("de-DE");

function formatMs(ms: number | null) {
  if (ms === null) return "–";
  return ms >= 1000 ? `${decimalFormat.format(ms / 1000)} s` : `${Math.round(ms)} ms`;
}

// Grenzen angelehnt an die Web-Vitals-Empfehlungen (LCP gut < 2,5 s); Seitenwechsel sollen
// sich unter einer Sekunde anfühlen.
function toneFor(ms: number | null, kind: PerformanceSampleKind): StatTileTone {
  if (ms === null) return "neutral";
  const [good, poor] = kind === "load" ? [2500, 4000] : [1000, 2500];
  if (ms <= good) return "success";
  if (ms <= poor) return "warning";
  return "destructive";
}

const TONE_TEXT: Record<StatTileTone, string> = {
  neutral: "text-foreground",
  primary: "text-primary",
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
};

export function PerformanceSection({ summary }: { summary: PerformanceSummary }) {
  const [kind, setKind] = useState<PerformanceSampleKind>("navigation");
  const [grouping, setGrouping] = useState<Grouping>("routes");

  const rows = useMemo(
    () => summary[grouping].filter((group) => group.kind === kind),
    [summary, grouping, kind],
  );

  if (summary.total === 0) {
    return (
      <Card className="border border-border/70">
        <CardHeader>
          <CardTitle>Ladezeiten</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Noch keine Messungen. Ladezeiten werden ab jetzt beim Benutzen des Mitgliederbereichs im
          Browser gemessen und hier ausgewertet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Seitenwechsel (75 %)"
          value={formatMs(summary.navigation.p75)}
          hint={`Median ${formatMs(summary.navigation.p50)} · ${numberFormat.format(summary.navigation.count)} Messungen`}
          icon={<MousePointerClick className="h-4 w-4" />}
          tone={toneFor(summary.navigation.p75, "navigation")}
        />
        <StatTile
          label="Erste Reaktion (75 %)"
          value={formatMs(summary.navigation.feedbackP75)}
          hint="Klick bis Ladeanzeige/neue Adresse"
          icon={<Zap className="h-4 w-4" />}
          tone={toneFor(summary.navigation.feedbackP75, "navigation")}
        />
        <StatTile
          label="Erstaufruf (75 %)"
          value={formatMs(summary.load.p75)}
          hint={`TTFB ${formatMs(summary.load.ttfbP75)} · LCP ${formatMs(summary.load.lcpP75)}`}
          icon={<Timer className="h-4 w-4" />}
          tone={toneFor(summary.load.p75, "load")}
        />
        <StatTile
          label="Reaktion auf Eingaben (INP)"
          value={formatMs(summary.load.inpP75)}
          hint="75 % der Seitenbesuche"
          icon={<Gauge className="h-4 w-4" />}
          tone={
            summary.load.inpP75 === null
              ? "neutral"
              : summary.load.inpP75 <= 200
                ? "success"
                : summary.load.inpP75 <= 500
                  ? "warning"
                  : "destructive"
          }
        />
      </div>

      <Card className="border border-border/70">
        <CardHeader className="space-y-3">
          <div>
            <CardTitle>Ladezeiten aus echten Besuchen</CardTitle>
            <p className="text-sm text-muted-foreground">
              Gemessen im Browser der Mitglieder, letzte {summary.days} Tage. „Fertig“ heißt: Inhalt
              steht, kein Ladeskelett mehr. 75 % / 95 %: so schnell waren drei Viertel bzw. fast
              alle Aufrufe.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SegmentedControl
              aria-label="Art der Messung"
              value={kind}
              onValueChange={setKind}
              options={[
                { value: "navigation", label: "Seitenwechsel" },
                { value: "load", label: "Erstaufruf" },
              ]}
            />
            <SegmentedControl
              aria-label="Gruppierung"
              value={grouping}
              onValueChange={setGrouping}
              options={[
                { value: "routes", label: "Seiten" },
                { value: "devices", label: "Geräte" },
                { value: "browsers", label: "Browser" },
              ]}
            />
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Messungen dieser Art.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">
                      {grouping === "routes"
                        ? "Seite"
                        : grouping === "devices"
                          ? "Gerät"
                          : "Browser"}
                    </th>
                    <th className="hidden px-3 py-2 text-right sm:table-cell">Anzahl</th>
                    <th className="hidden px-3 py-2 text-right sm:table-cell">Median</th>
                    <th className="px-3 py-2 text-right">75 %</th>
                    <th className="hidden px-3 py-2 text-right sm:table-cell">95 %</th>
                    {kind === "navigation" ? (
                      <th className="hidden px-3 py-2 text-right sm:table-cell">Reaktion 75 %</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row) => (
                    <tr key={row.key} className="bg-background/60">
                      <td className="max-w-[14rem] px-3 py-2 font-medium text-foreground sm:max-w-none">
                        <span className="block truncate">
                          {grouping === "routes"
                            ? row.key.replace(/^\/mitglieder/, "") || "/"
                            : row.key}
                        </span>
                        <span className="block text-xs font-normal text-muted-foreground sm:hidden">
                          {numberFormat.format(row.count)} Messungen · Median {formatMs(row.p50)}
                        </span>
                      </td>
                      <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">
                        {numberFormat.format(row.count)}
                      </td>
                      <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">
                        {formatMs(row.p50)}
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right font-semibold tabular-nums",
                          TONE_TEXT[toneFor(row.p75, kind)],
                        )}
                      >
                        {formatMs(row.p75)}
                      </td>
                      <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">
                        {formatMs(row.p95)}
                      </td>
                      {kind === "navigation" ? (
                        <td className="hidden px-3 py-2 text-right tabular-nums sm:table-cell">
                          {formatMs(row.feedbackP75)}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Gauge, MousePointerClick, Server, Timer } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { StatTile } from "@/components/ui/stat-tile";
import type {
  PerformanceSampleKind,
  PerformanceSummary,
} from "@/lib/analytics/performance-samples";
import { cn } from "@/lib/utils";

import { formatMs, loadTone, numberFormat, shortRoute, TONE_TEXT } from "./statistics-format";

type Grouping = "routes" | "devices" | "browsers";

const GROUP_LABEL: Record<Grouping, string> = {
  routes: "Seite",
  devices: "Gerät",
  browsers: "Browser",
};

function inpTone(ms: number | null) {
  if (ms === null) return "neutral" as const;
  if (ms <= 200) return "success" as const;
  return ms <= 500 ? ("warning" as const) : ("destructive" as const);
}

export function PerformanceSection({ summary }: { summary: PerformanceSummary }) {
  const [kind, setKind] = useState<PerformanceSampleKind>("navigation");
  const [grouping, setGrouping] = useState<Grouping>("routes");

  const rows = useMemo(
    () => summary[grouping].filter((group) => group.kind === kind),
    [summary, grouping, kind],
  );
  const isNavigation = kind === "navigation";
  const { navigation, load } = summary;

  if (summary.total === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Noch keine Messungen. Ladezeiten werden beim Benutzen des Mitgliederbereichs im Browser
        gemessen und erscheinen hier, sobald Mitglieder Seiten aufrufen.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Seitenwechsel (75 %)"
          value={formatMs(navigation.p75)}
          hint={`Reaktion ${formatMs(navigation.feedbackP75)} · ${numberFormat.format(navigation.count)}×`}
          icon={<MousePointerClick />}
          tone={loadTone(navigation.p75, "navigation")}
        />
        <StatTile
          label="davon Server + Netz"
          value={formatMs(navigation.serverP75)}
          hint={
            navigation.requestsMedian === null
              ? "noch keine Daten"
              : `${numberFormat.format(navigation.requestsMedian)} Anfragen je Wechsel`
          }
          icon={<Server />}
          tone="info"
        />
        <StatTile
          label="Erstaufruf (75 %)"
          value={formatMs(load.p75)}
          hint={`TTFB ${formatMs(load.ttfbP75)} · LCP ${formatMs(load.lcpP75)}`}
          icon={<Timer />}
          tone={loadTone(load.p75, "load")}
        />
        <StatTile
          label="Reaktion auf Eingaben"
          value={formatMs(load.inpP75)}
          hint="INP, 75 % der Besuche"
          icon={<Gauge />}
          tone={inpTone(load.inpP75)}
        />
      </div>

      <Card className="border border-border/70">
        <CardHeader className="space-y-3 pb-2">
          <div className="flex flex-wrap items-center gap-2">
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
          <p className="text-xs text-muted-foreground">
            Gemessen bis der Inhalt steht (kein Ladeskelett mehr). 75 % / 95 %: so schnell waren
            drei Viertel bzw. fast alle Aufrufe.
            {isNavigation
              ? " Server = Anfrage der Zielseite inkl. Netz, der Rest entfällt auf das Gerät."
              : ""}
          </p>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Keine Messungen dieser Art.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-3 text-left font-medium">{GROUP_LABEL[grouping]}</th>
                    <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">
                      Anzahl
                    </th>
                    <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">
                      Median
                    </th>
                    <th className="px-2 py-2 text-right font-medium">75 %</th>
                    <th className="hidden px-2 py-2 text-right font-medium md:table-cell">95 %</th>
                    {isNavigation ? (
                      <>
                        <th className="hidden px-2 py-2 text-right font-medium sm:table-cell">
                          Server
                        </th>
                        <th className="hidden px-2 py-2 text-right font-medium lg:table-cell">
                          Anfragen
                        </th>
                      </>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key} className="border-b border-border/50 last:border-0">
                      <td className="max-w-[13rem] py-2 pr-3 sm:max-w-none">
                        <span className="block truncate font-medium">
                          {grouping === "routes" ? shortRoute(row.key) : row.key}
                        </span>
                        <span className="block text-xs text-muted-foreground sm:hidden">
                          {numberFormat.format(row.count)}× · Median {formatMs(row.p50)}
                          {isNavigation ? ` · Server ${formatMs(row.serverP75)}` : ""}
                        </span>
                      </td>
                      <td className="hidden px-2 py-2 text-right tabular-nums sm:table-cell">
                        {numberFormat.format(row.count)}
                      </td>
                      <td className="hidden px-2 py-2 text-right tabular-nums sm:table-cell">
                        {formatMs(row.p50)}
                      </td>
                      <td
                        className={cn(
                          "px-2 py-2 text-right font-semibold tabular-nums",
                          TONE_TEXT[loadTone(row.p75, kind)],
                        )}
                      >
                        {formatMs(row.p75)}
                      </td>
                      <td className="hidden px-2 py-2 text-right tabular-nums md:table-cell">
                        {formatMs(row.p95)}
                      </td>
                      {isNavigation ? (
                        <>
                          <td className="hidden px-2 py-2 text-right tabular-nums sm:table-cell">
                            {formatMs(row.serverP75)}
                          </td>
                          <td className="hidden px-2 py-2 text-right tabular-nums lg:table-cell">
                            {row.requestsMedian ?? "–"}
                          </td>
                        </>
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

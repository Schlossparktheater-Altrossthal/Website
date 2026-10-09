"use client";

import { useMemo, useState } from "react";
import { Gauge, MousePointerClick, Server, Timer } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatTile } from "@/components/ui/stat-tile";
import type {
  PerformanceGrouping,
  PerformanceSampleKind,
  PerformanceSummary,
} from "@/lib/analytics/performance-samples";
import { cn } from "@/lib/utils";

import {
  formatMs,
  formatWeekday,
  loadTone,
  numberFormat,
  percentFormat,
  shortRoute,
  TONE_TEXT,
} from "./statistics-format";

const GROUP_LABEL: Record<PerformanceGrouping, string> = {
  routes: "Seite",
  devices: "Gerät",
  browsers: "Browser + Version",
  viewports: "Fensterbreite",
  aspects: "Seitenverhältnis",
  releases: "Version (Build)",
  targets: "Seite · Element",
};

const ROW_LIMIT = 15;

const KIND_LABEL: Record<PerformanceSampleKind, string> = {
  navigation: "Seitenwechsel",
  load: "Erstaufruf",
  interaction: "Eingaben",
};

const tooltipStyle = {
  backgroundColor: "var(--popover)",
  color: "var(--popover-foreground)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
};

function formatDay(date: string) {
  const [, month, day] = date.split("-");
  return `${day}.${month}.`;
}

function inpTone(ms: number | null) {
  if (ms === null) return "neutral" as const;
  if (ms <= 200) return "success" as const;
  return ms <= 500 ? ("warning" as const) : ("destructive" as const);
}

export function PerformanceSection({ summary }: { summary: PerformanceSummary }) {
  const [kind, setKind] = useState<PerformanceSampleKind>("navigation");
  const [grouping, setGrouping] = useState<PerformanceGrouping>("routes");
  const [showAll, setShowAll] = useState(false);

  const effectiveGrouping: PerformanceGrouping =
    grouping === "targets" && kind !== "interaction" ? "routes" : grouping;
  const rows = useMemo(
    () => summary.groups[effectiveGrouping].filter((group) => group.kind === kind),
    [summary, effectiveGrouping, kind],
  );
  const isNavigation = kind === "navigation";
  const { navigation, load, interaction } = summary;
  const groupingOptions = (Object.keys(GROUP_LABEL) as PerformanceGrouping[]).filter(
    (key) => key !== "targets" || kind === "interaction",
  );

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
          hint={`INP, 75 % · ${numberFormat.format(interaction.count)} langsame Eingaben`}
          icon={<Gauge />}
          tone={inpTone(load.inpP75)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Verteilung · {KIND_LABEL[kind]}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 w-full" role="img" aria-label={`Verteilung ${KIND_LABEL[kind]}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={summary.histograms[kind]}
                  margin={{ top: 4, right: 4, bottom: 0, left: -24 }}
                >
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
                  <XAxis
                    dataKey="label"
                    stroke="var(--muted-foreground)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    allowDecimals={false}
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                    formatter={(value) => [numberFormat.format(Number(value)), "Messungen"]}
                  />
                  <Bar
                    dataKey="count"
                    fill="var(--chart-1)"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Verlauf · 75 % je Tag</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 w-full" role="img" aria-label="Ladezeiten je Tag">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={summary.daily} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
                  <XAxis
                    dataKey="day"
                    tickFormatter={formatDay}
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={16}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => formatMs(Number(value))}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelFormatter={(label) => formatWeekday(String(label))}
                    formatter={(value, name) => [
                      formatMs(value == null ? null : Number(value)),
                      KIND_LABEL[name as PerformanceSampleKind] ?? String(name),
                    ]}
                  />
                  <Legend
                    formatter={(value) => KIND_LABEL[value as PerformanceSampleKind] ?? value}
                    wrapperStyle={{ fontSize: 12 }}
                  />
                  <Line
                    dataKey="navigation"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                  <Line
                    dataKey="load"
                    stroke="var(--chart-2)"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                  <Line
                    dataKey="interaction"
                    stroke="var(--chart-3)"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border/70">
        <CardHeader className="space-y-3 pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              aria-label="Art der Messung"
              value={kind}
              onValueChange={setKind}
              options={(Object.keys(KIND_LABEL) as PerformanceSampleKind[]).map((value) => ({
                value,
                label: KIND_LABEL[value],
              }))}
            />
            <Select
              value={effectiveGrouping}
              onValueChange={(value) => setGrouping(value as PerformanceGrouping)}
            >
              <SelectTrigger className="h-9 w-auto min-w-[11rem]" aria-label="Gruppierung">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {groupingOptions.map((key) => (
                  <SelectItem key={key} value={key}>
                    nach {GROUP_LABEL[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            {kind === "interaction"
              ? "Einzelne Klicks/Eingaben, bei denen die Seite länger als 200 ms nicht reagiert hat (Dauer bis zum nächsten Bild)."
              : "Gemessen bis der Inhalt steht (kein Ladeskelett mehr)."}{" "}
            75 % / 95 %: so schnell waren drei Viertel bzw. fast alle.
            {isNavigation
              ? " Server = Anfrage der Zielseite inkl. Netz, der Rest entfällt auf das Gerät. Vorab = ohne eigene Anfrage (vorab geladen/zwischengespeichert)."
              : ""}
            {["viewports", "aspects"].includes(effectiveGrouping) &&
            summary.withDeviceInfo < summary.total
              ? ` Bildschirmdaten gibt es erst für ${numberFormat.format(summary.withDeviceInfo)} von ${numberFormat.format(summary.total)} Messungen.`
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
                    <th className="py-2 pr-3 text-left font-medium">
                      {GROUP_LABEL[effectiveGrouping]}
                    </th>
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
                          Vorab
                        </th>
                      </>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {(showAll ? rows : rows.slice(0, ROW_LIMIT)).map((row) => (
                    <tr key={row.key} className="border-b border-border/50 last:border-0">
                      <td className="max-w-[13rem] py-2 pr-3 sm:max-w-none">
                        <span className="block truncate font-medium">
                          {effectiveGrouping === "routes" ? shortRoute(row.key) : row.key}
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
                            {row.cachedShare === null ? "–" : percentFormat.format(row.cachedShare)}
                          </td>
                        </>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > ROW_LIMIT ? (
                <button
                  type="button"
                  onClick={() => setShowAll((value) => !value)}
                  className="mt-3 text-sm font-medium text-primary hover:underline"
                >
                  {showAll
                    ? "Weniger anzeigen"
                    : `Alle ${numberFormat.format(rows.length)} anzeigen`}
                </button>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

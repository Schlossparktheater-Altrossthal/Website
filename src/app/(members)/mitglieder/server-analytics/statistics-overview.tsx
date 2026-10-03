"use client";

import { useMemo, useState } from "react";
import { ArrowDown, MousePointerClick, Smartphone, Users, Waypoints } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";
import type { MemberStatistics } from "@/lib/analytics/statistics";
import { cn } from "@/lib/utils";

import {
  formatChange,
  formatDuration,
  formatMs,
  formatWeekday,
  loadTone,
  numberFormat,
  percentFormat,
  shortRoute,
  TONE_TEXT,
} from "./statistics-format";

type SortKey = "views" | "persons" | "time" | "load" | "errors";

const SORT_LABELS: Record<SortKey, string> = {
  views: "Aufrufe",
  persons: "Personen",
  time: "Verweildauer",
  load: "Ladezeit",
  errors: "Fehler",
};

const tooltipStyle = {
  backgroundColor: "var(--popover)",
  color: "var(--popover-foreground)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
};

function changeHint(current: number, previous: number, label: string) {
  const change = formatChange(current, previous);
  if (change) return `${change} ggü. ${label}`;
  return previous > 0 ? `vorher ${numberFormat.format(previous)}` : "noch kein Vergleichswert";
}

function formatDay(date: string) {
  const [, month, day] = date.split("-");
  return `${day}.${month}.`;
}

export function StatisticsOverview({ statistics }: { statistics: MemberStatistics }) {
  const { usage, performance, errors, days } = statistics;
  const [sortKey, setSortKey] = useState<SortKey>("views");
  const [showAll, setShowAll] = useState(false);
  const previousLabel = `vorherigen ${days} Tagen`;

  const pages = useMemo(() => {
    const loadByRoute = new Map(
      performance.routes
        .filter((group) => group.kind === "navigation")
        .map((group) => [group.key, group.p75]),
    );
    const rows = usage.pages.map((page) => ({
      ...page,
      loadP75: loadByRoute.get(page.route) ?? null,
      errors: errors.byRoute[page.route] ?? 0,
    }));
    const value = (row: (typeof rows)[number]) => {
      switch (sortKey) {
        case "persons":
          return row.persons;
        case "time":
          return row.medianTimeOnPageMs ?? -1;
        case "load":
          return row.loadP75 ?? -1;
        case "errors":
          return row.errors;
        default:
          return row.views;
      }
    };
    return rows.sort((a, b) => value(b) - value(a));
  }, [usage.pages, performance.routes, errors.byRoute, sortKey]);

  const maxViews = Math.max(1, ...usage.pages.map((page) => page.views));
  const visiblePages = showAll ? pages : pages.slice(0, 10);
  const { kpis } = usage;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Aktive Mitglieder"
          value={numberFormat.format(kpis.activeMembers.current)}
          hint={changeHint(kpis.activeMembers.current, kpis.activeMembers.previous, previousLabel)}
          icon={<Users />}
          tone="primary"
        />
        <StatTile
          label="Besuche"
          value={numberFormat.format(kpis.visits.current)}
          hint={`typisch ${formatDuration(kpis.medianVisitMs.current)} lang`}
          icon={<Waypoints />}
          tone="info"
        />
        <StatTile
          label="Seitenwechsel"
          value={formatMs(performance.navigation.p75)}
          hint={
            performance.navigation.count
              ? `75 %-Wert · ${numberFormat.format(performance.navigation.count)} Messungen`
              : "noch keine Messungen"
          }
          icon={<MousePointerClick />}
          tone={loadTone(performance.navigation.p75, "navigation")}
        />
        <StatTile
          label="Am Handy"
          value={
            kpis.mobileShare.current === null ? "–" : percentFormat.format(kpis.mobileShare.current)
          }
          hint={`${numberFormat.format(kpis.pageViews.current)} Seitenaufrufe`}
          icon={<Smartphone />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border border-border/70 lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Aktive Mitglieder pro Tag</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="h-48 w-full"
              role="img"
              aria-label={`Aktive Mitglieder pro Tag der letzten ${days} Tage`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={usage.daily} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDay}
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    minTickGap={16}
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
                    labelFormatter={(label) => formatWeekday(String(label))}
                    formatter={(value, _name, item) => [
                      `${value} (${numberFormat.format(
                        (item?.payload as { pageViews?: number } | undefined)?.pageViews ?? 0,
                      )} Seitenaufrufe)`,
                      "Mitglieder",
                    ]}
                  />
                  <Bar
                    dataKey="activeMembers"
                    fill="var(--chart-1)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Geräte</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {usage.devices.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine Aufrufe im Zeitraum.</p>
            ) : (
              usage.devices.map((device) => (
                <div key={device.device} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">{device.device}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {percentFormat.format(device.share)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary/70"
                      style={{ width: `${Math.max(2, device.share * 100)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
            {performance.devices.length ? (
              <div className="border-t border-border/60 pt-3 text-xs text-muted-foreground">
                <p className="mb-1 font-medium text-foreground">Seitenwechsel (75 %)</p>
                <ul className="space-y-0.5">
                  {performance.devices
                    .filter((group) => group.kind === "navigation")
                    .slice(0, 4)
                    .map((group) => (
                      <li key={group.key} className="flex justify-between gap-2">
                        <span className="truncate">{group.key}</span>
                        <span
                          className={cn(
                            "font-medium tabular-nums",
                            TONE_TEXT[loadTone(group.p75, "navigation")],
                          )}
                        >
                          {formatMs(group.p75)}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border/70">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
          <CardTitle className="text-base">Seiten</CardTitle>
          <p className="text-xs text-muted-foreground">
            Sortiert nach {SORT_LABELS[sortKey]} · Ladezeit = Seitenwechsel, 75 %
          </p>
        </CardHeader>
        <CardContent>
          {pages.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Keine Seitenaufrufe im Zeitraum.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-3 text-left font-medium">Seite</th>
                    {(["views", "persons", "time", "load", "errors"] as const).map((key) => (
                      <th
                        key={key}
                        className={cn(
                          "px-2 py-2 text-right font-medium",
                          (key === "persons" || key === "time" || key === "errors") &&
                            "hidden sm:table-cell",
                        )}
                        aria-sort={sortKey === key ? "descending" : undefined}
                      >
                        <button
                          type="button"
                          onClick={() => setSortKey(key)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            sortKey === key && "text-foreground",
                          )}
                        >
                          {SORT_LABELS[key]}
                          {sortKey === key ? <ArrowDown className="h-3 w-3" aria-hidden /> : null}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visiblePages.map((page) => (
                    <tr key={page.route} className="border-b border-border/50 last:border-0">
                      <td className="max-w-[11rem] py-2 pr-3 sm:max-w-none">
                        <span className="block truncate font-medium">{shortRoute(page.route)}</span>
                        <span className="block text-xs text-muted-foreground sm:hidden">
                          {numberFormat.format(page.persons)} Pers. ·{" "}
                          {formatDuration(page.medianTimeOnPageMs)}
                          {page.errors ? ` · ${page.errors} Fehler` : ""}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="hidden h-1.5 w-16 rounded-full bg-muted md:block">
                            <div
                              className="h-1.5 rounded-full bg-primary/60"
                              style={{ width: `${(page.views / maxViews) * 100}%` }}
                            />
                          </div>
                          <span className="tabular-nums">{numberFormat.format(page.views)}</span>
                        </div>
                      </td>
                      <td className="hidden px-2 py-2 text-right tabular-nums sm:table-cell">
                        {numberFormat.format(page.persons)}
                      </td>
                      <td className="hidden px-2 py-2 text-right tabular-nums sm:table-cell">
                        {formatDuration(page.medianTimeOnPageMs)}
                      </td>
                      <td
                        className={cn(
                          "px-2 py-2 text-right font-medium tabular-nums",
                          TONE_TEXT[loadTone(page.loadP75, "navigation")],
                        )}
                      >
                        {formatMs(page.loadP75)}
                      </td>
                      <td
                        className={cn(
                          "hidden px-2 py-2 text-right tabular-nums sm:table-cell",
                          page.errors ? "font-medium text-destructive" : "text-muted-foreground",
                        )}
                      >
                        {page.errors || "–"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {pages.length > 10 ? (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full"
              onClick={() => setShowAll((value) => !value)}
            >
              {showAll ? "Weniger anzeigen" : `Alle ${pages.length} Seiten anzeigen`}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  collectServerAnalytics,
  type OptimizationArea,
  type OptimizationImpact,
} from "@/lib/server-analytics";
import { hasPermission } from "@/lib/permissions";
import { requireAuth } from "@/lib/rbac";
import { cn } from "@/lib/utils";

const numberFormat = new Intl.NumberFormat("de-DE");
const decimalFormat = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const percentPreciseFormat = new Intl.NumberFormat("de-DE", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const percentChangeFormat = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const dateTimeFormat = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });
const uptimeFormat = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatDuration(totalSeconds: number) {
  const seconds = Math.round(totalSeconds);
  if (seconds < 60) {
    return `${seconds} s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return `${minutes} min ${remainingSeconds.toString().padStart(2, "0")} s`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours} h ${remainingMinutes} min`;
}

function formatMs(ms: number) {
  if (ms >= 1000) {
    return `${decimalFormat.format(ms / 1000)} s`;
  }
  return `${Math.round(ms)} ms`;
}

function formatChange(change: number) {
  if (change === 0) {
    return "±0 %";
  }
  const sign = change > 0 ? "+" : "−";
  return `${sign}${percentChangeFormat.format(Math.abs(change) * 100)} %`;
}

function changeTextClass(value: number, positiveIsGood = true) {
  if (value === 0) {
    return "text-muted-foreground";
  }
  const isPositive = value > 0;
  const isImprovement = positiveIsGood ? isPositive : !isPositive;
  return isImprovement ? "text-emerald-600" : "text-orange-600";
}

function areaBadgeVariant(area: OptimizationArea) {
  switch (area) {
    case "Frontend":
      return "info" as const;
    case "Mitgliederbereich":
      return "accent" as const;
    case "Infrastruktur":
      return "muted" as const;
    default:
      return "secondary" as const;
  }
}

function impactBadgeVariant(impact: OptimizationImpact) {
  switch (impact) {
    case "Hoch":
      return "warning" as const;
    case "Mittel":
      return "secondary" as const;
    case "Niedrig":
      return "success" as const;
    default:
      return "muted" as const;
  }
}

export default async function ServerAnalyticsPage() {
  const session = await requireAuth();
  const allowed = await hasPermission(session.user, "mitglieder.server.analytics");
  if (!allowed) {
    return <div className="text-sm text-red-600">Kein Zugriff auf die Server-Statistiken</div>;
  }

  const analytics = await collectServerAnalytics();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Server- & Nutzungsstatistiken</h1>
        <p className="text-sm text-muted-foreground">
          Umfassender Überblick über Auslastung, Performance und Nutzungsverhalten. Die Kennzahlen helfen bei der Optimierung
          der öffentlichen Seiten und des Mitgliederbereichs.
        </p>
        <p className="text-xs text-muted-foreground">
          Letzte Aktualisierung: {dateTimeFormat.format(new Date(analytics.generatedAt))}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Verfügbarkeit</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{uptimeFormat.format(analytics.summary.uptimePercentage)} %</p>
            <p className="text-xs text-muted-foreground">letzte 30 Tage</p>
          </CardContent>
        </Card>
        <Card className="border border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Anfragen (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{numberFormat.format(analytics.summary.requestsLast24h)}</p>
            <p className="text-xs text-muted-foreground">über alle Systeme hinweg</p>
          </CardContent>
        </Card>
        <Card className="border border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ø Antwortzeit</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{formatMs(analytics.summary.averageResponseTimeMs)}</p>
            <p className="text-xs text-muted-foreground">95. Perzentil liegt bei {formatMs(analytics.summary.averageResponseTimeMs * 1.6)}</p>
          </CardContent>
        </Card>
        <Card className="border border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Peak gleichzeitiger Nutzer</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{numberFormat.format(analytics.summary.peakConcurrentUsers)}</p>
            <p className="text-xs text-muted-foreground">innerhalb der letzten 24 Stunden</p>
          </CardContent>
        </Card>
        <Card className="border border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cache-Hit-Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{percentPreciseFormat.format(analytics.summary.cacheHitRate)}</p>
            <p className="text-xs text-muted-foreground">Edge- und Anwendungscache kombiniert</p>
          </CardContent>
        </Card>
        <Card className="border border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Realtime-Ereignisse (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{numberFormat.format(analytics.summary.realtimeEventsLast24h)}</p>
            <p className="text-xs text-muted-foreground">Socket.io Updates und Live-Sync</p>
          </CardContent>
        </Card>
        <Card className="border border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Fehlerquote</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{percentPreciseFormat.format(analytics.summary.errorRate)}</p>
            <p className="text-xs text-muted-foreground">5xx/4xx im Verhältnis zu allen Requests</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border border-border/70">
          <CardHeader>
            <CardTitle>Serverauslastung & Ressourcen</CardTitle>
            <p className="text-sm text-muted-foreground">
              Auslastung der Kernsysteme inklusive Trend gegenüber dem Vortag.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.resourceUsage.map((resource) => (
                <div key={resource.id} className="space-y-2 rounded-md border border-border/60 p-3">
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span>{resource.label}</span>
                    <span>{decimalFormat.format(resource.usagePercent)} %</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary/70"
                      style={{ width: `${Math.min(resource.usagePercent, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Kapazität: {resource.capacity}</span>
                    <span className={cn("font-medium", changeTextClass(resource.changePercent, false))}>
                      {formatChange(resource.changePercent)} vs. Vortag
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/70">
          <CardHeader>
            <CardTitle>Stoßzeiten & Lastverteilung</CardTitle>
            <p className="text-sm text-muted-foreground">Zeitfenster mit erhöhter Auslastung innerhalb der letzten 7 Tage.</p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {analytics.peakHours.map((bucket) => (
                <li
                  key={bucket.range}
                  className="flex items-center justify-between rounded-md border border-border/60 bg-background/60 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{bucket.range}</p>
                    <p className="text-xs text-muted-foreground">
                      {numberFormat.format(bucket.requests)} Requests · Anteil {percentPreciseFormat.format(bucket.share)}
                    </p>
                  </div>
                  <Badge variant="outline">Peak</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-border/70">
        <CardHeader>
          <CardTitle>Seitenperformance – Öffentlicher Bereich</CardTitle>
          <p className="text-sm text-muted-foreground">
            Ladezeiten, Verweildauer und Zielerfüllung auf den wichtigsten öffentlichen Seiten.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Seite</th>
                  <th className="px-3 py-2 text-left">Aufrufe</th>
                  <th className="px-3 py-2 text-left">Ø Zeit auf Seite</th>
                  <th className="px-3 py-2 text-left">Performance</th>
                  <th className="px-3 py-2 text-left">Absprung</th>
                  <th className="px-3 py-2 text-left">Zielerfüllung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {analytics.publicPages.map((entry) => (
                  <tr key={entry.path} className="bg-background/60">
                    <td className="px-3 py-2">
                      <div className="font-medium text-foreground">{entry.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {entry.path} · Scrolltiefe {percentPreciseFormat.format(entry.avgScrollDepth)}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-semibold text-foreground">{numberFormat.format(entry.views)}</div>
                      <div className="text-xs text-muted-foreground">
                        {numberFormat.format(entry.uniqueVisitors)} eindeutige Besucher
                      </div>
                    </td>
                    <td className="px-3 py-2 text-foreground">{formatDuration(entry.avgTimeOnPageSeconds)}</td>
                    <td className="px-3 py-2 text-foreground">
                      <div>Ø Ladezeit {formatMs(entry.loadTimeMs)}</div>
                      <div className="text-xs text-muted-foreground">LCP {formatMs(entry.lcpMs)}</div>
                    </td>
                    <td className="px-3 py-2 text-foreground">
                      <div>{percentPreciseFormat.format(entry.bounceRate)}</div>
                      <div className="text-xs text-muted-foreground">Exit-Rate {percentPreciseFormat.format(entry.exitRate)}</div>
                    </td>
                    <td className="px-3 py-2 font-semibold text-foreground">
                      {percentPreciseFormat.format(entry.goalCompletionRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border/70">
        <CardHeader>
          <CardTitle>Seitenperformance – Mitgliederbereich</CardTitle>
          <p className="text-sm text-muted-foreground">
            Nutzungsverhalten der eingeloggten Mitglieder inklusive Verweildauer und Erfolgsquote in den Arbeitsbereichen.
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Bereich</th>
                  <th className="px-3 py-2 text-left">Aufrufe</th>
                  <th className="px-3 py-2 text-left">Ø Zeit auf Seite</th>
                  <th className="px-3 py-2 text-left">Performance</th>
                  <th className="px-3 py-2 text-left">Absprung</th>
                  <th className="px-3 py-2 text-left">Zielerfüllung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {analytics.memberPages.map((entry) => (
                  <tr key={entry.path} className="bg-background/60">
                    <td className="px-3 py-2">
                      <div className="font-medium text-foreground">{entry.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {entry.path} · Scrolltiefe {percentPreciseFormat.format(entry.avgScrollDepth)}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-semibold text-foreground">{numberFormat.format(entry.views)}</div>
                      <div className="text-xs text-muted-foreground">
                        {numberFormat.format(entry.uniqueVisitors)} eindeutige Mitglieder
                      </div>
                    </td>
                    <td className="px-3 py-2 text-foreground">{formatDuration(entry.avgTimeOnPageSeconds)}</td>
                    <td className="px-3 py-2 text-foreground">
                      <div>Ø Ladezeit {formatMs(entry.loadTimeMs)}</div>
                      <div className="text-xs text-muted-foreground">LCP {formatMs(entry.lcpMs)}</div>
                    </td>
                    <td className="px-3 py-2 text-foreground">
                      <div>{percentPreciseFormat.format(entry.bounceRate)}</div>
                      <div className="text-xs text-muted-foreground">Exit-Rate {percentPreciseFormat.format(entry.exitRate)}</div>
                    </td>
                    <td className="px-3 py-2 font-semibold text-foreground">
                      {percentPreciseFormat.format(entry.goalCompletionRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border border-border/70">
          <CardHeader>
            <CardTitle>Traffic-Kanäle</CardTitle>
            <p className="text-sm text-muted-foreground">
              Entwicklung der wichtigsten Besucherquellen inklusive Konversionsrate.
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Kanal</th>
                    <th className="px-3 py-2 text-left">Sessions</th>
                    <th className="px-3 py-2 text-left">Ø Sitzungsdauer</th>
                    <th className="px-3 py-2 text-left">Konversion</th>
                    <th className="px-3 py-2 text-left">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {analytics.trafficSources.map((source) => (
                    <tr key={source.channel} className="bg-background/60">
                      <td className="px-3 py-2 font-medium text-foreground">{source.channel}</td>
                      <td className="px-3 py-2 text-foreground">{numberFormat.format(source.sessions)}</td>
                      <td className="px-3 py-2 text-foreground">{formatDuration(source.avgSessionDurationSeconds)}</td>
                      <td className="px-3 py-2 font-semibold text-foreground">
                        {percentPreciseFormat.format(source.conversionRate)}
                      </td>
                      <td className="px-3 py-2">
                        <span className={cn("text-xs font-medium", changeTextClass(source.changePercent, true))}>
                          {formatChange(source.changePercent)} vs. Vorwoche
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/70">
          <CardHeader>
            <CardTitle>Geräte & Ladezeiten</CardTitle>
            <p className="text-sm text-muted-foreground">
              Anteil der Sitzungen pro Gerätetyp inklusive typischer Ladezeit.
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Gerät</th>
                    <th className="px-3 py-2 text-left">Sessions</th>
                    <th className="px-3 py-2 text-left">Anteil</th>
                    <th className="px-3 py-2 text-left">Ø Ladezeit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {analytics.deviceBreakdown.map((device) => (
                    <tr key={device.device} className="bg-background/60">
                      <td className="px-3 py-2 font-medium text-foreground">{device.device}</td>
                      <td className="px-3 py-2 text-foreground">{numberFormat.format(device.sessions)}</td>
                      <td className="px-3 py-2 text-foreground">{percentPreciseFormat.format(device.share)}</td>
                      <td className="px-3 py-2 text-foreground">{formatMs(device.avgPageLoadMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border border-border/70">
          <CardHeader>
            <CardTitle>Session Insights</CardTitle>
            <p className="text-sm text-muted-foreground">
              Vergleich von neuen, wiederkehrenden und eingeloggten Nutzergruppen.
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Segment</th>
                    <th className="px-3 py-2 text-left">Ø Dauer</th>
                    <th className="px-3 py-2 text-left">Seiten / Sitzung</th>
                    <th className="px-3 py-2 text-left">Retention</th>
                    <th className="px-3 py-2 text-left">Anteil</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {analytics.sessionInsights.map((segment) => (
                    <tr key={segment.segment} className="bg-background/60">
                      <td className="px-3 py-2 font-medium text-foreground">{segment.segment}</td>
                      <td className="px-3 py-2 text-foreground">{formatDuration(segment.avgSessionDurationSeconds)}</td>
                      <td className="px-3 py-2 text-foreground">{decimalFormat.format(segment.pagesPerSession)}</td>
                      <td className="px-3 py-2 text-foreground">{percentPreciseFormat.format(segment.retentionRate)}</td>
                      <td className="px-3 py-2 text-foreground">{percentPreciseFormat.format(segment.share)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border/70">
          <CardHeader>
            <CardTitle>Optimierungspotenziale</CardTitle>
            <p className="text-sm text-muted-foreground">
              Konkrete Hebel zur Verbesserung der Ladezeiten und Nutzerführung basierend auf den gemessenen Daten.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.optimizationInsights.map((insight) => (
                <div key={insight.id} className="space-y-2 rounded-md border border-border/60 bg-background/70 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant={areaBadgeVariant(insight.area)}>{insight.area}</Badge>
                    <Badge variant={impactBadgeVariant(insight.impact)}>{insight.impact}-Impact</Badge>
                    <span className="text-muted-foreground">{insight.metric}</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">{insight.title}</p>
                    <p className="text-sm text-muted-foreground">{insight.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

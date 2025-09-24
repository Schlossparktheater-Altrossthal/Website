"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRealtime } from "@/hooks/useRealtime";
import type {
  OptimizationArea,
  OptimizationImpact,
  ServerAnalytics,
  ServerLogEvent,
} from "@/lib/server-analytics";
import type { ServerAnalyticsRealtimeEvent } from "@/lib/realtime/types";
import { cn } from "@/lib/utils";
import { updateServerLogStatusAction } from "./actions";

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

const ANIMATION_DURATION_MS = 450;

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

function MockDataBadge({ label = "Demo" }: { label?: string }) {
  return (
    <Badge
      variant="outline"
      className="border-dashed text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
    >
      {label}
    </Badge>
  );
}

function parseGeneratedAt(value: string | undefined) {
  const parsed = Date.parse(value ?? "");
  if (Number.isFinite(parsed)) {
    return new Date(parsed);
  }
  return new Date();
}

function formatLogTimestamp(value: string | undefined) {
  const parsed = Date.parse(value ?? "");
  if (Number.isFinite(parsed)) {
    return dateTimeFormat.format(new Date(parsed));
  }
  return "Zeitpunkt unbekannt";
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function interpolateValue<T>(start: T, end: T, progress: number): T {
  if (typeof start === "number" && typeof end === "number" && Number.isFinite(start) && Number.isFinite(end)) {
    return (start + (end - start) * progress) as T;
  }

  if (Array.isArray(start) && Array.isArray(end)) {
    if (start.length !== end.length) {
      return end as T;
    }

    return end.map((value, index) => interpolateValue(start[index], value, progress)) as unknown as T;
  }

  if (
    start !== null &&
    start !== undefined &&
    end !== null &&
    end !== undefined &&
    typeof start === "object" &&
    typeof end === "object"
  ) {
    const result: Record<string, unknown> = {};
    const startRecord = start as Record<string, unknown>;
    const endRecord = end as Record<string, unknown>;
    const keys = new Set([...Object.keys(startRecord), ...Object.keys(endRecord)]);

    keys.forEach((key) => {
      result[key] = interpolateValue(startRecord[key], endRecord[key], progress);
    });

    return result as T;
  }

  return end;
}

function useAnimatedAnalytics(targetAnalytics: ServerAnalytics, durationMs = ANIMATION_DURATION_MS) {
  const [animatedAnalytics, setAnimatedAnalytics] = useState<ServerAnalytics>(targetAnalytics);
  const frameRef = useRef<number | null>(null);
  const latestValueRef = useRef<ServerAnalytics>(targetAnalytics);

  useEffect(() => {
    latestValueRef.current = animatedAnalytics;
  }, [animatedAnalytics]);

  useEffect(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    const startValue = latestValueRef.current;

    if (Object.is(startValue, targetAnalytics)) {
      setAnimatedAnalytics(targetAnalytics);
      latestValueRef.current = targetAnalytics;
      return;
    }

    const startTime = performance.now();

    const tick = (timestamp: number) => {
      const elapsed = timestamp - startTime;
      const progress = durationMs <= 0 ? 1 : Math.min(1, elapsed / durationMs);
      const eased = easeOutCubic(progress);

      if (progress >= 1) {
        setAnimatedAnalytics(targetAnalytics);
        latestValueRef.current = targetAnalytics;
        frameRef.current = null;
        return;
      }

      setAnimatedAnalytics(interpolateValue(startValue, targetAnalytics, eased));
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [targetAnalytics, durationMs]);

  return animatedAnalytics;
}

const severityLabelMap: Record<ServerLogEvent["severity"], string> = {
  info: "Info",
  warning: "Warnung",
  error: "Fehler",
};

function severityBadgeVariant(severity: ServerLogEvent["severity"]) {
  switch (severity) {
    case "error":
      return "destructive" as const;
    case "warning":
      return "warning" as const;
    default:
      return "muted" as const;
  }
}

const statusLabelMap: Record<ServerLogEvent["status"], string> = {
  open: "Offen",
  monitoring: "Beobachtung",
  resolved: "Gelöst",
};

function statusBadgeVariant(status: ServerLogEvent["status"]) {
  switch (status) {
    case "open":
      return "destructive" as const;
    case "monitoring":
      return "warning" as const;
    case "resolved":
    default:
      return "success" as const;
  }
}

const statusActionLabelMap: Record<ServerLogEvent["status"], string> = {
  open: "Auf offen setzen",
  monitoring: "Auf Beobachtung setzen",
  resolved: "Als gelöst markieren",
};

const statusUpdateOrder: ServerLogEvent["status"][] = ["open", "monitoring", "resolved"];

type ServerAnalyticsContentProps = {
  initialAnalytics: ServerAnalytics;
};

export function ServerAnalyticsContent({ initialAnalytics }: ServerAnalyticsContentProps) {
  const { socket, isConnected, connectionStatus } = useRealtime();
  const [analytics, setAnalytics] = useState<ServerAnalytics>(initialAnalytics);
  const [generatedAt, setGeneratedAt] = useState<Date>(() => parseGeneratedAt(initialAnalytics.generatedAt));
  const [hasLiveUpdate, setHasLiveUpdate] = useState(false);
  const [pendingLogId, setPendingLogId] = useState<string | null>(null);
  const [isStatusUpdating, startStatusUpdate] = useTransition();
  const displayAnalytics = useAnimatedAnalytics(analytics);

  useEffect(() => {
    setAnalytics(initialAnalytics);
    setGeneratedAt(parseGeneratedAt(initialAnalytics.generatedAt));
    setHasLiveUpdate(false);
  }, [initialAnalytics]);

  useEffect(() => {
    if (!socket) return;

    const handleUpdate = (event: ServerAnalyticsRealtimeEvent) => {
      if (!event?.analytics) {
        return;
      }
      setAnalytics(event.analytics);
      setGeneratedAt(parseGeneratedAt(event.analytics.generatedAt ?? event.timestamp));
      setHasLiveUpdate(true);
    };

    socket.on("server_analytics_update", handleUpdate);

    if (socket.connected) {
      socket.emit("get_server_analytics");
    }

    return () => {
      socket.off("server_analytics_update", handleUpdate);
    };
  }, [socket]);

  useEffect(() => {
    if (socket && isConnected) {
      socket.emit("get_server_analytics");
    }
  }, [socket, isConnected]);

  const lastUpdatedLabel = useMemo(() => dateTimeFormat.format(generatedAt), [generatedAt]);

  const connectionText = useMemo(() => {
    switch (connectionStatus) {
      case "connected":
        return hasLiveUpdate ? "Live verbunden" : "Verbunden – warte auf Live-Daten";
      case "connecting":
        return "Verbindung wird aufgebaut…";
      case "error":
        return "Realtime-Verbindung fehlgeschlagen";
      default:
        return "Offline – zeige letzte Messung";
    }
  }, [connectionStatus, hasLiveUpdate]);

  const connectionDotClass = useMemo(() => {
    switch (connectionStatus) {
      case "connected":
        return "bg-emerald-500 animate-pulse";
      case "connecting":
        return "bg-sky-500 animate-pulse";
      case "error":
        return "bg-orange-500";
      default:
        return "bg-muted-foreground/60";
    }
  }, [connectionStatus]);

  const handleStatusUpdate = (logId: string, status: ServerLogEvent["status"]) => {
    setPendingLogId(logId);
    startStatusUpdate(async () => {
      try {
        const result = await updateServerLogStatusAction({ logId, status });
        if (result.success) {
          setAnalytics((previous) => {
            const currentLogs = previous.serverLogs ?? [];
            const updatedLogs = currentLogs.some((entry) => entry.id === logId)
              ? currentLogs.map((entry) =>
                  entry.id === logId
                    ? {
                        ...entry,
                        ...result.log,
                        tags: Array.isArray(result.log.tags) ? [...result.log.tags] : [],
                      }
                    : entry,
                )
              : [...currentLogs, { ...result.log, tags: Array.isArray(result.log.tags) ? [...result.log.tags] : [] }];

            return {
              ...previous,
              serverLogs: updatedLogs,
            };
          });
        } else {
          console.error(`[server-analytics] Status update failed for log ${logId}: ${result.error}`);
        }
      } catch (error) {
        console.error(`[server-analytics] Status update threw for log ${logId}`, error);
      } finally {
        setPendingLogId((current) => (current === logId ? null : current));
      }
    });
  };

  const {
    logs: relevantLogs,
    warningCount,
    errorCount,
    openCount: openIncidents,
    lastSeenLabel: lastLogSeenLabel,
  } = useMemo(() => {
    const entries = analytics.serverLogs ?? [];
    const filtered = entries.filter((log) => log.severity === "warning" || log.severity === "error");
    const sorted = [...filtered].sort((a, b) => {
      const aTime = Date.parse(a.lastSeen);
      const bTime = Date.parse(b.lastSeen);
      if (!Number.isFinite(aTime) && !Number.isFinite(bTime)) {
        return 0;
      }
      if (!Number.isFinite(aTime)) {
        return 1;
      }
      if (!Number.isFinite(bTime)) {
        return -1;
      }
      return bTime - aTime;
    });

    const warningTotal = sorted.filter((log) => log.severity === "warning").length;
    const errorTotal = sorted.filter((log) => log.severity === "error").length;
    const openTotal = sorted.filter((log) => log.status === "open").length;
    const latest = sorted[0];

    return {
      logs: sorted,
      warningCount: warningTotal,
      errorCount: errorTotal,
      openCount: openTotal,
      lastSeenLabel: latest ? formatLogTimestamp(latest.lastSeen) : "Keine Meldungen",
    };
  }, [analytics.serverLogs]);

  const latestLog = relevantLogs[0];
  const hasLogs = relevantLogs.length > 0;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Server- & Nutzungsstatistiken</h1>
        <p className="text-sm text-muted-foreground">
          Umfassender Überblick über Auslastung, Performance und Nutzungsverhalten. Die Kennzahlen helfen bei der Optimierung
          der öffentlichen Seiten und des Mitgliederbereichs.
        </p>
        <div className="flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:gap-3">
          <span className="flex items-center gap-1 font-medium text-foreground/80">
            <span className={cn("h-2 w-2 rounded-full", connectionDotClass)} />
            {connectionText}
          </span>
          <span>Letzte Aktualisierung: {lastUpdatedLabel}</span>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="overview">Kennzahlen</TabsTrigger>
            <TabsTrigger value="logs">Serverlogs</TabsTrigger>
          </TabsList>
          <div className="text-xs text-muted-foreground sm:text-right">
            <p className="font-medium text-foreground/80">Letzte Meldung</p>
            <p>{hasLogs ? lastLogSeenLabel : "Keine Meldungen"}</p>
          </div>
        </div>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              Verfügbarkeit
              <MockDataBadge />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{uptimeFormat.format(displayAnalytics.summary.uptimePercentage)} %</p>
            <p className="text-xs text-muted-foreground">letzte 30 Tage</p>
          </CardContent>
        </Card>
        <Card className="border border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              Anfragen (24h)
              <MockDataBadge />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{numberFormat.format(displayAnalytics.summary.requestsLast24h)}</p>
            <p className="text-xs text-muted-foreground">über alle Systeme hinweg</p>
          </CardContent>
        </Card>
        <Card className="border border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              Ø Antwortzeit
              <MockDataBadge />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{formatMs(displayAnalytics.summary.averageResponseTimeMs)}</p>
            <p className="text-xs text-muted-foreground">95. Perzentil liegt bei {formatMs(displayAnalytics.summary.averageResponseTimeMs * 1.6)}</p>
          </CardContent>
        </Card>
        <Card className="border border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              Peak gleichzeitiger Nutzer
              <MockDataBadge />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{numberFormat.format(displayAnalytics.summary.peakConcurrentUsers)}</p>
            <p className="text-xs text-muted-foreground">innerhalb der letzten 24 Stunden</p>
          </CardContent>
        </Card>
        <Card className="border border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              Cache-Hit-Rate
              <MockDataBadge />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{percentPreciseFormat.format(displayAnalytics.summary.cacheHitRate)}</p>
            <p className="text-xs text-muted-foreground">Edge- und Anwendungscache kombiniert</p>
          </CardContent>
        </Card>
        <Card className="border border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              Realtime-Ereignisse (24h)
              <MockDataBadge />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{numberFormat.format(displayAnalytics.summary.realtimeEventsLast24h)}</p>
            <p className="text-xs text-muted-foreground">Socket.io Updates und Live-Sync</p>
          </CardContent>
        </Card>
        <Card className="border border-border/70">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              Fehlerquote
              <MockDataBadge />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{percentPreciseFormat.format(displayAnalytics.summary.errorRate)}</p>
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
              {displayAnalytics.resourceUsage.map((resource) => (
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
            <CardTitle className="flex items-center gap-2">
              Stoßzeiten & Lastverteilung
              <MockDataBadge />
            </CardTitle>
            <p className="text-sm text-muted-foreground">Zeitfenster mit erhöhter Auslastung innerhalb der letzten 7 Tage.</p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {displayAnalytics.peakHours.map((bucket) => (
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
          <CardTitle className="flex items-center gap-2">
            Seitenperformance – Öffentlicher Bereich
            <MockDataBadge />
          </CardTitle>
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
                {displayAnalytics.publicPages.map((entry) => (
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
          <CardTitle className="flex items-center gap-2">
            Seitenperformance – Mitgliederbereich
            <MockDataBadge />
          </CardTitle>
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
                {displayAnalytics.memberPages.map((entry) => (
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
            <CardTitle className="flex items-center gap-2">
              Traffic-Kanäle
              <MockDataBadge />
            </CardTitle>
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
                  {displayAnalytics.trafficSources.map((source) => (
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
                  {displayAnalytics.deviceBreakdown.map((device) => (
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
            <CardTitle className="flex items-center gap-2">
              Session Insights
              <MockDataBadge />
            </CardTitle>
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
                  {displayAnalytics.sessionInsights.map((segment) => (
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
            <CardTitle className="flex items-center gap-2">
              Optimierungspotenziale
              <MockDataBadge />
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Konkrete Hebel zur Verbesserung der Ladezeiten und Nutzerführung basierend auf den gemessenen Daten.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {displayAnalytics.optimizationInsights.map((insight) => (
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
        </TabsContent>

        <TabsContent value="logs" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border border-border/70">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  Warnungen
                  <MockDataBadge />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{numberFormat.format(warningCount)}</p>
                <p className="text-xs text-muted-foreground">letzte 48 Stunden</p>
              </CardContent>
            </Card>
            <Card className="border border-border/70">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  Fehler
                  <MockDataBadge />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{numberFormat.format(errorCount)}</p>
                <p className="text-xs text-muted-foreground">letzte 48 Stunden</p>
              </CardContent>
            </Card>
            <Card className="border border-border/70">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  Offene Vorfälle
                  <MockDataBadge />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold">{numberFormat.format(openIncidents)}</p>
                <p className="text-xs text-muted-foreground">
                  {openIncidents === 1 ? "Ticket in Bearbeitung" : "Tickets in Bearbeitung"}
                </p>
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {hasLogs ? (
                    <>
                      <p className="font-medium text-foreground/80">{latestLog?.message}</p>
                      <p>{latestLog?.service}</p>
                      <p>Zuletzt: {lastLogSeenLabel}</p>
                    </>
                  ) : (
                    <p>Keine aktuellen Meldungen.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

        <Card className="border border-border/70">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Warn- & Fehlermeldungen
              <MockDataBadge />
            </CardTitle>
              <p className="text-sm text-muted-foreground">
                Automatisch aggregierte Serverlogs der letzten 48 Stunden.
              </p>
            </CardHeader>
            <CardContent>
              {hasLogs ? (
                <div className="space-y-4">
                  {relevantLogs.map((log) => (
                    <div key={log.id} className="space-y-3 rounded-lg border border-border/60 bg-background/60 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                            <Badge variant={severityBadgeVariant(log.severity)} className="uppercase tracking-wide">
                              {severityLabelMap[log.severity as keyof typeof severityLabelMap]}
                            </Badge>
                            <span>{log.service}</span>
                          </div>
                          <p className="text-sm font-semibold text-foreground">{log.message}</p>
                          <p className="text-sm text-muted-foreground">{log.description}</p>
                          {log.tags?.length ? (
                            <div className="flex flex-wrap gap-2">
                              {log.tags.map((tag: string) => (
                                <Badge
                                  key={`${log.id}-${tag}`}
                                  variant="outline"
                                  className="border-border/60 bg-transparent text-[11px] font-medium text-muted-foreground"
                                >
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex flex-col items-start gap-2 sm:items-end">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={statusBadgeVariant(log.status)} className="uppercase tracking-wide">
                              {statusLabelMap[log.status as keyof typeof statusLabelMap]}
                            </Badge>
                            <div className="flex flex-wrap gap-1">
                              {statusUpdateOrder
                                .filter((statusOption) => statusOption !== log.status)
                                .map((statusOption) => {
                                  const isLogUpdating = pendingLogId === log.id && isStatusUpdating;
                                  const disableOtherLogs =
                                    isStatusUpdating && pendingLogId !== null && pendingLogId !== log.id;
                                  const isDisabled = isLogUpdating || disableOtherLogs;
                                  return (
                                    <Button
                                      key={`${log.id}-${statusOption}`}
                                      size="xs"
                                      variant="outline"
                                      className="text-[11px]"
                                      data-state={isLogUpdating ? "loading" : undefined}
                                      disabled={isDisabled}
                                      onClick={() => handleStatusUpdate(log.id, statusOption)}
                                    >
                                      {statusActionLabelMap[statusOption]}
                                    </Button>
                                  );
                                })}
                            </div>
                          </div>
                          {log.recommendedAction ? (
                            <p className="max-w-xs text-xs text-muted-foreground sm:text-right">{log.recommendedAction}</p>
                          ) : null}
                          <div className="flex flex-wrap justify-end gap-3 text-xs text-muted-foreground">
                            <span>Vorkommen: {numberFormat.format(log.occurrences)}</span>
                            {typeof log.affectedUsers === "number" ? (
                              <span>Betroffene Nutzer:innen: {numberFormat.format(log.affectedUsers)}</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>Erstmals gesehen: {formatLogTimestamp(log.firstSeen)}</span>
                        <span>Zuletzt gesehen: {formatLogTimestamp(log.lastSeen)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-success/40 bg-success/10 p-6 text-sm text-success">
                  <p className="font-semibold">Keine aktiven Warn- oder Fehlermeldungen</p>
                  <p className="mt-1 text-success/90">
                    Innerhalb der letzten 48 Stunden wurden keine Warnungen oder Fehler registriert. Systeme laufen stabil.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

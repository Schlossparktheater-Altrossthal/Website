import { CircleCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MemberStatistics } from "@/lib/analytics/statistics";

import { formatChange, formatRelative, numberFormat, shortRoute } from "./statistics-format";

/** Fehler aus Server-Rendering und Browser, gruppiert nach Seite und Meldung. */
export function StatisticsErrors({ statistics }: { statistics: MemberStatistics }) {
  const { errors, days } = statistics;
  const now = new Date(statistics.generatedAt).getTime();
  const change = formatChange(errors.total, errors.previousTotal);

  if (errors.groups.length === 0) {
    return (
      <Card className="border border-success/40 bg-success/5">
        <CardContent className="flex items-start gap-3 py-5 text-sm">
          <CircleCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />
          <div>
            <p className="font-medium">Keine Fehler in den letzten {days} Tagen</p>
            <p className="text-muted-foreground">
              Erfasst werden Serverfehler beim Laden von Seiten und JavaScript-Fehler im Browser
              angemeldeter Mitglieder.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border/70">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {numberFormat.format(errors.total)} Fehler · {errors.groups.length} verschiedene
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Letzte {days} Tage{change ? ` · ${change} ggü. Vorzeitraum` : ""}. Gleiche Meldungen auf
          derselben Seite sind zusammengefasst.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {errors.groups.map((group) => (
          <details
            key={`${group.source}-${group.route}-${group.message}`}
            className="group rounded-lg border border-border/60 bg-background/60 px-3 py-2"
          >
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <Badge variant={group.source === "server" ? "destructive" : "outline"}>
                    {group.source === "server" ? "Server" : "Browser"}
                  </Badge>
                  <span className="font-medium text-foreground">{shortRoute(group.route)}</span>
                  <span>· {formatRelative(group.lastSeen, now)}</span>
                </div>
                <p className="break-words text-sm">{group.message}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-lg font-semibold tabular-nums">{group.count}×</p>
                {group.persons ? (
                  <p className="text-xs text-muted-foreground">
                    {group.persons} {group.persons === 1 ? "Person" : "Personen"}
                  </p>
                ) : null}
              </div>
            </summary>
            <div className="mt-2 space-y-1 border-t border-border/60 pt-2 text-xs text-muted-foreground">
              {group.browsers.length ? <p>Browser: {group.browsers.join(", ")}</p> : null}
              {group.detail ? (
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/60 p-2 font-mono text-[11px]">
                  {group.detail}
                </pre>
              ) : null}
            </div>
          </details>
        ))}
      </CardContent>
    </Card>
  );
}

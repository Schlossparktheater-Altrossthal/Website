"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { AsyncButton } from "@/components/ui/async-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LoadedServerLog, ServerLogStatus } from "@/lib/analytics/load-server-logs";
import type { ServerResourceUsage } from "@/lib/server-analytics";
import { cn } from "@/lib/utils";

import { updateServerLogStatusAction } from "./actions";
import { formatDateTime, numberFormat } from "./statistics-format";

const decimalFormat = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

const STATUS_LABEL: Record<ServerLogStatus, string> = {
  open: "Offen",
  monitoring: "Beobachten",
  resolved: "Gelöst",
};

function usageTone(percent: number) {
  if (percent >= 90) return "bg-destructive";
  if (percent >= 75) return "bg-warning";
  return "bg-primary/70";
}

/** Serverressourcen und Warn-/Fehlermeldungen der App (Logger), mit Status-Pflege. */
export function SystemSection({
  resources,
  logs,
  days,
}: {
  resources: ServerResourceUsage[];
  logs: LoadedServerLog[];
  days: number;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const updateStatus = (logId: string, status: ServerLogStatus) => {
    setPendingId(logId);
    startTransition(async () => {
      const result = await updateServerLogStatusAction({ logId, status });
      if (result.success) {
        toast.success(`Meldung auf „${STATUS_LABEL[status]}“ gesetzt.`);
        router.refresh();
      } else {
        toast.error("Status konnte nicht geändert werden.");
      }
      setPendingId(null);
    });
  };

  return (
    <div className="space-y-6">
      <Card className="border border-border/70">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Server</CardTitle>
          <p className="text-xs text-muted-foreground">
            Momentaufnahme des Knotens, auf dem diese Seite gerade ausgeliefert wurde.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          {resources.map((resource) => (
            <div key={resource.id} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="truncate font-medium">{resource.label}</span>
                <span className="tabular-nums">
                  {decimalFormat.format(resource.usagePercent)} %
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div
                  className={cn("h-2 rounded-full", usageTone(resource.usagePercent))}
                  style={{ width: `${Math.min(resource.usagePercent, 100)}%` }}
                />
              </div>
              <p className="break-words text-xs text-muted-foreground">{resource.capacity}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border border-border/70">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Warn- & Fehlermeldungen der App</CardTitle>
          <p className="text-xs text-muted-foreground">
            Vom Server protokollierte Meldungen der letzten {days} Tage (z. B. Authentik-Abgleich,
            E-Mail-Versand).
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {logs.length === 0 ? (
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
              Keine Warnungen oder Fehler im Zeitraum.
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="space-y-2 rounded-lg border border-border/60 bg-background/60 px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <Badge variant={log.severity === "error" ? "destructive" : "warning"}>
                    {log.severity === "error" ? "Fehler" : "Warnung"}
                  </Badge>
                  <Badge variant={log.status === "resolved" ? "success" : "muted"}>
                    {STATUS_LABEL[log.status]}
                  </Badge>
                  <span>{log.service}</span>
                  <span>
                    · {numberFormat.format(log.occurrences)}× · zuletzt{" "}
                    {formatDateTime(log.lastSeen)}
                  </span>
                </div>
                <p className="text-sm font-medium">{log.message}</p>
                {log.description ? (
                  <p className="text-xs text-muted-foreground">{log.description}</p>
                ) : null}
                <div className="flex flex-wrap gap-1">
                  {(Object.keys(STATUS_LABEL) as ServerLogStatus[])
                    .filter((status) => status !== log.status)
                    .map((status) => (
                      <AsyncButton
                        key={status}
                        size="xs"
                        variant="outline"
                        disabled={isPending}
                        isLoading={isPending && pendingId === log.id}
                        onClick={() => updateStatus(log.id, status)}
                      >
                        {STATUS_LABEL[status]}
                      </AsyncButton>
                    ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

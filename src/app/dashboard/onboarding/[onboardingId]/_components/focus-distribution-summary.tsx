"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OnboardingDashboardData } from "@/lib/onboarding/dashboard-schemas";

const intentBarClasses: Record<string, string> = {
  success: "bg-success",
  warning: "bg-warning",
  critical: "bg-destructive",
  default: "bg-primary/70",
};

const tooltipIntentClasses: Record<string, string> = {
  success: "border-success/40 bg-success text-success-foreground",
  warning: "border-warning/40 bg-warning text-warning-foreground",
  critical: "border-destructive/40 bg-destructive text-destructive-foreground",
  default: "border-primary/40 bg-primary text-primary-foreground",
};

const badgeIntentClasses: Record<string, string> = {
  success: "border-success/40 bg-success/15 text-success",
  warning: "border-warning/40 bg-warning/15 text-warning",
  critical: "border-destructive/40 bg-destructive/15 text-destructive",
  default: "border-primary/40 bg-primary/10 text-primary",
};

type FocusDistributionSummaryProps = {
  items: OnboardingDashboardData["global"]["focusDistribution"];
};

export function FocusDistributionSummary({ items }: FocusDistributionSummaryProps) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return (
    <Card className="sm:col-span-2 xl:col-span-3">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold tracking-tight sm:text-lg">Fokusverteilung</CardTitle>
          <Badge variant="outline" className="border-dashed border-muted-foreground/40 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            acting · tech · beide
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">Primäre Ausrichtung der Teilnehmenden nach Schwerpunkt.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Fokusdaten vorhanden.</p>
        ) : (
          <>
            <TooltipProvider delayDuration={120}>
              <div className="flex h-3 w-full overflow-hidden rounded-full border border-border/50 bg-muted/60">
                {items.map((item) => {
                  const percentage = item.percentage ?? 0;
                  const width = Math.max(0, Math.min(100, percentage));
                  const intent = item.intent ?? "default";
                  const barClass = intentBarClasses[intent] ?? intentBarClasses.default;

                  if (width <= 0) {
                    return null;
                  }

                  return (
                    <Tooltip key={item.label}>
                      <TooltipTrigger asChild>
                        <div
                          aria-label={`${item.label}: ${percentage.toFixed(1)} Prozent`}
                          style={{ width: `${width}%` }}
                          className={cn("h-full transition-all", barClass)}
                        />
                      </TooltipTrigger>
                      <TooltipContent className={cn("border px-3 py-2 text-xs font-medium", tooltipIntentClasses[intent] ?? tooltipIntentClasses.default)}>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-semibold">{item.label}</span>
                          <span>{percentage.toFixed(1)}% · {item.value.toLocaleString("de-DE")} Teilnehmende</span>
                          {total ? <span className="text-[11px] text-primary-foreground/80">{`von ${total.toLocaleString("de-DE")} gesamt`}</span> : null}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </TooltipProvider>
            <div className="flex flex-wrap gap-2 text-xs">
              {items.map((item) => {
                const percentage = item.percentage ?? 0;
                const intent = item.intent ?? "default";
                return (
                  <Badge
                    key={item.label}
                    variant="outline"
                    className={cn("gap-2", badgeIntentClasses[intent] ?? badgeIntentClasses.default)}
                  >
                    <span
                      className={cn("h-2 w-2 rounded-full", intentBarClasses[intent] ?? intentBarClasses.default)}
                      aria-hidden="true"
                    />
                    <span className="font-semibold text-foreground">{item.label}</span>
                    <span className="text-muted-foreground">{percentage.toFixed(1)}%</span>
                  </Badge>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

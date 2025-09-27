"use client";

import { motion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { z } from "zod";

import { kpiCardSchema } from "@/lib/onboarding/dashboard-schemas";

type MetricCardProps = {
  metric: z.infer<typeof kpiCardSchema>;
  index: number;
};

const intentStyles: Record<string, string> = {
  default: "bg-gradient-to-br from-muted/50 to-muted/20",
  success: "bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border-emerald-500/40",
  warning: "bg-gradient-to-br from-amber-500/20 to-amber-500/5 border-amber-500/40",
  critical: "bg-gradient-to-br from-rose-500/25 to-rose-500/5 border-rose-500/40",
};

const trendIntent: Record<string, string> = {
  up: "success",
  down: "critical",
  flat: "muted",
};

export function MetricCard({ metric, index }: MetricCardProps) {
  const intentClass = intentStyles[metric.intent ?? "default"] ?? intentStyles.default;
  const trendVariant = metric.trend ? trendIntent[metric.trend.direction] ?? "muted" : null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35, ease: "easeOut" }}
      className="h-full"
    >
      <Card className={`h-full border border-border/40 ${intentClass}`}>
        <CardHeader className="mb-3 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-base font-semibold tracking-tight sm:text-lg">
              {metric.label}
            </CardTitle>
            {metric.intent && metric.intent !== "default" ? (
              <Badge
                variant={metric.intent === "critical" ? "destructive" : metric.intent === "warning" ? "warning" : "success"}
                className="uppercase tracking-[0.08em]"
              >
                {metric.intent === "critical"
                  ? "kritisch"
                  : metric.intent === "warning"
                    ? "beobachten"
                    : "im grünen Bereich"}
              </Badge>
            ) : null}
          </div>
          {metric.helper ? (
            <p className="text-sm text-muted-foreground">{metric.helper}</p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {typeof metric.value === "number"
              ? metric.value.toLocaleString("de-DE", {
                  maximumFractionDigits: 1,
                })
              : metric.value}
          </div>
          {metric.trend ? (
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              <Badge variant={trendVariant === "success" ? "success" : trendVariant === "critical" ? "destructive" : "muted"}>
                {metric.trend.direction === "up"
                  ? "Trend steigend"
                  : metric.trend.direction === "down"
                    ? "Trend sinkend"
                    : "Stabil"}
              </Badge>
              {metric.trend.percentage !== undefined ? (
                <span>{metric.trend.percentage.toFixed(1)}%</span>
              ) : null}
              {metric.trend.label ? <span className="text-muted-foreground/80">{metric.trend.label}</span> : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </motion.div>
  );
}

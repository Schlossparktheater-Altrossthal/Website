"use client";

import { Fragment, useMemo } from "react";
import { motion } from "framer-motion";
import { scaleSequential } from "d3-scale";
import { interpolateYlGnBu } from "d3-scale-chromatic";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { z } from "zod";

import { heatmapCellSchema } from "@/lib/onboarding/dashboard-schemas";

type HeatmapCell = z.infer<typeof heatmapCellSchema>;

type RoleHeatmapProps = {
  title?: string;
  data: HeatmapCell[];
  subtitle?: string;
};

export function RoleHeatmap({ title = "Kombinationen", data, subtitle }: RoleHeatmapProps) {
  const axes = useMemo(() => {
    const acting = Array.from(new Set(data.map((cell) => cell.x))).sort();
    const crew = Array.from(new Set(data.map((cell) => cell.y))).sort();
    return { acting, crew };
  }, [data]);

  const cellLookup = useMemo(() => {
    const lookup = new Map<string, HeatmapCell>();
    for (const cell of data) {
      lookup.set(`${cell.x}__${cell.y}`, cell);
    }
    return lookup;
  }, [data]);

  const maxValue = useMemo(() => {
    return data.reduce((max, cell) => Math.max(max, cell.value), 0);
  }, [data]);

  const colorScale = useMemo(() => {
    const safeMax = maxValue > 0 ? maxValue : 1;
    return scaleSequential(interpolateYlGnBu).domain([0, safeMax]);
  }, [maxValue]);

  return (
    <Card className="h-full">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base font-semibold tracking-tight sm:text-lg">{title}</CardTitle>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Überschneidungen vorhanden.</p>
        ) : (
          <TooltipProvider delayDuration={120}>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>niedrig</span>
                <div className="h-1 flex-1 rounded-full bg-gradient-to-r from-sky-100 via-teal-300 to-emerald-600" />
                <span>hoch</span>
                <span className="ml-auto text-[11px] font-medium text-foreground/70">
                  max {maxValue.toFixed(2)}
                </span>
              </div>
              <div className="overflow-x-auto">
                <div
                  className="inline-grid gap-px rounded-2xl border border-border/60 bg-border/60 p-2"
                  style={{
                    gridTemplateColumns: `max-content repeat(${axes.crew.length || 1}, minmax(92px, 1fr))`,
                  }}
                >
                  <span className="flex h-16 items-center justify-center rounded-xl bg-background/80 px-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Acting ↓ / Crew →
                  </span>
                  {axes.crew.map((crewRole) => (
                    <span
                      key={crewRole}
                      className="flex h-16 items-center justify-center rounded-xl bg-background px-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                    >
                      {crewRole}
                    </span>
                  ))}
                  {axes.acting.map((actingRole) => (
                    <Fragment key={actingRole}>
                      <span className="flex h-16 items-center justify-center rounded-xl bg-background px-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                        {actingRole}
                      </span>
                      {axes.crew.map((crewRole, cellIndex) => {
                        const cellKey = `${actingRole}__${crewRole}`;
                        const cell = cellLookup.get(cellKey);
                        const value = cell?.value ?? 0;
                        const normalized = maxValue > 0 ? value / maxValue : 0;
                        const background = normalized === 0 ? "hsl(var(--muted) / 0.25)" : colorScale(value);
                        const textTone = normalized > 0.6 ? "text-white" : "text-foreground";
                        return (
                          <Tooltip key={cellKey}>
                            <TooltipTrigger asChild>
                              <motion.button
                                type="button"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: cellIndex * 0.03, duration: 0.35, ease: "easeOut" }}
                                className={`${textTone} relative flex h-16 flex-col items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-white/10 to-white/0 text-sm font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1`}
                                style={{
                                  background:
                                    normalized === 0
                                      ? "linear-gradient(135deg, hsl(var(--muted) / 0.35), hsl(var(--muted) / 0.2))"
                                      : `linear-gradient(135deg, ${background}, rgba(8, 47, 73, 0.18))`,
                                }}
                              >
                                <span>{cell ? value.toFixed(2) : "–"}</span>
                                <span className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-foreground/70">
                                  {cell ? `${Math.round(normalized * 100)}%` : "kein Wert"}
                                </span>
                              </motion.button>
                            </TooltipTrigger>
                            <TooltipContent className="space-y-1">
                              <p className="text-sm font-semibold text-primary-foreground">
                                {actingRole} × {crewRole}
                              </p>
                              <p className="text-xs text-primary-foreground/80">
                                {cell
                                  ? `${value.toFixed(2)} kombinierte Präferenzen`
                                  : "Keine gemeinsame Präferenz erfasst."}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </Fragment>
                  ))}
                </div>
              </div>
            </div>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
}

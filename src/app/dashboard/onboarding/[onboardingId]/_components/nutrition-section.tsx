"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { z } from "zod";

import { nutritionBreakdownSchema } from "@/lib/onboarding/dashboard-schemas";

type NutritionSectionProps = {
  data: z.infer<typeof nutritionBreakdownSchema>;
  totalParticipants: number;
  className?: string;
};

const dietPalette = [
  "#5eead4",
  "#60a5fa",
  "#fbbf24",
  "#f97316",
  "#f87171",
  "#c084fc",
];

const severityOrder = ["mild", "moderat", "schwer", "akut"];

export function NutritionSection({ data, totalParticipants, className }: NutritionSectionProps) {
  const totalDiets = data.diets.reduce((sum, entry) => sum + entry.count, 0);
  const donutGradient = useMemo(() => {
    if (!data.diets.length) {
      return "conic-gradient(#94a3b8 0deg 360deg)";
    }
    let currentAngle = 0;
    const segments = data.diets.map((entry, index) => {
      const ratio = totalDiets > 0 ? entry.count / totalDiets : 0;
      const degrees = ratio * 360;
      const start = currentAngle;
      const end = currentAngle + degrees;
      currentAngle = end;
      const color = dietPalette[index % dietPalette.length];
      return `${color} ${start}deg ${end}deg`;
    });
    return `conic-gradient(${segments.join(", ")})`;
  }, [data.diets, totalDiets]);

  return (
    <Card className={cn("h-full", className)}>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base font-semibold tracking-tight sm:text-lg">Ernährung & Allergien</CardTitle>
        <p className="text-sm text-muted-foreground">
          Überblick über Ernährungspräferenzen und gemeldete Unverträglichkeiten.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="flex flex-1 items-center gap-4">
            <div
              className="h-36 w-36 rounded-full border border-border/40 shadow-inner"
              style={{ background: donutGradient }}
            >
              <div className="flex h-full w-full items-center justify-center">
                <span className="text-sm font-semibold text-foreground/80">
                  {totalDiets > 0 ? `${Math.round((totalDiets / Math.max(totalParticipants, 1)) * 100)}%` : "–"}
                </span>
              </div>
            </div>
            <ul className="flex-1 space-y-2 text-sm">
              {data.diets.length === 0 ? (
                <li className="text-muted-foreground">Keine Angaben zu Ernährungspräferenzen vorhanden.</li>
              ) : (
                data.diets.map((entry, index) => (
                  <li key={entry.label} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span
                        className="h-2.5 w-6 rounded-full"
                        style={{ backgroundColor: dietPalette[index % dietPalette.length] }}
                        aria-hidden
                      />
                      {entry.label}
                    </span>
                    <span className="font-medium">{entry.count}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Allergien nach Schweregrad
          </h4>
          {data.allergies.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Allergien gemeldet.</p>
          ) : (
            <div className="space-y-2">
              {data.allergies.map((entry) => {
                const total = severityOrder.reduce((sum, key) => sum + (entry.severities[key] ?? 0), 0);
                return (
                  <div key={entry.allergen} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground/80">{entry.allergen}</span>
                      <span className="text-muted-foreground">{total} Meldungen</span>
                    </div>
                    <div className="flex h-2 overflow-hidden rounded-full border border-border/30 bg-muted/40">
                      {severityOrder.map((severity, index) => {
                        const value = entry.severities[severity] ?? 0;
                        if (value <= 0) {
                          return null;
                        }
                        const width = `${Math.max(4, (value / Math.max(total, 1)) * 100)}%`;
                        const colors = ["bg-emerald-400", "bg-amber-400", "bg-orange-500", "bg-rose-500"];
                        return (
                          <motion.div
                            key={severity}
                            initial={{ width: 0 }}
                            animate={{ width }}
                            transition={{ duration: 0.4, delay: index * 0.05 }}
                            className={cn("h-full", colors[index])}
                          />
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {severityOrder.map((severity) => {
                        const value = entry.severities[severity] ?? 0;
                        return value > 0 ? (
                          <span key={severity}>
                            {severity}: {value}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

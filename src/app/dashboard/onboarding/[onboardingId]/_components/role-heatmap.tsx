"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  const maxValue = useMemo(() => {
    return data.reduce((max, cell) => Math.max(max, cell.value), 0) || 1;
  }, [data]);

  return (
    <Card className="h-full">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base font-semibold tracking-tight sm:text-lg">{title}</CardTitle>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Überschneidungen vorhanden.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr>
                  <th className="p-2 text-left text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Acting ↓ / Crew →
                  </th>
                  {axes.crew.map((crewRole) => (
                    <th
                      key={crewRole}
                      className="px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                    >
                      {crewRole}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {axes.acting.map((actingRole) => (
                  <tr key={actingRole}>
                    <th className="whitespace-nowrap px-2 py-1 text-left text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {actingRole}
                    </th>
                    {axes.crew.map((crewRole, cellIndex) => {
                      const cell = data.find((item) => item.x === actingRole && item.y === crewRole);
                      const intensity = cell ? Math.min(1, cell.value / maxValue) : 0;
                      const background = `rgba(45,212,191,${0.12 + intensity * 0.55})`;
                      return (
                        <td key={crewRole} className="px-2 py-1 text-center align-middle">
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: intensity, scale: 1 }}
                            transition={{ delay: cellIndex * 0.02, duration: 0.3 }}
                            className="flex h-8 items-center justify-center rounded-md border border-border/30"
                            style={{ backgroundColor: background }}
                          >
                            <span className="text-xs font-medium text-foreground/80">
                              {cell ? cell.value.toFixed(2) : "–"}
                            </span>
                          </motion.div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

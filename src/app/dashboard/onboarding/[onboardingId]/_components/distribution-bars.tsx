"use client";

import { motion } from "framer-motion";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { z } from "zod";

import { distributionEntrySchema } from "@/lib/onboarding/dashboard-schemas";

type DistributionBarsProps = {
  title: string;
  items: Array<z.infer<typeof distributionEntrySchema>>;
  subtitle?: string;
  className?: string;
};

const intentPalette: Record<string, string> = {
  default: "bg-primary/40",
  success: "bg-emerald-500/80",
  warning: "bg-amber-500/80",
  critical: "bg-rose-500/80",
};

export function DistributionBars({ title, items, subtitle, className }: DistributionBarsProps) {
  return (
    <Card className={cn("h-full", className)}>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base font-semibold tracking-tight sm:text-lg">{title}</CardTitle>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Daten vorhanden.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item, index) => {
              const width = Math.min(100, item.percentage ?? item.value ?? 0);
              const palette = intentPalette[item.intent ?? "default"] ?? intentPalette.default;
              return (
                <li key={item.label} className="space-y-1">
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span>{item.value.toLocaleString("de-DE", { maximumFractionDigits: 1 })}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/60">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${width}%` }}
                      transition={{ delay: index * 0.04, duration: 0.4, ease: "easeOut" }}
                      className={`h-full rounded-full ${palette}`}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

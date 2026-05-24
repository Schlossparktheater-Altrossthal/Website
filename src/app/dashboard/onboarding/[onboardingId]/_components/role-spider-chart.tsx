"use client";

import { useEffect, useId, useMemo, useState } from "react";
import type { TooltipContentProps, TooltipProps } from "recharts";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  Tooltip,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type RolePreference = {
  label: string;
  value: number;
  maxValue?: number;
};

type RoleSpiderChartProps = {
  data: RolePreference[];
  title?: string;
  subtitle?: string;
  size?: number;
  accentColor?: string;
};

const percentFormatter = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
const FALLBACK_ACCENT = "oklch(0.66 0.18 63.3)";

function normalizeCssColor(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return null;
  }

  if (/^(#|rgb|hsl|oklch|oklab|lab|lch|color|var)\(/i.test(trimmedValue)) {
    return trimmedValue;
  }

  return `hsl(${trimmedValue})`;
}

function useResolvedAccentColor(accentColor?: string): string {
  const normalizedPropColor = normalizeCssColor(accentColor);
  const [resolvedAccent, setResolvedAccent] = useState<string>(
    () => normalizedPropColor ?? accentColor ?? FALLBACK_ACCENT,
  );

  useEffect(() => {
    if (accentColor) {
      const normalizedColor = normalizeCssColor(accentColor);
      setResolvedAccent(normalizedColor ?? accentColor);
      return;
    }

    const root = document.documentElement;
    const primaryValue = getComputedStyle(root).getPropertyValue("--primary");
    const normalizedPrimary = normalizeCssColor(primaryValue);

    setResolvedAccent(normalizedPrimary ?? FALLBACK_ACCENT);
  }, [accentColor]);

  return resolvedAccent;
}

type ChartEntry = {
  label: string;
  value: number;
  maxValue: number;
};

export function RoleSpiderChart({
  data,
  title = "Rollenpräferenzen",
  subtitle = "Verteilung der Rollengrößen-Präferenzen",
  size = 240,
  accentColor,
}: RoleSpiderChartProps) {
  const chartId = useId();
  const accent = useResolvedAccentColor(accentColor);

  const { chartData } = useMemo(() => {
    if (data.length === 0) {
      return {
        chartData: [] as ChartEntry[],
        maxValue: 1,
      };
    }

    const hasExplicitMax = data.some((entry) => entry.maxValue !== undefined);
    const values = data.map((entry) => entry.maxValue ?? entry.value);
    const computedMax = Math.max(...values, hasExplicitMax ? 1 : 100);
    const mapped: ChartEntry[] = data.map((entry) => ({
      label: entry.label,
      value: entry.value,
      maxValue: entry.maxValue ?? computedMax,
    }));

    return { chartData: mapped, maxValue: computedMax };
  }, [data]);

  const levelCount = 4;
  const safeSize = Math.max(size, 220);
  const accentStroke = `url(#spider-stroke-${chartId})`;
  const accentFill = `url(#spider-fill-${chartId})`;

  const normalizedChartData = useMemo(
    () =>
      chartData.map((entry) => {
        const normalized = entry.maxValue === 0 ? 0 : (entry.value / entry.maxValue) * 100;
        const clamped = Number.isFinite(normalized) ? Math.max(0, Math.min(100, normalized)) : 0;

        return {
          label: entry.label,
          value: entry.value,
          normalized: clamped,
          maxValue: entry.maxValue,
        };
      }),
    [chartData],
  );

  const tooltipLabelFormatter = (value: string | number) => (typeof value === "string" ? value : `${value}%`);

  const renderTooltip = ({ active, payload }: TooltipContentProps<number, string>) => {
    if (!active || !payload?.length) {
      return null;
    }

    const [{ payload: entry }] = payload;
    if (!entry || typeof entry !== "object") {
      return null;
    }

    return (
      <div className="rounded-md border border-border/60 bg-background/95 px-3 py-2 text-xs shadow-md">
        <p className="font-semibold text-foreground">{entry.label}</p>
        <p className="text-muted-foreground">{percentFormatter.format(entry.value)}%</p>
      </div>
    );
  };

  if (chartData.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">Keine Präferenzdaten verfügbar</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent className="flex items-center justify-center p-6">
        <div
          className="w-full max-w-full"
          style={{
            maxWidth: safeSize,
          }}
        >
          <RadarChart
            data={normalizedChartData}
            width={safeSize}
            height={safeSize}
            outerRadius="70%"
          >
            <title id={`${chartId}-title`}>{title}</title>
            <defs>
              <linearGradient id={`spider-fill-${chartId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity={0.45} />
                <stop offset="100%" stopColor={accent} stopOpacity={0.15} />
              </linearGradient>
              <linearGradient id={`spider-stroke-${chartId}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity={0.7} />
                <stop offset="100%" stopColor={accent} stopOpacity={0.4} />
              </linearGradient>
            </defs>

            <PolarGrid
              gridType="polygon"
              stroke="hsl(var(--border))"
              strokeOpacity={0.4}
            />
            <PolarAngleAxis
              dataKey="label"
              tickLine={false}
              tick={{
                fill: "hsl(var(--foreground))",
                fontSize: 11,
              }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tickCount={levelCount}
              tick={{
                fill: "hsl(var(--muted-foreground))",
                fontSize: 10,
              }}
              tickFormatter={(value) => `${percentFormatter.format(value)}%`}
            />
            <Radar
              name="Präferenz"
              dataKey="normalized"
              stroke={accentStroke}
              fill={accentFill}
              fillOpacity={1}
              strokeWidth={2}
            />
            <Tooltip
              cursor={{
                stroke: accent,
                strokeWidth: 1,
                fill: "transparent",
              }}
              content={renderTooltip as TooltipProps<number, string>["content"]}
              labelFormatter={tooltipLabelFormatter}
            />
          </RadarChart>
        </div>
      </CardContent>
    </Card>
  );
}
"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import type { TickItemTextProps } from "recharts/types/polar/PolarAngleAxis";

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

function parseCoordinate(value: number | string | undefined): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}

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

  const { chartData, maxValue } = useMemo(() => {
    if (data.length === 0) {
      return {
        chartData: [] as ChartEntry[],
        maxValue: 1,
      };
    }

    const computedMax = Math.max(...data.map((entry) => entry.maxValue ?? entry.value), 1);
    const mapped: ChartEntry[] = data.map((entry) => ({
      label: entry.label,
      value: entry.value,
      maxValue: entry.maxValue ?? computedMax,
    }));

    return { chartData: mapped, maxValue: computedMax };
  }, [data]);

  const renderAngleTick = useCallback(
    ({ payload, x, y }: TickItemTextProps) => {
      if (!payload || !payload.payload) {
        return <g />;
      }

      const entry = payload.payload as ChartEntry;
      const center = size / 2;
      const xCoord = parseCoordinate(x);
      const yCoord = parseCoordinate(y);
      const textAnchor =
        xCoord > center + 6
          ? "start"
          : xCoord < center - 6
            ? "end"
            : ("middle" as const);
      const labelWidth = 120;
      const labelHeight = 34;
      const rectX =
        textAnchor === "end" ? -labelWidth : textAnchor === "middle" ? -labelWidth / 2 : 0;

      return (
        <g transform={`translate(${xCoord}, ${yCoord})`}>
          <rect
            x={rectX}
            y={-labelHeight / 2}
            width={labelWidth}
            height={labelHeight}
            rx={8}
            fill="hsl(var(--background))"
            opacity={0.92}
            stroke="hsl(var(--border))"
            strokeWidth={0.5}
          />
          <text
            x={0}
            y={-4}
            textAnchor={textAnchor}
            className="text-[10px] font-semibold fill-foreground"
            dominantBaseline="middle"
          >
            {payload.value as string}
          </text>
          <text
            x={0}
            y={8}
            textAnchor={textAnchor}
            className="text-[9px] font-medium fill-muted-foreground"
            dominantBaseline="middle"
          >
            {`${percentFormatter.format(entry.value)}%`}
          </text>
        </g>
      );
    },
    [size],
  );

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

  const radialTicks = 4;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent className="flex items-center justify-center p-6">
        <div className="w-full" style={{ maxWidth: size, height: size }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart
              data={chartData}
              cx="50%"
              cy="50%"
              outerRadius="70%"
              startAngle={-90}
              endAngle={270}
            >
              <defs>
                <linearGradient id={`spider-fill-${chartId}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={accent} stopOpacity={0.15} />
                </linearGradient>
                <linearGradient id={`spider-stroke-${chartId}`} x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0%" stopColor={accent} stopOpacity={0.7} />
                  <stop offset="100%" stopColor={accent} stopOpacity={0.4} />
                </linearGradient>
              </defs>

              <PolarGrid
                radialLines
                gridType="polygon"
                stroke="hsl(var(--border))"
                strokeOpacity={0.4}
              />
              <PolarAngleAxis
                dataKey="label"
                tick={renderAngleTick}
                tickLine={false}
                axisLine={false}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, maxValue]}
                tickCount={radialTicks}
                tickFormatter={(value) => `${percentFormatter.format(value)}%`}
                tick={{ className: "text-[9px] fill-muted-foreground" }}
                axisLine={false}
              />
              <Radar
                name="Präferenz"
                dataKey="value"
                stroke={`url(#spider-stroke-${chartId})`}
                strokeWidth={2}
                fill={`url(#spider-fill-${chartId})`}
                fillOpacity={1}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
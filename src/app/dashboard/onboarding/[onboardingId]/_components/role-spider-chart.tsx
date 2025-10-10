"use client";

import { useEffect, useId, useMemo, useState } from "react";

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

type RadarPoint = ChartEntry & {
  angle: number;
  axisX: number;
  axisY: number;
  pointX: number;
  pointY: number;
  labelX: number;
  labelY: number;
  textAnchor: "start" | "middle" | "end";
};

function polarToCartesian(center: number, radius: number, angle: number) {
  return {
    x: center + radius * Math.cos(angle),
    y: center + radius * Math.sin(angle),
  };
}

function computeTextAnchor(angle: number) {
  const cos = Math.cos(angle);
  if (cos > 0.3) return "start";
  if (cos < -0.3) return "end";
  return "middle";
}

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
  const safeSize = Math.max(size, 200);
  const padding = 28;
  const chartSize = safeSize - padding * 2;
  const radius = chartSize / 2;
  const center = padding + radius;
  const points: RadarPoint[] = useMemo(() => {
    if (chartData.length === 0) {
      return [];
    }

    const angleStep = (Math.PI * 2) / chartData.length;

    return chartData.map((entry, index) => {
      const angle = angleStep * index - Math.PI / 2;
      const axis = polarToCartesian(center, radius, angle);
      const normalized = entry.maxValue === 0 ? 0 : entry.value / entry.maxValue;
      const clamped = Number.isFinite(normalized) ? Math.max(0, Math.min(1, normalized)) : 0;
      const point = polarToCartesian(center, radius * clamped, angle);
      const labelPosition = polarToCartesian(center, radius + 22, angle);
      const anchor = computeTextAnchor(angle);

      return {
        ...entry,
        angle,
        axisX: axis.x,
        axisY: axis.y,
        pointX: point.x,
        pointY: point.y,
        labelX: labelPosition.x,
        labelY: labelPosition.y,
        textAnchor: anchor,
      };
    });
  }, [center, chartData, radius]);

  const gridPolygons = useMemo(() => {
    if (chartData.length === 0) {
      return [] as string[];
    }

    const angleStep = (Math.PI * 2) / chartData.length;

    return Array.from({ length: levelCount }, (_, levelIndex) => {
      const ratio = (levelIndex + 1) / levelCount;
      const coords = chartData.map((_, index) => {
        const angle = angleStep * index - Math.PI / 2;
        const vertex = polarToCartesian(center, radius * ratio, angle);
        return `${vertex.x},${vertex.y}`;
      });
      return coords.join(" ");
    });
  }, [center, chartData, radius, levelCount]);

  const outlinePath = useMemo(() => {
    if (points.length === 0) {
      return "";
    }

    return points
      .map((point, index) => `${index === 0 ? "M" : "L"}${point.pointX} ${point.pointY}`)
      .join(" ")
      .concat(" Z");
  }, [points]);

  const accentStroke = `url(#spider-stroke-${chartId})`;
  const accentFill = `url(#spider-fill-${chartId})`;

  const radialLabels = useMemo(() => {
    const step = maxValue / levelCount;
    return Array.from({ length: levelCount }, (_, index) => {
      const value = step * (index + 1);
      return `${percentFormatter.format(value)}%`;
    });
  }, [levelCount, maxValue]);

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
        <svg
          viewBox={`0 0 ${safeSize} ${safeSize}`}
          width="100%"
          height="100%"
          style={{ maxWidth: size, maxHeight: size }}
          role="img"
          aria-labelledby={`${chartId}-title`}
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

          {gridPolygons.map((polygon, index) => (
            <g key={`grid-${index}`}>
              <polygon
                points={polygon}
                fill="none"
                stroke="hsl(var(--border))"
                strokeWidth={0.6}
                strokeOpacity={0.4}
              />
              <text
                x={center}
                y={center - (radius * (index + 1)) / levelCount - 2}
                textAnchor="middle"
                className="text-[9px] fill-muted-foreground"
              >
                {radialLabels[index]}
              </text>
            </g>
          ))}

          {points.map((point) => (
            <line
              key={`axis-${point.label}`}
              x1={center}
              y1={center}
              x2={point.axisX}
              y2={point.axisY}
              stroke="hsl(var(--border))"
              strokeWidth={0.6}
              strokeOpacity={0.4}
            />
          ))}

          {outlinePath && (
            <path
              d={outlinePath}
              fill={accentFill}
              stroke={accentStroke}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          )}

          {points.map((point) => (
            <circle
              key={`point-${point.label}`}
              cx={point.pointX}
              cy={point.pointY}
              r={3.5}
              fill="hsl(var(--background))"
              stroke={accent}
              strokeWidth={1.5}
            />
          ))}

          {points.map((point) => (
            <g key={`label-${point.label}`} transform={`translate(${point.labelX}, ${point.labelY})`}>
              <rect
                x={point.textAnchor === "middle" ? -60 : point.textAnchor === "end" ? -120 : 0}
                y={-16}
                width={120}
                height={32}
                rx={8}
                fill="hsl(var(--background))"
                opacity={0.92}
                stroke="hsl(var(--border))"
                strokeWidth={0.5}
              />
              <text
                x={point.textAnchor === "middle" ? 0 : point.textAnchor === "end" ? -6 : 6}
                y={-2}
                textAnchor={point.textAnchor}
                className="text-[10px] font-semibold fill-foreground"
              >
                {point.label}
              </text>
              <text
                x={point.textAnchor === "middle" ? 0 : point.textAnchor === "end" ? -6 : 6}
                y={10}
                textAnchor={point.textAnchor}
                className="text-[9px] font-medium fill-muted-foreground"
              >
                {`${percentFormatter.format(point.value)}%`}
              </text>
            </g>
          ))}
        </svg>
      </CardContent>
    </Card>
  );
}
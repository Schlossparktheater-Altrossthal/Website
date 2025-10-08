"use client";

import { useId, useMemo } from "react";
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

export function RoleSpiderChart({
  data,
  title = "Rollenpräferenzen",
  subtitle = "Verteilung der Rollengrößen-Präferenzen",
  size = 220,
  accentColor,
}: RoleSpiderChartProps) {
  const chartId = useId();
  const accent = accentColor ?? "hsl(var(--primary))";

  const { pathData, labels, maxValue, center, radius, angleStep, points } = useMemo(() => {
    if (data.length === 0) {
      const fallbackCenter = size / 2;
      const fallbackRadius = (size - 72) / 2;
      return {
        pathData: "",
        labels: [],
        maxValue: 1,
        center: fallbackCenter,
        radius: fallbackRadius,
        angleStep: 0,
        points: [],
      };
    }

    const max = Math.max(...data.map((entry) => entry.maxValue ?? entry.value));
    const computedCenter = size / 2;
    const computedRadius = (size - 72) / 2;
    const computedAngleStep = (2 * Math.PI) / data.length;

    const calculatedPoints = data.map((item, index) => {
      const angle = index * computedAngleStep - Math.PI / 2;
      const normalizedValue = max === 0 ? 0 : (item.value / max) * computedRadius;
      const x = computedCenter + normalizedValue * Math.cos(angle);
      const y = computedCenter + normalizedValue * Math.sin(angle);
      const axisX = computedCenter + computedRadius * Math.cos(angle);
      const axisY = computedCenter + computedRadius * Math.sin(angle);

      return {
        x,
        y,
        axisX,
        axisY,
        angle,
        value: item.value,
        label: item.label,
      };
    });

    const path =
      calculatedPoints.length > 0
        ? `M${calculatedPoints.map((point) => `${point.x},${point.y}`).join("L")}Z`
        : "";

    const calculatedLabels = calculatedPoints.map((point) => {
      const labelRadius = computedRadius + 26;
      const x = computedCenter + labelRadius * Math.cos(point.angle);
      const y = computedCenter + labelRadius * Math.sin(point.angle);

      return {
        x,
        y,
        angle: point.angle,
        label: point.label,
        value: point.value,
      };
    });

    return {
      pathData: path,
      labels: calculatedLabels,
      maxValue: max,
      center: computedCenter,
      radius: computedRadius,
      angleStep: computedAngleStep,
      points: calculatedPoints,
    };
  }, [data, size]);

  if (data.length === 0) {
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

  const ringSteps = 4;
  const ringFactors = Array.from({ length: ringSteps }, (_, index) => (index + 1) / ringSteps);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent className="flex items-center justify-center p-6">
        <svg width={size} height={size} className="overflow-visible" role="img" aria-label={title}>
          <defs>
            <linearGradient id={`spider-fill-${chartId}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.45" />
              <stop offset="100%" stopColor={accent} stopOpacity="0.15" />
            </linearGradient>
            <linearGradient id={`spider-stroke-${chartId}`} x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity="0.7" />
              <stop offset="100%" stopColor={accent} stopOpacity="0.4" />
            </linearGradient>
            <filter id={`spider-shadow-${chartId}`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor={accent} floodOpacity="0.12" />
            </filter>
          </defs>

          <circle
            cx={center}
            cy={center}
            r={radius + 18}
            fill="hsl(var(--muted) / 0.18)"
            stroke="hsl(var(--border))"
            strokeWidth="0.75"
          />

          {ringFactors.map((factor, index) => {
            const ringRadius = radius * factor;
            const ringPoints = Array.from({ length: data.length }, (_, pointIndex) => {
              const angle = pointIndex * angleStep - Math.PI / 2;
              const x = center + ringRadius * Math.cos(angle);
              const y = center + ringRadius * Math.sin(angle);
              return `${x},${y}`;
            }).join(" ");

            return (
              <polygon
                key={`ring-${factor}`}
                points={ringPoints}
                fill={index % 2 === 0 ? "hsl(var(--background))" : "hsl(var(--muted) / 0.1)"}
                stroke="hsl(var(--border))"
                strokeWidth="0.75"
                opacity={factor === 1 ? 0.75 : 0.45}
              />
            );
          })}

          {points.map((point) => (
            <line
              key={`axis-${point.label}`}
              x1={center}
              y1={center}
              x2={point.axisX}
              y2={point.axisY}
              stroke="hsl(var(--border))"
              strokeWidth="0.75"
              strokeOpacity={0.35}
            />
          ))}

          <circle cx={center} cy={center} r={4} fill={accent} fillOpacity={0.6} />

          <path
            d={pathData}
            fill={`url(#spider-fill-${chartId})`}
            stroke={`url(#spider-stroke-${chartId})`}
            strokeWidth={2}
            strokeLinejoin="round"
            filter={`url(#spider-shadow-${chartId})`}
          />

          {points.map((point) => (
            <g key={`point-${point.label}`}>
              <circle
                cx={point.x}
                cy={point.y}
                r={3.5}
                fill="hsl(var(--background))"
                stroke={accent}
                strokeWidth={1.5}
              />
              <circle
                cx={point.x}
                cy={point.y}
                r={1.4}
                fill={accent}
              />
            </g>
          ))}

          {ringFactors.map((factor) => {
            const ringValue = maxValue * factor;
            return (
              <text
                key={`ring-label-${factor}`}
                x={center}
                y={center - radius * factor - 6}
                textAnchor="middle"
                className="text-[9px] fill-muted-foreground"
              >
                {`${percentFormatter.format(ringValue)}%`}
              </text>
            );
          })}

          {labels.map((label, index) => {
            let textAnchor: "start" | "middle" | "end" = "middle";
            if (label.x > center + 6) textAnchor = "start";
            else if (label.x < center - 6) textAnchor = "end";

            const valueLabel = `${percentFormatter.format(label.value)}%`;
            const labelWidth = 120;
            const labelHeight = 34;
            const rectX =
              textAnchor === "end"
                ? -labelWidth
                : textAnchor === "middle"
                  ? -labelWidth / 2
                  : 0;

            return (
              <g key={`label-${index}`} transform={`translate(${label.x}, ${label.y})`}>
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
                  {label.label}
                </text>
                <text
                  x={0}
                  y={8}
                  textAnchor={textAnchor}
                  className="text-[9px] font-medium fill-muted-foreground"
                  dominantBaseline="middle"
                >
                  {valueLabel}
                </text>
              </g>
            );
          })}
        </svg>
      </CardContent>
    </Card>
  );
}
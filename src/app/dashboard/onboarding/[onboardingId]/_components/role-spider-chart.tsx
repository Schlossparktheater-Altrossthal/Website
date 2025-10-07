"use client";

import { useMemo } from "react";
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
};

export function RoleSpiderChart({ 
  data, 
  title = "Rollenpräferenzen", 
  subtitle = "Verteilung der Rollengrößen-Präferenzen",
  size = 200 
}: RoleSpiderChartProps) {
  const { pathData, labels, maxValue } = useMemo(() => {
    if (data.length === 0) return { pathData: "", labels: [], maxValue: 1 };
    
    const max = Math.max(...data.map(d => d.maxValue || d.value));
    const center = size / 2;
    const radius = (size - 60) / 2; // Abstand für Labels
    const angleStep = (2 * Math.PI) / data.length;
    
    // Punkte für das Polygon berechnen
    const points = data.map((item, index) => {
      const angle = index * angleStep - Math.PI / 2; // Start oben
      const normalizedValue = (item.value / max) * radius;
      const x = center + normalizedValue * Math.cos(angle);
      const y = center + normalizedValue * Math.sin(angle);
      return { x, y };
    });
    
    // SVG Path erstellen
    const pathData = points.length > 0 
      ? `M${points.map(p => `${p.x},${p.y}`).join('L')}Z`
      : "";
    
    // Label-Positionen berechnen
    const labels = data.map((item, index) => {
      const angle = index * angleStep - Math.PI / 2;
      const labelRadius = radius + 20;
      const x = center + labelRadius * Math.cos(angle);
      const y = center + labelRadius * Math.sin(angle);
      
      return {
        x,
        y,
        label: item.label,
        value: item.value,
        angle
      };
    });
    
    return { pathData, labels, maxValue: max };
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

  const center = size / 2;
  const radius = (size - 60) / 2;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardHeader>
      <CardContent className="flex items-center justify-center p-4">
        <svg width={size} height={size} className="overflow-visible">
          {/* Rasterlinien */}
          {[0.2, 0.4, 0.6, 0.8, 1.0].map((factor) => {
            const r = radius * factor;
            const angleStep = (2 * Math.PI) / data.length;
            const points = Array.from({ length: data.length }, (_, index) => {
              const angle = index * angleStep - Math.PI / 2;
              const x = center + r * Math.cos(angle);
              const y = center + r * Math.sin(angle);
              return `${x},${y}`;
            }).join(' ');
            
            return (
              <polygon
                key={factor}
                points={points}
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth="0.5"
                opacity={factor === 1.0 ? 0.8 : 0.3}
              />
            );
          })}
          
          {/* Achsen */}
          {data.map((_, index) => {
            const angleStep = (2 * Math.PI) / data.length;
            const angle = index * angleStep - Math.PI / 2;
            const x2 = center + radius * Math.cos(angle);
            const y2 = center + radius * Math.sin(angle);
            
            return (
              <line
                key={`axis-${index}`}
                x1={center}
                y1={center}
                x2={x2}
                y2={y2}
                stroke="hsl(var(--muted))"
                strokeWidth="0.5"
                opacity="0.4"
              />
            );
          })}
          
          {/* Datenpfad */}
          <path
            d={pathData}
            fill="hsl(var(--primary))"
            fillOpacity="0.2"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          
          {/* Datenpunkte */}
          {data.map((item, index) => {
            const angleStep = (2 * Math.PI) / data.length;
            const angle = index * angleStep - Math.PI / 2;
            const normalizedValue = (item.value / maxValue) * radius;
            const x = center + normalizedValue * Math.cos(angle);
            const y = center + normalizedValue * Math.sin(angle);
            
            return (
              <circle
                key={`point-${index}`}
                cx={x}
                cy={y}
                r="3"
                fill="hsl(var(--primary))"
                stroke="hsl(var(--background))"
                strokeWidth="2"
              />
            );
          })}
          
          {/* Labels */}
          {labels.map((label, index) => {
            // Text-Anker basierend auf Position bestimmen
            let textAnchor: "start" | "middle" | "end" = "middle";
            if (label.x > center + 5) textAnchor = "start";
            else if (label.x < center - 5) textAnchor = "end";
            
            return (
              <g key={`label-${index}`}>
                <text
                  x={label.x}
                  y={label.y - 2}
                  textAnchor={textAnchor}
                  className="text-[10px] font-medium fill-foreground"
                  dominantBaseline="middle"
                >
                  {label.label}
                </text>
                <text
                  x={label.x}
                  y={label.y + 8}
                  textAnchor={textAnchor}
                  className="text-[9px] fill-muted-foreground"
                  dominantBaseline="middle"
                >
                  {label.value.toFixed(0)}%
                </text>
              </g>
            );
          })}
        </svg>
      </CardContent>
    </Card>
  );
}
import * as React from "react";

import { cn } from "@/lib/utils";

type ProgressRingProps = {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  /** Text in der Mitte; Standard „value/max“. */
  label?: React.ReactNode;
  className?: string;
};

/** Kreisförmiger Fortschritt, z. B. für die Profil-Vollständigkeit. */
export function ProgressRing({
  value,
  max,
  size = 44,
  strokeWidth = 4,
  label,
  className,
}: ProgressRingProps) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const complete = ratio >= 1;
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${value} von ${max} erledigt`}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          className={cn(
            "transition-[stroke-dashoffset] duration-500",
            complete ? "stroke-success" : "stroke-primary",
          )}
        />
      </svg>
      <span className="absolute text-[0.7rem] font-semibold tabular-nums text-foreground">
        {label ?? `${value}/${max}`}
      </span>
    </span>
  );
}

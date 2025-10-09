"use client";

import React, { forwardRef, useId, useMemo, useState } from "react";

import {
  MEASUREMENT_TYPE_DESCRIPTIONS,
  MEASUREMENT_TYPE_LABELS,
  type MeasurementType,
} from "@/data/measurements";

type MeasurementTypeSelectorProps = {
  name?: string;
  value?: MeasurementType;
  onChange?: (value: MeasurementType) => void;
  disabled?: boolean;
};

type MeasurementArea = {
  type: MeasurementType;
  label: string;
  description: string;
  svg: JSX.Element;
};

const BASE_FILL = "fill-muted/60";
const ACTIVE_FILL = "fill-primary/70";
const ACTIVE_STROKE = "stroke-primary";

const AREAS: MeasurementArea[] = [
  {
    type: "HEIGHT",
    label: MEASUREMENT_TYPE_LABELS.HEIGHT,
    description: MEASUREMENT_TYPE_DESCRIPTIONS.HEIGHT,
    svg: (
      <path
        d="M100 40c-14 0-26 12-26 26s12 26 26 26 26-12 26-26S114 40 100 40Zm-24 70c-11 0-20 9-20 20v28c0 15 12 28 28 28h32c15 0 28-13 28-28v-28c0-11-9-20-20-20Zm-28 102c-10 0-18 8-18 18 0 22 18 40 40 40h56c22 0 40-18 40-40 0-10-8-18-18-18Zm8 94c-8 0-14 6-14 14 0 28 20 52 46 52h40c26 0 46-24 46-52 0-8-6-14-14-14Zm10 98c-8 0-16 6-16 14 0 34 24 62 54 62s54-28 54-62c0-8-8-14-16-14Z"
      />
    ),
  },
  {
    type: "CHEST",
    label: MEASUREMENT_TYPE_LABELS.CHEST,
    description: MEASUREMENT_TYPE_DESCRIPTIONS.CHEST,
    svg: <rect x="58" y="132" width="84" height="58" rx="26" />,
  },
  {
    type: "WAIST",
    label: MEASUREMENT_TYPE_LABELS.WAIST,
    description: MEASUREMENT_TYPE_DESCRIPTIONS.WAIST,
    svg: <rect x="54" y="190" width="92" height="52" rx="24" />,
  },
  {
    type: "HIPS",
    label: MEASUREMENT_TYPE_LABELS.HIPS,
    description: MEASUREMENT_TYPE_DESCRIPTIONS.HIPS,
    svg: <rect x="50" y="242" width="100" height="60" rx="30" />,
  },
  {
    type: "INSEAM",
    label: MEASUREMENT_TYPE_LABELS.INSEAM,
    description: MEASUREMENT_TYPE_DESCRIPTIONS.INSEAM,
    svg: (
      <path d="M76 302c-9 0-16 7-16 16v112c0 11 9 20 20 20h8l12-108 12 108h8c11 0 20-9 20-20V318c0-9-7-16-16-16Z" />
    ),
  },
  {
    type: "SHOULDER",
    label: MEASUREMENT_TYPE_LABELS.SHOULDER,
    description: MEASUREMENT_TYPE_DESCRIPTIONS.SHOULDER,
    svg: <rect x="48" y="112" width="104" height="28" rx="18" />,
  },
  {
    type: "SLEEVE",
    label: MEASUREMENT_TYPE_LABELS.SLEEVE,
    description: MEASUREMENT_TYPE_DESCRIPTIONS.SLEEVE,
    svg: (
      <path d="M46 132c-10 0-18 8-18 18v84c0 13 11 24 24 24h6l12-76h60l12 76h6c13 0 24-11 24-24v-84c0-10-8-18-18-18Z" />
    ),
  },
  {
    type: "SHOE_SIZE",
    label: MEASUREMENT_TYPE_LABELS.SHOE_SIZE,
    description: MEASUREMENT_TYPE_DESCRIPTIONS.SHOE_SIZE,
    svg: (
      <path d="M60 446c-9 0-18 8-18 18 0 36 24 68 58 68s58-32 58-68c0-10-9-18-18-18Z" />
    ),
  },
  {
    type: "HEAD",
    label: MEASUREMENT_TYPE_LABELS.HEAD,
    description: MEASUREMENT_TYPE_DESCRIPTIONS.HEAD,
    svg: <circle cx="100" cy="66" r="32" />,
  },
];

export const MeasurementTypeSelector = forwardRef<HTMLInputElement, MeasurementTypeSelectorProps>(
  function MeasurementTypeSelector(
    { name, value, onChange, disabled = false }: MeasurementTypeSelectorProps,
    ref,
  ) {
    const inputId = useId();
    const [hoveredType, setHoveredType] = useState<MeasurementType | null>(null);

    const activeType = hoveredType ?? value ?? null;

    const orderedAreas = useMemo(() => AREAS, []);

    return (
      <div className="space-y-4">
        <input
          ref={ref}
          id={inputId}
          type="hidden"
          name={name}
          value={value ?? ""}
          readOnly
        />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="relative mx-auto max-w-[280px]">
              <svg
                viewBox="0 0 200 520"
                role="presentation"
                className="h-auto w-full"
                aria-hidden="true"
              >
                <g className="fill-muted/40">
                  <circle cx="100" cy="66" r="36" />
                  <rect x="70" y="110" width="60" height="100" rx="30" />
                  <rect x="60" y="210" width="80" height="120" rx="40" />
                  <rect x="86" y="330" width="28" height="120" rx="14" />
                  <rect x="60" y="330" width="26" height="118" rx="13" />
                  <rect x="114" y="330" width="26" height="118" rx="13" />
                  <rect x="52" y="128" width="16" height="112" rx="8" />
                  <rect x="132" y="128" width="16" height="112" rx="8" />
                  <rect x="70" y="450" width="26" height="54" rx="13" />
                  <rect x="104" y="450" width="26" height="54" rx="13" />
                </g>

                {orderedAreas.map((area) => (
                  <g
                    key={area.type}
                    className={
                      area.type === activeType
                        ? `${ACTIVE_FILL} ${ACTIVE_STROKE} stroke-[3] transition-all duration-200`
                        : `${BASE_FILL} stroke-transparent transition-all duration-200`
                    }
                  >
                    <title>{area.label}</title>
                    {area.svg}
                  </g>
                ))}
              </svg>
            </div>
          </div>

          <div className="space-y-2">
            {orderedAreas.map((area) => {
              const isActive = activeType === area.type;
              const isSelected = value === area.type;

              return (
                <button
                  key={area.type}
                  type="button"
                  className={`w-full rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    isSelected
                      ? "border-primary bg-primary/10"
                      : isActive
                        ? "border-muted-foreground/60 bg-muted/40"
                        : "border-border bg-background"
                  } ${disabled ? "cursor-not-allowed opacity-60" : "hover:border-primary/60"}`}
                  onMouseEnter={() => setHoveredType(area.type)}
                  onFocus={() => setHoveredType(area.type)}
                  onMouseLeave={() => setHoveredType(null)}
                  onBlur={() => setHoveredType(null)}
                  onClick={() => {
                    if (disabled || !onChange) return;
                    onChange(area.type);
                  }}
                  aria-pressed={isSelected}
                  disabled={disabled}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-foreground">{area.label}</div>
                      <p className="text-sm text-muted-foreground">{area.description}</p>
                    </div>
                    <div
                      className={
                        isSelected
                          ? "mt-1 h-3 w-3 rounded-full bg-primary"
                          : "mt-1 h-3 w-3 rounded-full border border-muted"
                      }
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  },
);

MeasurementTypeSelector.displayName = "MeasurementTypeSelector";


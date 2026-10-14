"use client";

import * as React from "react";

import type { ConfidencePoint } from "@/lib/skript/learn/insights";

const HEIGHT = 120;
const PAD_LEFT = 32;
const PAD_RIGHT = 8;
const PAD_Y = 8;

function formatDay(day: string) {
  return new Date(`${day}T12:00:00`).toLocaleDateString("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
  });
}

/**
 * Verlauf der Textsicherheit (eine Reihe, 0–100 %): Linie 2 px mit dezenter Fläche, Fadenkreuz
 * und Wert beim Darüberfahren/Antippen, darunter eine Tabelle für Screenreader.
 */
export function ConfidenceChart({ points }: { points: readonly ConfidencePoint[] }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(320);
  const [hover, setHover] = React.useState<number | null>(null);
  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  if (points.length < 2) {
    return (
      <p className="mt-2 text-sm text-muted-foreground">
        Ab dem zweiten Lerntag siehst du hier, wie sich deine Textsicherheit entwickelt.
      </p>
    );
  }
  const plotWidth = Math.max(10, width - PAD_LEFT - PAD_RIGHT);
  const x = (index: number) => PAD_LEFT + (index / (points.length - 1)) * plotWidth;
  const y = (value: number) => PAD_Y + (1 - value) * (HEIGHT - 2 * PAD_Y);
  const line = points.map((point, index) => `${x(index)},${y(point.value)}`).join(" ");
  const area = `${PAD_LEFT},${y(0)} ${line} ${x(points.length - 1)},${y(0)}`;
  const active = hover !== null ? points[hover] : null;

  const onPointer = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left - PAD_LEFT) / plotWidth;
    setHover(Math.min(points.length - 1, Math.max(0, Math.round(ratio * (points.length - 1)))));
  };

  return (
    <div ref={ref} className="relative mt-3">
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={`Textsicherheit von ${Math.round(points[0].value * 100)} % auf ${Math.round(points.at(-1)!.value * 100)} %`}
        className="touch-pan-y overflow-visible"
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={() => setHover(null)}
      >
        {[0, 0.5, 1].map((tick) => (
          <g key={tick}>
            <line
              x1={PAD_LEFT}
              x2={PAD_LEFT + plotWidth}
              y1={y(tick)}
              y2={y(tick)}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={PAD_LEFT - 6}
              y={y(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {tick * 100} %
            </text>
          </g>
        ))}
        <polygon points={area} className="fill-primary/10" />
        <polyline
          points={line}
          fill="none"
          className="stroke-primary"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {active ? (
          <>
            <line
              x1={x(hover!)}
              x2={x(hover!)}
              y1={PAD_Y}
              y2={HEIGHT - PAD_Y}
              className="stroke-muted-foreground/50"
              strokeWidth={1}
            />
            <circle
              cx={x(hover!)}
              cy={y(active.value)}
              r={4}
              className="fill-primary stroke-background"
              strokeWidth={2}
            />
          </>
        ) : null}
      </svg>
      {active ? (
        <div
          className="pointer-events-none absolute top-0 rounded-md border border-border bg-popover px-2 py-1 text-xs shadow-sm"
          style={{
            left: Math.min(Math.max(0, x(hover!) - 50), Math.max(0, width - 100)),
          }}
        >
          <span className="text-muted-foreground">{formatDay(active.day)}</span>{" "}
          <span className="font-semibold tabular-nums">{Math.round(active.value * 100)} %</span>
        </div>
      ) : null}
      <div className="flex justify-between pl-8 text-[10px] text-muted-foreground">
        <span>{formatDay(points[0].day)}</span>
        <span>heute</span>
      </div>
      <table className="sr-only">
        <caption>Textsicherheit je Tag</caption>
        <tbody>
          {points.map((point) => (
            <tr key={point.day}>
              <th scope="row">{formatDay(point.day)}</th>
              <td>{Math.round(point.value * 100)} %</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";

import { signatureToSvgGeometry } from "@/lib/signature-svg";
import { cn } from "@/lib/utils";
import type { SignaturePayload, SignatureStroke } from "@/types/signature";

const POINTER_COLOR = "#2563eb";
const REPLAY_PAUSE_MS = 600;

interface SignatureVisualizerProps {
  payload: SignaturePayload;
  mode: "velocity" | "replay";
  className?: string;
}

type SignatureSegment = {
  start: SignatureStroke["points"][number];
  end: SignatureStroke["points"][number];
  velocity: number;
};

const VELOCITY_WINDOW_MS = 60;

/**
 * Tempo je Abschnitt, geglättet über ein Zeitfenster: Geräte liefern Punkte oft gebündelt mit
 * gleichem Zeitstempel, Einzelabschnitte schwanken dadurch zwischen 0 und Ausreißern.
 */
function computeSegments(payload: SignaturePayload): SignatureSegment[] {
  const segments: SignatureSegment[] = [];
  payload.strokes.forEach((stroke) => {
    const points = stroke.points;
    // kumulierte Weglänge je Punkt
    const distances = [0];
    for (let index = 1; index < points.length; index += 1) {
      const previous = points[index - 1];
      const current = points[index];
      distances.push(
        distances[index - 1] + Math.hypot(current.x - previous.x, current.y - previous.y),
      );
    }
    let low = 0;
    let high = 0;
    for (let index = 1; index < points.length; index += 1) {
      const start = points[index - 1];
      const end = points[index];
      const center = (start.time + end.time) / 2;
      while (low < index - 1 && points[low + 1].time <= center - VELOCITY_WINDOW_MS / 2) low += 1;
      while (high < points.length - 1 && points[high].time < center + VELOCITY_WINDOW_MS / 2) {
        high += 1;
      }
      const from = Math.min(low, index - 1);
      const to = Math.max(high, index);
      const span = points[to].time - points[from].time;
      const velocity = span > 0 ? (distances[to] - distances[from]) / span : 0;
      segments.push({ start, end, velocity });
    }
  });
  return segments;
}

function velocityToColor(velocity: number, maxVelocity: number): string {
  if (!Number.isFinite(velocity) || maxVelocity <= 0) {
    return "currentColor";
  }
  const clamped = Math.max(0, Math.min(velocity / maxVelocity, 1));
  return `hsl(${210 - clamped * 210}deg 85% ${45 - clamped * 10}%)`;
}

/** Punkte jedes Strichs bis zum Zeitpunkt `time`, der letzte ggf. interpoliert. */
function replayPolylines(payload: SignaturePayload, time: number) {
  const lines: string[] = [];
  let pointer: { x: number; y: number } | null = null;
  for (const stroke of payload.strokes) {
    const points = stroke.points;
    if (!points.length || time < points[0].time) continue;
    const coords = [`${points[0].x},${points[0].y}`];
    let last = { x: points[0].x, y: points[0].y };
    for (let index = 1; index < points.length; index += 1) {
      const current = points[index];
      if (current.time <= time) {
        coords.push(`${current.x},${current.y}`);
        last = current;
        continue;
      }
      const previous = points[index - 1];
      const span = current.time - previous.time;
      const ratio = span > 0 ? Math.max(0, Math.min((time - previous.time) / span, 1)) : 0;
      last = {
        x: previous.x + (current.x - previous.x) * ratio,
        y: previous.y + (current.y - previous.y) * ratio,
      };
      coords.push(`${last.x},${last.y}`);
      break;
    }
    lines.push(coords.join(" "));
    pointer = last;
  }
  return { lines, pointer };
}

/**
 * Abspielen bzw. Tempo-Ansicht einer Unterschrift als SVG – mit demselben Ausschnitt wie das
 * Standbild (`signatureToSvgGeometry`), damit nichts springt oder winzig wird.
 */
export function SignatureVisualizer({ payload, mode, className }: SignatureVisualizerProps) {
  const { viewBox } = useMemo(() => signatureToSvgGeometry(payload), [payload]);
  const segments = useMemo(() => computeSegments(payload), [payload]);
  // Obergrenze der Farbskala ist das 90. Perzentil statt des Maximums, damit einzelne
  // Ausreißer (Sprünge zwischen Messpunkten) nicht alles andere „langsam“ aussehen lassen.
  const maxVelocity = useMemo(() => {
    const sorted = segments
      .map((segment) => segment.velocity)
      .filter((velocity) => Number.isFinite(velocity) && velocity > 0)
      .sort((a, b) => a - b);
    if (!sorted.length) return 0;
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))];
  }, [segments]);
  const duration = Math.max(
    payload.duration,
    segments.length ? segments[segments.length - 1].end.time : 0,
  );
  const [time, setTime] = useState(0);
  // Zeigerpunkt relativ zum Ausschnitt, damit er bei jeder Unterschriftgröße gleich wirkt.
  const [, , boxWidth, boxHeight] = viewBox.split(" ").map(Number);
  const pointerRadius = Math.max(boxWidth, boxHeight) * 0.015;

  useEffect(() => {
    if (mode !== "replay") return;
    let frame = 0;
    let start: number | null = null;
    const step = (timestamp: number) => {
      start ??= timestamp;
      const progress = (timestamp - start) % (duration + REPLAY_PAUSE_MS);
      setTime(Math.min(progress, duration));
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [duration, mode]);

  const replay = mode === "replay" ? replayPolylines(payload, time) : null;

  return (
    <svg viewBox={viewBox} className={cn("text-foreground", className)} aria-hidden>
      <g
        fill="none"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      >
        {replay
          ? replay.lines.map((points, index) => (
              <polyline
                key={index}
                points={points}
                stroke="currentColor"
                vectorEffect="non-scaling-stroke"
              />
            ))
          : segments.map((segment, index) => (
              <line
                key={index}
                x1={segment.start.x}
                y1={segment.start.y}
                x2={segment.end.x}
                y2={segment.end.y}
                stroke={velocityToColor(segment.velocity, maxVelocity)}
                vectorEffect="non-scaling-stroke"
              />
            ))}
      </g>
      {replay?.pointer ? (
        <circle
          cx={replay.pointer.x}
          cy={replay.pointer.y}
          r={pointerRadius}
          fill={POINTER_COLOR}
        />
      ) : null}
    </svg>
  );
}

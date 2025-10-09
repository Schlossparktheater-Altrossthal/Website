"use client";

import { useEffect, useMemo, useRef } from "react";

import { cn } from "@/lib/utils";
import type { SignaturePayload, SignatureStroke } from "@/types/signature";

const POINTER_COLOR = "#2563eb";
const STROKE_COLOR = "#111827";

interface SignatureVisualizerProps {
  payload: SignaturePayload;
  mode: "outline" | "velocity" | "replay";
  className?: string;
}

type SignatureSegment = {
  strokeIndex: number;
  start: SignatureStroke["points"][number];
  end: SignatureStroke["points"][number];
  velocity: number;
};

function computeSegments(payload: SignaturePayload): SignatureSegment[] {
  const segments: SignatureSegment[] = [];
  payload.strokes.forEach((stroke, strokeIndex) => {
    const points = stroke.points;
    for (let index = 1; index < points.length; index += 1) {
      const start = points[index - 1];
      const end = points[index];
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const distance = Math.hypot(dx, dy);
      const delta = end.time - start.time;
      const velocity = delta > 0 ? distance / delta : 0;
      segments.push({ strokeIndex, start, end, velocity });
    }
  });
  return segments;
}

function velocityToColor(velocity: number, maxVelocity: number): string {
  if (!Number.isFinite(velocity) || maxVelocity <= 0) {
    return STROKE_COLOR;
  }
  const clamped = Math.max(0, Math.min(velocity / maxVelocity, 1));
  const hue = 210 - clamped * 210;
  const saturation = 85;
  const lightness = 45 - clamped * 10;
  return `hsl(${hue}deg ${saturation}% ${lightness}%)`;
}

function prepareContext(
  canvas: HTMLCanvasElement,
  payload: SignaturePayload,
): CanvasRenderingContext2D | null {
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }
  const dpr = window.devicePixelRatio ?? 1;
  const width = Math.max(1, Math.round(payload.width * dpr));
  const height = Math.max(1, Math.round(payload.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = 2;
  return context;
}

function drawOutline(context: CanvasRenderingContext2D, payload: SignaturePayload) {
  context.strokeStyle = STROKE_COLOR;
  payload.strokes.forEach((stroke) => {
    const points = stroke.points;
    if (!points.length) return;
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
      const point = points[index];
      context.lineTo(point.x, point.y);
    }
    context.stroke();
  });
}

function drawVelocityMap(
  context: CanvasRenderingContext2D,
  payload: SignaturePayload,
  segments: SignatureSegment[],
  maxVelocity: number,
) {
  if (!segments.length || maxVelocity <= 0) {
    drawOutline(context, payload);
    return;
  }
  segments.forEach((segment) => {
    context.beginPath();
    context.moveTo(segment.start.x, segment.start.y);
    context.lineTo(segment.end.x, segment.end.y);
    context.strokeStyle = velocityToColor(segment.velocity, maxVelocity);
    context.stroke();
  });
}

function drawReplayFrame(
  context: CanvasRenderingContext2D,
  payload: SignaturePayload,
  time: number,
) {
  context.strokeStyle = STROKE_COLOR;
  payload.strokes.forEach((stroke) => {
    const points = stroke.points;
    if (!points.length) {
      return;
    }
    const firstPoint = points[0];
    if (time < firstPoint.time) {
      return;
    }
    context.beginPath();
    context.moveTo(firstPoint.x, firstPoint.y);
    let partialDrawn = false;
    for (let index = 1; index < points.length; index += 1) {
      const current = points[index];
      const previous = points[index - 1];
      if (current.time <= time) {
        context.lineTo(current.x, current.y);
        continue;
      }
      const span = current.time - previous.time;
      const ratio = span > 0 ? Math.max(0, Math.min((time - previous.time) / span, 1)) : 0;
      const x = previous.x + (current.x - previous.x) * ratio;
      const y = previous.y + (current.y - previous.y) * ratio;
      context.lineTo(x, y);
      context.stroke();
      context.beginPath();
      context.fillStyle = POINTER_COLOR;
      context.arc(x, y, 3.2, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.moveTo(x, y);
      partialDrawn = true;
      break;
    }
    if (!partialDrawn) {
      context.stroke();
      const last = points[points.length - 1];
      if (time >= last.time) {
        context.beginPath();
        context.fillStyle = POINTER_COLOR;
        context.arc(last.x, last.y, 3, 0, Math.PI * 2);
        context.fill();
      }
    }
  });
}

export function SignatureVisualizer({ payload, mode, className }: SignatureVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const segments = useMemo(() => computeSegments(payload), [payload]);
  const maxVelocity = useMemo(
    () => segments.reduce((max, segment) => Math.max(max, segment.velocity), 0),
    [segments],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return () => {};
    }
    const context = prepareContext(canvas, payload);
    if (!context) {
      return () => {};
    }

    if (mode === "velocity") {
      drawVelocityMap(context, payload, segments, maxVelocity);
      return () => {};
    }

    if (mode === "outline") {
      drawOutline(context, payload);
      return () => {};
    }

    let frame: number | null = null;
    let start: number | null = null;
    const duration = Math.max(payload.duration, segments.length ? segments[segments.length - 1].end.time : 0);
    const pause = 600;

    const step = (timestamp: number) => {
      if (start === null) {
        start = timestamp;
      }
      const elapsed = timestamp - start;
      const cycle = duration + pause;
      const progress = elapsed % cycle;
      const currentTime = progress > duration ? duration : progress;
      const stepContext = prepareContext(canvas, payload);
      if (stepContext) {
        drawReplayFrame(stepContext, payload, currentTime);
      }
      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    animationRef.current = frame;
    return () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
      animationRef.current = null;
    };
  }, [maxVelocity, mode, payload, segments]);

  useEffect(() => {
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div
      className="relative h-full w-full"
      style={{ aspectRatio: `${payload.width} / ${payload.height}` }}
    >
      <canvas ref={canvasRef} className={cn("h-full w-full", className)} aria-hidden />
    </div>
  );
}

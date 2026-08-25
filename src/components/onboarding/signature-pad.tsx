"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SignaturePayload, SignatureStroke } from "@/types/signature";

export type SignatureResult = {
  dataUrl: string;
  payload: SignaturePayload;
};

interface SignaturePadProps {
  value: SignatureResult | null;
  onChange: (value: SignatureResult | null) => void;
  className?: string;
}

const MIN_HEIGHT = 160;
const MAX_HEIGHT = 260;

export function SignaturePad({ value, onChange, className }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const strokesRef = useRef<SignatureStroke[]>([]);
  const currentStrokeRef = useRef<SignatureStroke | null>(null);
  const startHighResRef = useRef<number | null>(null);
  const startEpochRef = useRef<number | null>(null);
  const timeOffsetRef = useRef(0);
  const [isEmpty, setIsEmpty] = useState(!value);
  const [canvasHeight, setCanvasHeight] = useState(200);

  const initializeCanvas = useCallback((result: SignatureResult | null) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const rawWidth = Math.round(rect.width || 0);
    const width = Math.max(320, rawWidth);
    const height = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, Math.round(width * 0.4)));
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    setCanvasHeight(height);

    const context = canvas.getContext("2d");
    if (!context) return;

    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 2;
    context.strokeStyle = "#111827";
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);

    if (result?.dataUrl) {
      const image = new Image();
      image.onload = () => {
        context.drawImage(image, 0, 0, width, height);
        setIsEmpty(false);
      };
      image.src = result.dataUrl;
      if (result.payload) {
        const payloadStrokes = result.payload.strokes ?? [];
        strokesRef.current = payloadStrokes.map((stroke) => ({
          points: stroke.points.map((point) => ({ ...point })),
        }));
        const startedAt = Date.parse(result.payload.startedAt);
        startEpochRef.current = Number.isFinite(startedAt) ? startedAt : null;
        timeOffsetRef.current = result.payload.duration ?? 0;
      }
    } else {
      setIsEmpty(true);
      strokesRef.current = [];
      timeOffsetRef.current = 0;
      startEpochRef.current = null;
    }
    currentStrokeRef.current = null;
    startHighResRef.current = null;
  }, []);

  useEffect(() => {
    initializeCanvas(value);
    const handleResize = () => initializeCanvas(value);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [initializeCanvas, value]);

  const getPoint = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return { x: 0, y: 0 };
    }
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }, []);

  const recordPoint = useCallback((x: number, y: number) => {
    const now = performance.now();
    if (startHighResRef.current === null) {
      startHighResRef.current = now;
      startEpochRef.current = Date.now();
    }
    const base = startHighResRef.current ?? now;
    const time = now - base + timeOffsetRef.current;
    const stroke = currentStrokeRef.current;
    if (!stroke) {
      return { x, y, time };
    }
    const point = { x, y, time };
    stroke.points.push(point);
    lastPointRef.current = { x, y };
    return point;
  }, []);

  const buildPayload = useCallback((width: number, height: number): SignaturePayload | null => {
    const strokes = strokesRef.current;
    if (!strokes.length) return null;

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let duration = 0;

    for (const stroke of strokes) {
      for (const point of stroke.points) {
        if (point.x < minX) minX = point.x;
        if (point.y < minY) minY = point.y;
        if (point.x > maxX) maxX = point.x;
        if (point.y > maxY) maxY = point.y;
        if (point.time > duration) duration = point.time;
      }
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
      minX = 0;
      minY = 0;
    }
    if (!Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      maxX = width;
      maxY = height;
    }

    const startedAtEpoch = startEpochRef.current ?? Date.now();
    const startedAt = new Date(startedAtEpoch).toISOString();
    const endedAt = new Date(startedAtEpoch + duration).toISOString();

    return {
      version: "velocity.v1",
      width,
      height,
      duration,
      startedAt,
      endedAt,
      boundingBox: {
        minX,
        minY,
        maxX,
        maxY,
      },
      strokes: strokes.map((stroke) => ({
        points: stroke.points.map((point) => ({ ...point })),
      })),
    };
  }, []);

  const stopDrawing = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      event.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        // ignore capture errors
      }
      const { x, y } = getPoint(event);
      const lastPoint = lastPointRef.current;
      if (!lastPoint || lastPoint.x !== x || lastPoint.y !== y) {
        recordPoint(x, y);
      } else {
        recordPoint(lastPoint.x, lastPoint.y);
      }
      drawingRef.current = false;
      lastPointRef.current = null;
      currentStrokeRef.current = null;
      const payload = buildPayload(canvas.width, canvas.height);
      if (!payload) {
        onChange(null);
        return;
      }
      timeOffsetRef.current = payload.duration;
      const parsedStart = Date.parse(payload.startedAt);
      startEpochRef.current = Number.isFinite(parsedStart) ? parsedStart : startEpochRef.current;
      const dataUrl = canvas.toDataURL("image/png");
      onChange({ dataUrl, payload });
    },
    [buildPayload, getPoint, onChange, recordPoint],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) return;
      canvas.setPointerCapture(event.pointerId);
      const { x, y } = getPoint(event);
      drawingRef.current = true;
      const stroke: SignatureStroke = { points: [] };
      currentStrokeRef.current = stroke;
      strokesRef.current.push(stroke);
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + 0.01, y + 0.01);
      context.stroke();
      recordPoint(x, y);
      setIsEmpty(false);
    },
    [getPoint, recordPoint],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      event.preventDefault();
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) return;
      const { x, y } = getPoint(event);
      const lastPoint = lastPointRef.current ?? { x, y };
      context.beginPath();
      context.moveTo(lastPoint.x, lastPoint.y);
      context.lineTo(x, y);
      context.stroke();
      recordPoint(x, y);
    },
    [getPoint, recordPoint],
  );

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#111827";
    context.lineWidth = 2;
    setIsEmpty(true);
    strokesRef.current = [];
    currentStrokeRef.current = null;
    startHighResRef.current = null;
    startEpochRef.current = null;
    timeOffsetRef.current = 0;
    onChange(null);
  }, [onChange]);

  return (
    <div ref={containerRef} className={cn("space-y-2", className)}>
      <canvas
        ref={canvasRef}
        className="w-full touch-none rounded-lg border border-border bg-card shadow-inner"
        style={{ height: `${canvasHeight}px` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDrawing}
        onPointerLeave={stopDrawing}
        onPointerCancel={stopDrawing}
        aria-label="Unterschrift zeichnen"
        role="img"
      />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {isEmpty
            ? "Signiere mit Finger, Stift oder Maus."
            : "Zufrieden? Du kannst deine Unterschrift bei Bedarf zurücksetzen."}
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={handleClear} disabled={isEmpty}>
          Zurücksetzen
        </Button>
      </div>
    </div>
  );
}

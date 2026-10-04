"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Maximize2Icon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { FullscreenOverlay } from "@/components/ui/fullscreen-overlay";
import { cn } from "@/lib/utils";
import type { SignaturePayload, SignaturePoint, SignatureStroke } from "@/types/signature";

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
const INK = "#111827";
const BASE_WIDTH = 2;

/** Strichbreite: mit Stiftdruck variabel (0,8–3,6 px), sonst fest. */
function lineWidthFor(point: SignaturePoint): number {
  if (point.pressure === undefined) return BASE_WIDTH;
  return BASE_WIDTH * (0.4 + point.pressure * 1.4);
}

function drawSegment(context: CanvasRenderingContext2D, from: SignaturePoint, to: SignaturePoint) {
  context.lineWidth = (lineWidthFor(from) + lineWidthFor(to)) / 2;
  context.beginPath();
  context.moveTo(from.x, from.y);
  // Ein einzelner Punkt braucht eine Mini-Strecke, sonst zeichnet der Canvas nichts.
  context.lineTo(to.x === from.x && to.y === from.y ? to.x + 0.01 : to.x, to.y);
  context.stroke();
}

function drawStrokes(context: CanvasRenderingContext2D, strokes: SignatureStroke[]) {
  for (const stroke of strokes) {
    const [first, ...rest] = stroke.points;
    if (!first) continue;
    drawSegment(context, first, first);
    let previous = first;
    for (const point of rest) {
      drawSegment(context, previous, point);
      previous = point;
    }
  }
}

/**
 * Liest Druck und Neigung aus, aber nur bei echten Stiften: Maus meldet pauschal 0,5 und
 * Touch meist 0 oder 1 – das wären keine Messwerte.
 */
function penData(event: PointerEvent): Partial<SignaturePoint> {
  if (event.pointerType !== "pen") return {};
  const data: Partial<SignaturePoint> = {};
  if (Number.isFinite(event.pressure)) data.pressure = Math.min(1, Math.max(0, event.pressure));
  if (event.tiltX || event.tiltY) {
    data.tiltX = event.tiltX;
    data.tiltY = event.tiltY;
  }
  if (event.twist) data.twist = event.twist;
  // altitudeAngle/azimuthAngle gibt es (noch) nicht in allen TS-DOM-Typen.
  const angles = event as PointerEvent & { altitudeAngle?: number; azimuthAngle?: number };
  if (typeof angles.altitudeAngle === "number" && Number.isFinite(angles.altitudeAngle)) {
    data.altitudeAngle = angles.altitudeAngle;
  }
  if (typeof angles.azimuthAngle === "number" && Number.isFinite(angles.azimuthAngle)) {
    data.azimuthAngle = angles.azimuthAngle;
  }
  return data;
}

interface SignatureCanvasProps {
  value: SignatureResult | null;
  onChange: (value: SignatureResult | null) => void;
  /** Füllt den Container in Breite und Höhe (Vollbild), statt die Höhe aus der Breite abzuleiten. */
  fill?: boolean;
  className?: string;
  canvasClassName?: string;
  /** Inhalt neben dem Zurücksetzen-Knopf, z. B. Vollbild/Übernehmen. */
  actions?: React.ReactNode;
}

function SignatureCanvas({
  value,
  onChange,
  fill = false,
  className,
  canvasClassName,
  actions,
}: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<SignaturePoint | null>(null);
  const strokesRef = useRef<SignatureStroke[]>([]);
  const currentStrokeRef = useRef<SignatureStroke | null>(null);
  const startHighResRef = useRef<number | null>(null);
  const startEpochRef = useRef<number | null>(null);
  const timeOffsetRef = useRef(0);
  const [isEmpty, setIsEmpty] = useState(!value);
  /** Unterschrift wurde in anderer Größe (z. B. im Vollbild) erfasst – nur Vorschau. */
  const [locked, setLocked] = useState(false);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number } | null>(null);
  const [usedPen, setUsedPen] = useState(false);
  /** Zuletzt selbst gemeldeter Wert – kommt er als `value` zurück, ist der Canvas schon aktuell. */
  const emittedRef = useRef<SignatureResult | null>(null);
  const onChangeRef = useRef(onChange);
  const buildPayloadRef = useRef<(width: number, height: number) => SignaturePayload | null>(
    () => null,
  );

  const initializeCanvas = useCallback(
    (result: SignatureResult | null) => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const rect = (fill ? (canvas.parentElement ?? container) : container).getBoundingClientRect();
      const width = Math.max(200, Math.round(rect.width || 0));
      const height = fill
        ? Math.max(MIN_HEIGHT, Math.round(rect.height || 0))
        : Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, Math.round(width * 0.4)));
      canvas.width = width;
      canvas.height = height;
      setCanvasSize({ width, height });

      const context = canvas.getContext("2d");
      if (!context) return;

      context.lineCap = "round";
      context.lineJoin = "round";
      context.lineWidth = BASE_WIDTH;
      context.strokeStyle = INK;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);

      const payload = result?.payload;
      if (result && payload) {
        const sameSize =
          Math.abs(payload.width - width) <= 1 && Math.abs(payload.height - height) <= 1;
        setLocked(!sameSize);
        setIsEmpty(false);
        setUsedPen(payload.strokes.some((stroke) => stroke.pointerType === "pen"));
        if (sameSize) {
          drawStrokes(context, payload.strokes);
        } else {
          // Vorschau einer anders großen Erfassung (z. B. quer im Vollbild): auf die Striche
          // zuschneiden statt die ganze, meist leere Fläche hineinzuquetschen – Seitenverhältnis bleibt.
          const box = payload.boundingBox;
          const pad = 12;
          const boxWidth = Math.max(box.maxX - box.minX, 1) + pad * 2;
          const boxHeight = Math.max(box.maxY - box.minY, 1) + pad * 2;
          const scale = Math.min(width / boxWidth, height / boxHeight, 2);
          context.save();
          context.translate(
            (width - boxWidth * scale) / 2 - (box.minX - pad) * scale,
            (height - boxHeight * scale) / 2 - (box.minY - pad) * scale,
          );
          context.scale(scale, scale);
          drawStrokes(context, payload.strokes);
          context.restore();
        }
        strokesRef.current = payload.strokes.map((stroke) => ({
          ...stroke,
          points: stroke.points.map((point) => ({ ...point })),
        }));
        const startedAt = Date.parse(payload.startedAt);
        startEpochRef.current = Number.isFinite(startedAt) ? startedAt : null;
        timeOffsetRef.current = payload.duration ?? 0;
      } else {
        setIsEmpty(true);
        setLocked(false);
        setUsedPen(false);
        strokesRef.current = [];
        timeOffsetRef.current = 0;
        startEpochRef.current = null;
      }
      currentStrokeRef.current = null;
      startHighResRef.current = null;
    },
    [fill],
  );

  useEffect(() => {
    // Nicht neu aufbauen, wenn nur die eigene Eingabe zurückkommt: das würde die Schrift neu
    // zeichnen und – falls sich das Layout minimal verschiebt – das Weiterschreiben sperren.
    if (!value || value !== emittedRef.current) initializeCanvas(value);
  }, [initializeCanvas, value]);

  // Größenänderungen (Drehen, Adressleiste) per ResizeObserver: der meldet erst nach dem Layout,
  // „resize“/„orientationchange“ kommen auf Mobilgeräten teils noch mit den alten Maßen.
  useEffect(() => {
    const canvas = canvasRef.current;
    const target = fill ? canvas?.parentElement : containerRef.current;
    if (!canvas || !target || typeof ResizeObserver === "undefined") return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = target.getBoundingClientRect();
        const width = Math.max(200, Math.round(rect.width));
        const height = fill
          ? Math.max(MIN_HEIGHT, Math.round(rect.height))
          : Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, Math.round(width * 0.4)));
        if (Math.abs(width - canvas.width) <= 1 && Math.abs(height - canvas.height) <= 1) return;
        if (drawingRef.current) return;
        if (!strokesRef.current.length) {
          initializeCanvas(null);
          return;
        }
        // Bereits gezeichnete Striche mitnehmen: gleichmäßig skalieren und zentrieren, damit man
        // nach dem Drehen einfach weiterschreiben kann.
        const scale = Math.min(width / canvas.width, height / canvas.height);
        const offsetX = (width - canvas.width * scale) / 2;
        const offsetY = (height - canvas.height * scale) / 2;
        strokesRef.current = strokesRef.current.map((stroke) => ({
          ...stroke,
          points: stroke.points.map((point) => ({
            ...point,
            x: point.x * scale + offsetX,
            y: point.y * scale + offsetY,
          })),
        }));
        canvas.width = width;
        canvas.height = height;
        setCanvasSize({ width, height });
        setLocked(false);
        const context = canvas.getContext("2d");
        if (!context) return;
        context.lineCap = "round";
        context.lineJoin = "round";
        context.strokeStyle = INK;
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
        drawStrokes(context, strokesRef.current);
        const payload = buildPayloadRef.current(width, height);
        if (payload) {
          const result = { dataUrl: canvas.toDataURL("image/png"), payload };
          emittedRef.current = result;
          onChangeRef.current(result);
        }
      });
    });
    observer.observe(target);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [fill, initializeCanvas]);

  const recordPoint = useCallback((event: PointerEvent): SignaturePoint => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    const x = rect ? event.clientX - rect.left : 0;
    const y = rect ? event.clientY - rect.top : 0;
    const now = performance.now();
    if (startHighResRef.current === null) {
      startHighResRef.current = now;
      startEpochRef.current = Date.now();
    }
    const time = now - startHighResRef.current + timeOffsetRef.current;
    const point: SignaturePoint = { x, y, time, ...penData(event) };
    currentStrokeRef.current?.points.push(point);
    lastPointRef.current = point;
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
      boundingBox: { minX, minY, maxX, maxY },
      strokes: strokes.map((stroke) => ({
        ...stroke,
        points: stroke.points.map((point) => ({ ...point })),
      })),
    };
  }, []);

  useEffect(() => {
    onChangeRef.current = onChange;
    buildPayloadRef.current = buildPayload;
  }, [buildPayload, onChange]);

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
      const last = lastPointRef.current;
      const point = recordPoint(event.nativeEvent);
      // Abheben meldet beim Stift Druck 0 – den letzten echten Wert behalten.
      if (last?.pressure !== undefined) point.pressure = last.pressure;
      drawingRef.current = false;
      lastPointRef.current = null;
      currentStrokeRef.current = null;
      const payload = buildPayload(canvas.width, canvas.height);
      if (!payload) {
        emittedRef.current = null;
        onChange(null);
        return;
      }
      timeOffsetRef.current = payload.duration;
      const parsedStart = Date.parse(payload.startedAt);
      startEpochRef.current = Number.isFinite(parsedStart) ? parsedStart : startEpochRef.current;
      const result = { dataUrl: canvas.toDataURL("image/png"), payload };
      emittedRef.current = result;
      onChange(result);
    },
    [buildPayload, onChange, recordPoint],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      if (locked) return;
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) return;
      canvas.setPointerCapture(event.pointerId);
      drawingRef.current = true;
      const stroke: SignatureStroke = { points: [], pointerType: event.pointerType || undefined };
      currentStrokeRef.current = stroke;
      strokesRef.current.push(stroke);
      const point = recordPoint(event.nativeEvent);
      drawSegment(context, point, point);
      if (event.pointerType === "pen") setUsedPen(true);
      setIsEmpty(false);
    },
    [locked, recordPoint],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      event.preventDefault();
      const context = canvasRef.current?.getContext("2d");
      if (!context) return;
      // Zwischenpunkte, die der Browser zu einem Event zusammenfasst – v. a. bei Stiften (240 Hz).
      const native = event.nativeEvent;
      const samples =
        typeof native.getCoalescedEvents === "function" ? native.getCoalescedEvents() : [];
      for (const sample of samples.length ? samples : [native]) {
        const previous = lastPointRef.current;
        const point = recordPoint(sample);
        drawSegment(context, previous ?? point, point);
      }
    },
    [recordPoint],
  );

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
    setLocked(false);
    setUsedPen(false);
    strokesRef.current = [];
    currentStrokeRef.current = null;
    startHighResRef.current = null;
    startEpochRef.current = null;
    timeOffsetRef.current = 0;
    emittedRef.current = null;
    onChange(null);
  }, [onChange]);

  const hint = locked
    ? "Zum Ändern zurücksetzen und neu unterschreiben."
    : isEmpty
      ? "Signiere mit Finger, Stift oder Maus."
      : usedPen
        ? "Mit Stift erfasst (inkl. Druck/Neigung, falls vom Gerät geliefert)."
        : "Zufrieden? Du kannst deine Unterschrift bei Bedarf zurücksetzen.";

  return (
    <div ref={containerRef} className={cn("space-y-2", fill && "flex min-h-0 flex-col", className)}>
      <div className={cn(fill && "relative min-h-0 flex-1 overflow-hidden")}>
        <canvas
          ref={canvasRef}
          className={cn(
            "w-full touch-none rounded-lg border border-border bg-card shadow-inner",
            fill && "absolute left-0 top-0",
            locked && "cursor-not-allowed",
            canvasClassName,
          )}
          style={
            canvasSize
              ? fill
                ? { width: `${canvasSize.width}px`, height: `${canvasSize.height}px` }
                : { height: `${canvasSize.height}px` }
              : undefined
          }
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
          onPointerCancel={stopDrawing}
          aria-label="Unterschrift zeichnen"
          role="img"
        />
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="min-w-0 truncate" title={hint}>
          {hint}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={handleClear} disabled={isEmpty}>
            Zurücksetzen
          </Button>
          {actions}
        </div>
      </div>
    </div>
  );
}

export function SignaturePad({ value, onChange, className }: SignaturePadProps) {
  const [fullscreen, setFullscreen] = useState(false);
  /** Entwurf im Vollbild – erst „Übernehmen“ gibt ihn nach außen. */
  const [draft, setDraft] = useState<SignatureResult | null>(null);

  const openFullscreen = useCallback(() => {
    setDraft(null);
    setFullscreen(true);
  }, []);
  const closeFullscreen = useCallback(() => setFullscreen(false), []);

  return (
    <>
      <SignatureCanvas
        value={value}
        onChange={onChange}
        className={className}
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 lg:hidden"
            onClick={openFullscreen}
          >
            <Maximize2Icon className="size-3.5" />
            Großes Feld
          </Button>
        }
      />
      <FullscreenOverlay
        open={fullscreen}
        onClose={closeFullscreen}
        label="Unterschrift im Vollbild"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <p className="text-sm font-medium">Unterschreiben</p>
          <p className="hidden text-xs text-muted-foreground portrait:block">
            Tipp: Gerät quer halten
          </p>
        </div>
        <SignatureCanvas
          value={draft}
          onChange={setDraft}
          fill
          className="min-h-0 flex-1 p-3"
          actions={
            <>
              <Button type="button" variant="ghost" size="sm" onClick={closeFullscreen}>
                Abbrechen
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!draft}
                onClick={() => {
                  onChange(draft);
                  setFullscreen(false);
                }}
              >
                Übernehmen
              </Button>
            </>
          }
        />
      </FullscreenOverlay>
    </>
  );
}

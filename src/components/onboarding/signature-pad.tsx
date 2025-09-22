"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SignaturePadProps {
  value: string | null;
  onChange: (value: string | null) => void;
  className?: string;
}

const MIN_HEIGHT = 160;
const MAX_HEIGHT = 260;

export function SignaturePad({ value, onChange, className }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [isEmpty, setIsEmpty] = useState(!value);
  const [canvasHeight, setCanvasHeight] = useState(200);

  const initializeCanvas = useCallback(
    (dataUrl: string | null) => {
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

      if (dataUrl) {
        const image = new Image();
        image.onload = () => {
          context.drawImage(image, 0, 0, width, height);
          setIsEmpty(false);
        };
        image.src = dataUrl;
      } else {
        setIsEmpty(true);
      }
    },
    [],
  );

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
      drawingRef.current = false;
      lastPointRef.current = null;
      onChange(canvas.toDataURL("image/png"));
    },
    [onChange],
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
      lastPointRef.current = { x, y };
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + 0.01, y + 0.01);
      context.stroke();
      setIsEmpty(false);
    },
    [getPoint],
  );

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
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
    lastPointRef.current = { x, y };
  }, [getPoint]);

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
    onChange(null);
  }, [onChange]);

  return (
    <div ref={containerRef} className={cn("space-y-2", className)}>
      <canvas
        ref={canvasRef}
        className="w-full touch-none rounded-lg border border-border bg-white shadow-inner"
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

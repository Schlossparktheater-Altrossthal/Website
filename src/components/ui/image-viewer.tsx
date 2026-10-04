"use client";

import { useCallback, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { RotateCcw, RotateCw, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

import { CloseIcon, DownloadIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";

const MIN_SCALE = 0.5;
const MAX_SCALE = 6;

function clampScale(value: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

interface ImageViewerProps {
  open: boolean;
  onClose: () => void;
  src: string;
  alt: string;
  /** Optionaler Download-Link (Originaldatei). */
  downloadHref?: string | null;
}

/**
 * Bildbetrachter im Vollbild (eigener Radix-Dialog, funktioniert daher auch aus Blättern heraus): Zoomen (Buttons, Mausrad, Doppelklick, Zwei-Finger-Pinch),
 * Verschieben per Ziehen und Drehen in 90°-Schritten.
 */
export function ImageViewer({ open, onClose, src, alt, downloadHref }: ImageViewerProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDistance = useRef<number | null>(null);

  const reset = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const handleClose = useCallback(() => {
    reset();
    setRotation(0);
    onClose();
  }, [onClose, reset]);

  const zoomBy = (factor: number) => {
    setScale((current) => {
      const next = clampScale(current * factor);
      if (next <= 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    zoomBy(event.deltaY < 0 ? 1.15 : 1 / 1.15);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    pinchDistance.current = null;
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const current = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, current);

    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDistance.current) {
        const factor = distance / pinchDistance.current;
        setScale((value) => clampScale(value * factor));
      }
      pinchDistance.current = distance;
      return;
    }

    setOffset((value) => ({
      x: value.x + current.x - previous.x,
      y: value.y + current.y - previous.y,
    }));
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    pinchDistance.current = null;
  };

  const sideways = Math.abs(rotation / 90) % 2 === 1;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => (next ? null : handleClose())}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-[60] flex flex-col bg-black pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] focus:outline-none"
        >
          <DialogPrimitive.Title className="sr-only">{alt}</DialogPrimitive.Title>
          <div className="flex items-center justify-end gap-1 p-2 text-white">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Verkleinern"
              className="text-white hover:bg-white/15 hover:text-white"
              onClick={() => zoomBy(1 / 1.4)}
            >
              <ZoomOut className="size-5" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Vergrößern"
              className="text-white hover:bg-white/15 hover:text-white"
              onClick={() => zoomBy(1.4)}
            >
              <ZoomIn className="size-5" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Einpassen"
              className="text-white hover:bg-white/15 hover:text-white"
              onClick={reset}
            >
              <Maximize2 className="size-5" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Nach links drehen"
              className="text-white hover:bg-white/15 hover:text-white"
              onClick={() => setRotation((value) => value - 90)}
            >
              <RotateCcw className="size-5" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Nach rechts drehen"
              className="text-white hover:bg-white/15 hover:text-white"
              onClick={() => setRotation((value) => value + 90)}
            >
              <RotateCw className="size-5" aria-hidden />
            </Button>
            {downloadHref ? (
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/15 hover:text-white"
              >
                <a href={downloadHref} aria-label="Herunterladen">
                  <DownloadIcon className="size-5" />
                </a>
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Schließen"
              className="text-white hover:bg-white/15 hover:text-white"
              onClick={handleClose}
            >
              <CloseIcon className="size-5" />
            </Button>
          </div>
          <div
            className="relative flex min-h-0 flex-1 touch-none select-none items-center justify-center overflow-hidden"
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onDoubleClick={() => (scale > 1 ? reset() : zoomBy(2))}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- geschützte API-Datei, kein Optimizer */}
            <img
              src={src}
              alt={alt}
              draggable={false}
              className="object-contain"
              style={{
                // seitlich gedreht tauschen Breite und Höhe die Rollen
                maxWidth: sideways ? "calc(100dvh - 4rem)" : "100%",
                maxHeight: sideways ? "100vw" : "100%",
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale}) rotate(${rotation}deg)`,
              }}
            />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

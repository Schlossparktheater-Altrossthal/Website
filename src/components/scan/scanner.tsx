"use client";

import { useEffect, useRef } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";

export interface BarcodeScannerProps {
  onResult: (code: string) => void;
  onError?: (error: unknown) => void;
}

export function BarcodeScanner({ onResult, onError }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!videoRef.current) {
      return;
    }

    const reader = new BrowserMultiFormatReader();
    let isUnmounted = false;
    let controls: IScannerControls | null = null;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current, (result, error) => {
        if (result) {
          onResult(result.getText());
          return;
        }

        if (error && typeof onError === "function") {
          onError(error);
        }
      })
      .then((scannerControls) => {
        if (isUnmounted) {
          scannerControls.stop();
          return;
        }

        controls = scannerControls;
      })
      .catch((error) => {
        if (!isUnmounted) {
          console.error("[scanner] failed to start camera stream", error);
          onError?.(error);
        }
      });

    return () => {
      isUnmounted = true;
      controls?.stop();
    };
  }, [onError, onResult]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-black/80">
      <video
        ref={videoRef}
        className="aspect-video h-auto w-full object-cover"
        autoPlay
        muted
        playsInline
      />
      <div className="pointer-events-none absolute inset-0 border-2 border-white/30 mix-blend-screen" aria-hidden />
    </div>
  );
}

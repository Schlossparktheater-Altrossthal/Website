"use client";

import * as React from "react";

import { CameraIcon, KeyboardIcon, ZapIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type DetectorLike = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorConstructor = new (options: { formats: string[] }) => DetectorLike;
type JsQr = typeof import("jsqr").default;

/** Gleicher Code innerhalb dieser Zeit zählt nur einmal (Kamera sieht ihn mehrfach). */
const REPEAT_MS = 2500;
const SCAN_INTERVAL_MS = 180;

function getNativeDetector(): DetectorConstructor | null {
  const candidate = (globalThis as { BarcodeDetector?: DetectorConstructor }).BarcodeDetector;
  return typeof candidate === "function" ? candidate : null;
}

let audioContext: AudioContext | null = null;

/** Kurzer Piepton + Vibration als Rückmeldung – im Lager schaut man nicht immer aufs Display. */
export function scanFeedback(kind: "ok" | "warn" | "error") {
  try {
    navigator.vibrate?.(kind === "ok" ? 40 : [60, 60, 60]);
  } catch {
    // Vibration ist optional.
  }
  try {
    audioContext ??= new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.frequency.value = kind === "ok" ? 1320 : kind === "warn" ? 660 : 330;
    gain.gain.value = 0.08;
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + (kind === "ok" ? 0.08 : 0.25));
  } catch (error) {
    console.warn("Scan-Ton nicht möglich", error);
  }
}

/**
 * Dauerscanner für QR-Codes mit der Rückkamera. Nutzt den eingebauten BarcodeDetector
 * (Android/Chrome) und fällt sonst auf jsQR zurück (iPhone). Eine Eingabezeile darunter
 * funktioniert auch mit Hand-Scannern, die wie eine Tastatur tippen.
 */
export function QrScanner({
  onScan,
  paused = false,
  className,
  hint = "Code ins Bild halten",
}: {
  onScan: (text: string) => void;
  paused?: boolean;
  className?: string;
  hint?: string;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const lastRef = React.useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const onScanRef = React.useRef(onScan);
  const pausedRef = React.useRef(paused);
  const [state, setState] = React.useState<
    "idle" | "starting" | "running" | "denied" | "unsupported"
  >("idle");
  const [torch, setTorch] = React.useState<{ supported: boolean; on: boolean }>({
    supported: false,
    on: false,
  });
  const [flash, setFlash] = React.useState(false);
  const [manual, setManual] = React.useState("");
  const [showManual, setShowManual] = React.useState(false);

  React.useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);
  React.useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const emit = React.useCallback((text: string) => {
    const now = Date.now();
    if (lastRef.current.text === text && now - lastRef.current.at < REPEAT_MS) return;
    lastRef.current = { text, at: now };
    setFlash(true);
    window.setTimeout(() => setFlash(false), 250);
    onScanRef.current(text);
  }, []);

  const stop = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const start = React.useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      setShowManual(true);
      return;
    }
    setState("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stop();
        return;
      }
      video.srcObject = stream;
      await video.play();
      const [track] = stream.getVideoTracks();
      const capabilities = track?.getCapabilities?.() as { torch?: boolean } | undefined;
      setTorch({ supported: Boolean(capabilities?.torch), on: false });
      setState("running");
    } catch (error) {
      console.warn("Kamera nicht verfügbar", error);
      setState("denied");
      setShowManual(true);
    }
  }, [stop]);

  React.useEffect(() => {
    void start();
    return stop;
  }, [start, stop]);

  React.useEffect(() => {
    if (state !== "running") return;
    let cancelled = false;
    let timer = 0;
    const Native = getNativeDetector();
    let detector: DetectorLike | null = null;
    let jsQr: JsQr | null = null;

    const setup = async () => {
      if (Native) {
        try {
          detector = new Native({ formats: ["qr_code"] });
        } catch {
          detector = null;
        }
      }
      if (!detector) {
        jsQr = (await import("jsqr")).default;
      }
    };

    const tick = async () => {
      if (cancelled) return;
      const video = videoRef.current;
      if (video && !pausedRef.current && video.readyState >= 2) {
        try {
          if (detector) {
            const codes = await detector.detect(video);
            if (codes[0]?.rawValue) emit(codes[0].rawValue);
          } else if (jsQr) {
            canvasRef.current ??= document.createElement("canvas");
            const canvas = canvasRef.current;
            // Mittleres Quadrat verkleinert auswerten – schneller und robuster.
            const side = Math.min(video.videoWidth, video.videoHeight);
            const size = Math.min(640, side);
            canvas.width = size;
            canvas.height = size;
            const context = canvas.getContext("2d", { willReadFrequently: true });
            if (context && side > 0) {
              context.drawImage(
                video,
                (video.videoWidth - side) / 2,
                (video.videoHeight - side) / 2,
                side,
                side,
                0,
                0,
                size,
                size,
              );
              const image = context.getImageData(0, 0, size, size);
              const code = jsQr(image.data, size, size, { inversionAttempts: "dontInvert" });
              if (code?.data) emit(code.data);
            }
          }
        } catch (error) {
          console.warn("Scan fehlgeschlagen", error);
        }
      }
      timer = window.setTimeout(tick, SCAN_INTERVAL_MS);
    };

    void setup().then(tick);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [state, emit]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torch.on;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorch({ supported: true, on: next });
    } catch (error) {
      console.warn("Licht nicht schaltbar", error);
    }
  };

  const submitManual = (event: React.FormEvent) => {
    event.preventDefault();
    const text = manual.trim();
    if (!text) return;
    lastRef.current = { text: "", at: 0 };
    emit(text);
    setManual("");
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div
        className={cn(
          "relative aspect-[4/3] w-full overflow-hidden rounded-xl border-2 bg-muted transition-colors sm:aspect-video",
          flash ? "border-success" : "border-border",
          paused && "opacity-60",
        )}
      >
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
          aria-label="Kamerabild"
        />
        {state === "running" ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className={cn(
                "aspect-square w-1/2 max-w-64 rounded-xl border-4 transition-colors",
                flash ? "border-success" : "border-background/80",
              )}
            />
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center text-sm text-foreground">
            {state === "starting" || state === "idle" ? (
              <p>Kamera startet …</p>
            ) : (
              <>
                <p>
                  {state === "denied"
                    ? "Kein Kamerazugriff. Bitte im Browser erlauben – oder den Code unten eintippen."
                    : "Dieser Browser kann die Kamera nicht nutzen. Code unten eintippen."}
                </p>
                {state === "denied" ? (
                  <Button size="sm" variant="subtle" onClick={() => void start()}>
                    <CameraIcon className="mr-2 h-4 w-4" />
                    Erneut versuchen
                  </Button>
                ) : null}
              </>
            )}
          </div>
        )}
        {state === "running" ? (
          <p className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-background/80 px-3 py-1 text-center text-xs font-medium text-foreground">
            {paused ? "Pausiert" : hint}
          </p>
        ) : null}
        <div className="absolute top-2 right-2 flex gap-2">
          {torch.supported ? (
            <Button
              type="button"
              size="icon"
              variant={torch.on ? "primary" : "subtle"}
              onClick={toggleTorch}
              aria-label={torch.on ? "Licht aus" : "Licht an"}
              aria-pressed={torch.on}
            >
              <ZapIcon />
            </Button>
          ) : null}
          <Button
            type="button"
            size="icon"
            variant={showManual ? "primary" : "subtle"}
            onClick={() => setShowManual((value) => !value)}
            aria-label="Code eintippen"
            aria-pressed={showManual}
          >
            <KeyboardIcon />
          </Button>
        </div>
      </div>
      {showManual ? (
        <form onSubmit={submitManual} className="flex gap-2">
          <Input
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            placeholder="Code, z. B. T-42"
            aria-label="Code eingeben"
            autoCapitalize="characters"
            autoComplete="off"
            autoFocus
            className="min-w-0 flex-1 font-mono"
          />
          <Button type="submit" disabled={!manual.trim()}>
            OK
          </Button>
        </form>
      ) : null}
    </div>
  );
}

"use client";

import * as React from "react";

import { CameraIcon, KeyboardIcon, ZapIcon, ZoomInIcon } from "@/components/ui/action-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type DetectorLike = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorConstructor = new (options: { formats: string[] }) => DetectorLike;
type JsQr = typeof import("jsqr").default;

/** Gleicher Code innerhalb dieser Zeit zählt nur einmal (Kamera sieht ihn mehrfach). */
const REPEAT_MS = 2500;
const SCAN_INTERVAL_MS = 180;
const ZOOM_STEPS = [1, 2, 3];

export type ScanSignal = { tone: "ok" | "warn" | "error"; key: number };

type WakeLockLike = { release: () => Promise<void> };
type ZoomRange = { min: number; max: number };

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
 *
 * `variant="fullscreen"` füllt den Elternblock (Vollbild-Scanner mobil); Bedienknöpfe und
 * Eingabezeile liegen dann über dem Bild. `signal` färbt den Sucher nach dem Ergebnis eines
 * Scans (grün/gelb/rot) – ohne färbt er bei jedem erkannten Code kurz grün.
 */
export function QrScanner({
  onScan,
  paused = false,
  className,
  hint = "Code ins Bild halten",
  variant = "inline",
  signal,
  controlsClassName,
}: {
  onScan: (text: string) => void;
  paused?: boolean;
  className?: string;
  hint?: string;
  variant?: "inline" | "fullscreen";
  signal?: ScanSignal | null;
  /** Position der Knöpfe (Licht, Zoom, Tastatur) im Vollbild. */
  controlsClassName?: string;
}) {
  const fullscreen = variant === "fullscreen";
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
  const [zoom, setZoom] = React.useState<{ range: ZoomRange | null; value: number }>({
    range: null,
    value: 1,
  });
  const [flash, setFlash] = React.useState<ScanSignal["tone"] | null>(null);
  const flashTimer = React.useRef(0);
  const [manual, setManual] = React.useState("");
  const [showManual, setShowManual] = React.useState(false);

  React.useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);
  React.useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const signalledRef = React.useRef(signal !== undefined);
  const showFlash = React.useCallback((tone: ScanSignal["tone"], ms: number) => {
    window.clearTimeout(flashTimer.current);
    setFlash(tone);
    flashTimer.current = window.setTimeout(() => setFlash(null), ms);
  }, []);
  React.useEffect(() => {
    signalledRef.current = signal !== undefined;
    if (signal) showFlash(signal.tone, 600);
  }, [signal, showFlash]);

  const emit = React.useCallback(
    (text: string) => {
      const now = Date.now();
      if (lastRef.current.text === text && now - lastRef.current.at < REPEAT_MS) return;
      lastRef.current = { text, at: now };
      if (!signalledRef.current) showFlash("ok", 250);
      onScanRef.current(text);
    },
    [showFlash],
  );

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
      const capabilities = track?.getCapabilities?.() as
        { torch?: boolean; zoom?: ZoomRange } | undefined;
      setTorch({ supported: Boolean(capabilities?.torch), on: false });
      const range = capabilities?.zoom;
      setZoom({ range: range && range.max >= 2 ? range : null, value: 1 });
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

  // Im Hintergrund Kamera freigeben (Akku, Kamera-Lämpchen) und beim Zurückkommen neu starten.
  React.useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        if (streamRef.current) {
          stop();
          setState("idle");
        }
      } else if (!streamRef.current) {
        void start();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [start, stop]);

  // Beim Scannen soll das Display nicht ausgehen.
  React.useEffect(() => {
    if (state !== "running") return;
    const wakeLock = (
      navigator as { wakeLock?: { request: (type: "screen") => Promise<WakeLockLike> } }
    ).wakeLock;
    if (!wakeLock) return;
    let lock: WakeLockLike | null = null;
    let released = false;
    wakeLock
      .request("screen")
      .then((value) => {
        if (released) void value.release();
        else lock = value;
      })
      .catch(() => undefined);
    return () => {
      released = true;
      void lock?.release().catch(() => undefined);
    };
  }, [state]);

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

  const cycleZoom = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !zoom.range) return;
    const steps = ZOOM_STEPS.filter((step) => step <= zoom.range!.max);
    const next = steps[(steps.indexOf(zoom.value) + 1) % steps.length] ?? 1;
    try {
      await track.applyConstraints({
        advanced: [{ zoom: Math.max(zoom.range.min, next) } as MediaTrackConstraintSet],
      });
      setZoom((value) => ({ ...value, value: next }));
    } catch (error) {
      console.warn("Zoom nicht möglich", error);
    }
  };

  const frameTone =
    flash === "ok"
      ? "border-success"
      : flash === "warn"
        ? "border-warning"
        : flash === "error"
          ? "border-destructive"
          : null;

  const submitManual = (event: React.FormEvent) => {
    event.preventDefault();
    const text = manual.trim();
    if (!text) return;
    lastRef.current = { text: "", at: 0 };
    emit(text);
    setManual("");
  };

  const controls = (
    <div className={cn("flex gap-2", fullscreen ? controlsClassName : "absolute top-2 right-2")}>
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
      {zoom.range ? (
        <Button
          type="button"
          size={zoom.value > 1 ? "sm" : "icon"}
          variant={zoom.value > 1 ? "primary" : "subtle"}
          onClick={() => void cycleZoom()}
          aria-label={`Zoom ${zoom.value}-fach, antippen zum Wechseln`}
        >
          {zoom.value > 1 ? <span className="tabular-nums">{zoom.value}×</span> : <ZoomInIcon />}
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
  );

  const manualForm = showManual ? (
    <form onSubmit={submitManual} className="flex gap-2">
      <Input
        value={manual}
        onChange={(event) => setManual(event.target.value)}
        placeholder="Code, z. B. T-42"
        aria-label="Code eingeben"
        autoCapitalize="characters"
        autoComplete="off"
        autoFocus
        className="min-w-0 flex-1 bg-background font-mono"
      />
      <Button type="submit" disabled={!manual.trim()}>
        OK
      </Button>
    </form>
  ) : null;

  const status =
    state === "running" ? null : (
      <div
        className={cn(
          "absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center text-sm",
          fullscreen ? "text-white" : "text-foreground",
        )}
      >
        {state === "starting" || state === "idle" ? (
          <p>Kamera startet …</p>
        ) : (
          <>
            <p className="max-w-xs">
              {state === "denied"
                ? "Kein Kamerazugriff. Bitte im Browser erlauben – oder den Code eintippen."
                : "Dieser Browser kann die Kamera nicht nutzen. Code eintippen."}
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
    );

  if (fullscreen) {
    return (
      <div className={cn("absolute inset-0 overflow-hidden bg-black", className)}>
        <video
          ref={videoRef}
          className={cn("h-full w-full object-cover transition-opacity", paused && "opacity-50")}
          playsInline
          muted
          aria-label="Kamerabild"
        />
        {state === "running" ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4 pb-[18dvh]">
            <div
              className={cn(
                "aspect-square w-[min(68vw,18rem)] rounded-3xl border-4 shadow-[0_0_0_200vmax_rgb(0_0_0/0.35)] transition-colors",
                frameTone ?? "border-white/90",
              )}
            />
            <p className="max-w-[80vw] rounded-full bg-black/60 px-3 py-1 text-center text-xs font-medium text-white">
              {paused ? "Pausiert" : hint}
            </p>
          </div>
        ) : null}
        {status}
        {controls}
        {manualForm ? (
          <div className="absolute inset-x-3 top-[calc(env(safe-area-inset-top)+7.5rem)]">
            {manualForm}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div
        className={cn(
          "relative aspect-[4/3] w-full overflow-hidden rounded-xl border-2 bg-muted transition-colors sm:aspect-video",
          frameTone ?? "border-border",
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
                frameTone ?? "border-background/80",
              )}
            />
          </div>
        ) : (
          status
        )}
        {state === "running" ? (
          <p className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-background/80 px-3 py-1 text-center text-xs font-medium text-foreground">
            {paused ? "Pausiert" : hint}
          </p>
        ) : null}
        {controls}
      </div>
      {manualForm}
    </div>
  );
}

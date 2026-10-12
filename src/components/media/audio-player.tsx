"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Music, Pause, Play, RotateCcw, RotateCw } from "lucide-react";

import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

import { formatDuration } from "./upload";

/** Es spielt immer nur ein Player: startet einer, halten die anderen an. */
const PLAY_EVENT = "mb-audio-play";

const SPEEDS = [1, 1.25, 0.75] as const;

const clock = (seconds: number) => formatDuration(Math.max(0, Math.floor(seconds))) ?? "0:00";

/**
 * Player für Sprachmemos und Musik: großer Knopf, Spulen per Regler, ±10 s und Tempo (zum
 * Üben langsamer). Browser-Aufnahmen (WebM) kennen ihre Länge oft nicht – dann gilt `duration`.
 */
export function AudioPlayer({
  src,
  title,
  duration: knownDuration,
  kind = "music",
  className,
  action,
}: {
  src: string;
  title: string;
  /** Länge laut Server (Sekunden), falls die Datei sie nicht mitliefert. */
  duration?: number | null;
  kind?: "memo" | "music";
  className?: string;
  /** Zusätzlicher Knopf rechts (z. B. Entfernen). */
  action?: React.ReactNode;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [mediaDuration, setMediaDuration] = useState<number | null>(null);
  const [seeking, setSeeking] = useState<number | null>(null);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [failed, setFailed] = useState(false);
  const duration = mediaDuration ?? knownDuration ?? 0;

  useEffect(() => {
    const onOtherPlay = (event: Event) => {
      if ((event as CustomEvent<HTMLAudioElement>).detail !== audioRef.current) {
        audioRef.current?.pause();
      }
    };
    window.addEventListener(PLAY_EVENT, onOtherPlay);
    return () => window.removeEventListener(PLAY_EVENT, onOtherPlay);
  }, []);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: audio }));
    setLoading(true);
    try {
      await audio.play();
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const seekTo = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const end = duration || audio.duration || 0;
    audio.currentTime = Math.max(0, end ? Math.min(seconds, end - 0.1) : seconds);
    setPosition(audio.currentTime);
  };

  const shown = seeking ?? position;
  const Icon = kind === "memo" ? Mic : Music;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border bg-card px-2.5 py-2",
        className,
      )}
    >
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? `${title} anhalten` : `${title} abspielen`}
        className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform active:scale-95"
      >
        {loading ? (
          <Loader2 className="size-5 animate-spin" aria-hidden />
        ) : playing ? (
          <Pause className="size-5 fill-current" aria-hidden />
        ) : (
          <Play className="ml-0.5 size-5 fill-current" aria-hidden />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-sm">
          <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate font-medium">{title}</span>
        </div>
        <Slider
          value={[duration ? Math.min(shown, duration) : 0]}
          max={duration || 1}
          step={0.1}
          disabled={!duration}
          onValueChange={([value]) => setSeeking(value)}
          onValueCommit={([value]) => {
            seekTo(value);
            setSeeking(null);
          }}
          thumbLabel="Position"
          className="h-6"
        />
        <div className="flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
          <span>{clock(shown)}</span>
          <span aria-hidden>/</span>
          <span>{duration ? clock(duration) : "–:––"}</span>
          {failed ? (
            <span className="ml-1 text-destructive">lässt sich nicht abspielen</span>
          ) : null}
          <span className="ml-auto flex items-center">
            <button
              type="button"
              onClick={() => seekTo(position - 10)}
              aria-label="10 Sekunden zurück"
              className="flex size-8 items-center justify-center rounded-full hover:bg-muted"
            >
              <RotateCcw className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => seekTo(position + 10)}
              aria-label="10 Sekunden vor"
              className="flex size-8 items-center justify-center rounded-full hover:bg-muted"
            >
              <RotateCw className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => {
                const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
                setSpeed(next);
                if (audioRef.current) audioRef.current.playbackRate = next;
              }}
              aria-label={`Tempo ${speed}-fach, ändern`}
              className="h-8 min-w-11 rounded-full px-1.5 font-medium hover:bg-muted"
            >
              {String(speed).replace(".", ",")}×
            </button>
          </span>
        </div>
      </div>
      {action}
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setPosition(0);
          if (audioRef.current) audioRef.current.currentTime = 0;
        }}
        onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => {
          const value = event.currentTarget.duration;
          if (Number.isFinite(value) && value > 0) setMediaDuration(value);
          event.currentTarget.playbackRate = speed;
        }}
        onDurationChange={(event) => {
          const value = event.currentTarget.duration;
          if (Number.isFinite(value) && value > 0) setMediaDuration(value);
        }}
        onError={() => setFailed(true)}
        hidden
      />
    </div>
  );
}
